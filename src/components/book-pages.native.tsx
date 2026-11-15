import { Canvas, Fill, ImageShader, Shader, Skia, makeImageFromView, type SkImage } from "@shopify/react-native-skia";
import { createRef, useCallback, useEffect, useMemo, useState, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Easing, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { BookPagesProps } from "./book-pages";

/**
 * Bends a page like paper. The page is treated as a sheet wrapped round a
 * cylinder lying across it: the part before the cylinder is flat, the part
 * on the cylinder curves up and over, and what has gone over lies flat on top
 * showing the blank back of the page. Where no paper is left, the page
 * beneath shows through in the curl's shadow.
 */
const CURL = Skia.RuntimeEffect.Make(`
uniform shader page;
uniform float2 size;
uniform float fold;      // where the paper meets the cylinder, at the page's vertical middle
uniform float angle;     // tilt of the fold line, in radians
uniform float radius;    // radius of the bend
uniform float progress;  // 0 flat, 1 turned
uniform float4 back;     // colour of the back of the paper

const float PI = 3.14159265;

bool inside(float2 q) { return q.x >= 0.0 && q.y >= 0.0 && q.x <= size.x && q.y <= size.y; }

half4 main(float2 p) {
  float2 n = float2(cos(angle), sin(angle));      // across the fold, towards the free edge
  float d = dot(p - float2(fold, size.y * 0.5), n); // how far past the fold this pixel is

  if (d < 0.0) {
    // Paper that has gone right over lies flat on top, back side up.
    float2 q = p + n * (PI * radius - 2.0 * d);
    if (inside(q)) {
      float lit = 0.86 + 0.12 * clamp(-d / (size.x * 0.5), 0.0, 1.0);
      return half4(back.rgb * lit, 1.0);
    }
    // The part of the page not yet lifted, shading a little as it nears the bend.
    half4 c = page.eval(p);
    float shade = 1.0 - 0.2 * smoothstep(-radius * 3.0, 0.0, d) * smoothstep(0.0, 0.06, progress);
    return half4(c.rgb * shade, c.a);
  }

  if (d < radius) {
    float theta = asin(d / radius);
    // Top of the bend: the back of the paper coming over.
    float2 q = p + n * (radius * (PI - theta) - d);
    if (inside(q)) {
      return half4(back.rgb * (0.6 + 0.35 * cos(theta)), 1.0);
    }
    // Underside of the bend: the front of the page curving away, darker towards the rim.
    q = p + n * (radius * theta - d);
    if (inside(q)) {
      half4 c = page.eval(q);
      return half4(c.rgb * (0.62 + 0.38 * cos(theta)), c.a);
    }
  }

  // No paper here: the page beneath shows through, shadowed next to the curl.
  float shadow = 0.38 * (1.0 - smoothstep(0.0, radius * 1.8, d - radius)) * smoothstep(0.0, 0.06, progress);
  return half4(0.0, 0.0, 0.0, shadow);
}
`)!;

// The blank back of a page, a shade darker than its front.
const BACK = [0.918, 0.875, 0.761, 1];

type ViewRef = ComponentRef<typeof View>;

/** The book's pages on a phone: drag sideways and the page bends over like paper. */
export function BookPages({ count, first, width, names, render }: BookPagesProps) {
  const [page, setPage] = useState(first);
  const [height, setHeight] = useState(0);
  // Which page is being bent, and its photograph. While set, that page is drawn by the canvas.
  const [curl, setCurl] = useState<{ index: number; image: SkImage } | null>(null);
  const refs = useMemo(() => Array.from({ length: count }, () => createRef<ViewRef>()), [count]);
  // Photographs taken ahead of time, so a turn can start bending the moment a drag begins.
  // A plain cache object kept for the component's lifetime; changing it shouldn't re-render.
  const [shots] = useState(() => new Map<number, SkImage>());
  const last = count - 1;

  // The drag runs on the UI thread, so it reads these rather than React state, which it would see stale.
  const pageSV = useSharedValue(first);
  const sizeSV = useSharedValue({ width, height: 0 });
  useEffect(() => {
    sizeSV.value = { width, height };
  }, [width, height, sizeSV]);

  const progress = useSharedValue(0); // the bending page: 0 lying flat on the right, 1 turned over to the left
  const dir = useSharedValue(0);      // 1 turning forward, -1 turning back, 0 not turning
  const grabY = useSharedValue(0.5);  // where the page was taken hold of, as a fraction of its height

  const photograph = useCallback(async (index: number) => {
    if (index < 0 || index > last) return null;
    const image = await makeImageFromView(refs[index] as never).catch(() => null);
    if (image) shots.set(index, image);
    return image;
  }, [refs, last, shots]);

  // After landing on a page, photograph it and the one before it, ready for the next turn either way.
  useEffect(() => {
    const t = setTimeout(() => {
      photograph(page);
      photograph(page - 1);
    }, 350);
    return () => clearTimeout(t);
  }, [page, height, photograph]);

  // Start bending page `index`: straight away from the photograph taken earlier, then swap in a fresh one.
  const begin = async (index: number) => {
    const ready = shots.get(index);
    if (ready) setCurl({ index, image: ready });
    const fresh = await photograph(index);
    if (fresh && dir.value !== 0) setCurl({ index, image: fresh });
    return Boolean(ready || fresh);
  };
  const finish = (to: number) => {
    pageSV.value = to;
    setPage(to);
    setCurl(null);
    dir.value = 0;
  };

  // Footer links turn one page with the same bend.
  const go = async (to: number) => {
    const from = pageSV.value;
    const target = Math.max(0, Math.min(last, to));
    if (target === from || dir.value !== 0) return;
    const forward = target > from;
    dir.value = forward ? 1 : -1;
    grabY.value = 0.75;
    progress.value = forward ? 0 : 1;
    if (!(await begin(forward ? from : from - 1))) return finish(from);
    progress.value = withTiming(forward ? 1 : 0, { duration: 850, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(finish, forward ? from + 1 : from - 1);
    });
  };

  const drag = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-14, 14])
    .onStart((e) => {
      const at = pageSV.value;
      const forward = e.translationX < 0;
      if ((forward && at >= last) || (!forward && at <= 0) || dir.value !== 0) return;
      dir.value = forward ? 1 : -1;
      grabY.value = sizeSV.value.height ? e.y / sizeSV.value.height : 0.5;
      progress.value = forward ? 0 : 1;
      scheduleOnRN(begin, forward ? at : at - 1);
    })
    .onUpdate((e) => {
      if (dir.value === 0) return;
      const w = sizeSV.value.width;
      const p = dir.value === 1 ? -e.translationX / w : 1 - e.translationX / w;
      progress.value = Math.max(0, Math.min(1, p));
    })
    .onEnd((e) => {
      if (dir.value === 0) return;
      const at = pageSV.value;
      const forward = dir.value === 1;
      const turn = forward ? progress.value > 0.3 || e.velocityX < -700 : progress.value < 0.7 || e.velocityX > 700;
      const target = forward === turn ? 1 : 0;
      const landing = turn ? (forward ? at + 1 : at - 1) : at;
      progress.value = withTiming(target, { duration: 420, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(finish, landing);
      });
    });

  const uniforms = useDerivedValue(() => {
    const t = progress.value;
    const { width: w, height: h } = sizeSV.value;
    const bend = Math.sin(t * Math.PI);
    const radius = w * (0.05 + 0.12 * bend);
    // Taking hold low on the page tips the fold one way, high the other, like lifting a corner.
    const angle = (grabY.value - 0.5) * 0.55 * bend;
    const reach = w + radius + (h / 2) * Math.abs(Math.tan(angle)) + 4;
    return { size: [w, h], fold: w - t * reach, angle, radius, progress: t, back: BACK };
  });

  // The page being bent is hidden (the canvas draws it); when turning forward the next page
  // lies directly beneath it, and when turning back the current page is beneath.
  const z = (index: number) => (index === page ? 3 : index === page + 1 ? 2 : 1);

  return (
    <GestureDetector gesture={drag}>
      <View style={styles.fill} onLayout={(e) => setHeight(e.nativeEvent.layout.height)} accessibilityLabel={`Page ${page + 1} of ${count}: ${names[page]}`}>
        {Array.from({ length: count }, (_, index) => (
          <View
            key={index}
            ref={refs[index]}
            collapsable={false}
            style={[styles.page, { zIndex: z(index), opacity: curl?.index === index && index === page ? 0 : 1 }]}
            pointerEvents={index === page && !curl ? "auto" : "none"}
          >
            {render(index, go)}
          </View>
        ))}
        {curl ? (
          <Canvas style={[styles.page, { zIndex: 10 }]} pointerEvents="none">
            <Fill>
              <Shader source={CURL} uniforms={uniforms}>
                <ImageShader image={curl.image} fit="fill" rect={{ x: 0, y: 0, width, height }} />
              </Shader>
            </Fill>
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
