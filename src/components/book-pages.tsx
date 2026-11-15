import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export type BookPagesProps = {
  count: number;
  /** The page the book opens on. */
  first: number;
  width: number;
  names: string[];
  /** Draws page `index`; `go` turns to another page. */
  render: (index: number, go: (to: number) => void) => ReactNode;
};

/** The book's pages: stacked leaves that swing about the spine as you drag or tap the footer links. */
export function BookPages({ count, first, width, names, render }: BookPagesProps) {
  const [page, setPage] = useState(first);
  // How far through the book we are: 1 is page two lying flat, 1.4 is page two 40% of the way over.
  const position = useSharedValue(first);
  const dragFrom = useSharedValue(first);
  const last = count - 1;

  // A row under the finger would otherwise treat the end of a drag as a tap. While a page is
  // being dragged, and for a moment after, the pages' contents ignore touches.
  const [turning, setTurning] = useState(false);
  const endTurning = () => setTimeout(() => setTurning(false), 300);

  const go = (to: number) => {
    const target = Math.max(0, Math.min(last, to));
    position.value = withTiming(target, { duration: 750, easing: Easing.inOut(Easing.cubic) });
    setPage(target);
  };

  // Drag sideways to turn a page; the page follows the finger and settles either way on release.
  // Mostly-vertical movement is left alone so the page can still scroll.
  const drag = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-14, 14])
    .onStart(() => {
      dragFrom.value = Math.round(position.value);
      scheduleOnRN(setTurning, true);
    })
    .onUpdate((e) => {
      const next = dragFrom.value - e.translationX / width;
      position.value = Math.max(Math.max(0, dragFrom.value - 1), Math.min(Math.min(last, dragFrom.value + 1), next));
    })
    .onEnd((e) => {
      const moved = position.value - dragFrom.value;
      const turn = Math.abs(moved) > 0.3 || Math.abs(e.velocityX) > 700;
      const target = turn && moved !== 0 ? dragFrom.value + Math.sign(moved) : dragFrom.value;
      position.value = withTiming(target, { duration: 380, easing: Easing.out(Easing.cubic) });
      scheduleOnRN(setPage, target);
    })
    .onFinalize(() => {
      scheduleOnRN(endTurning);
    });

  return (
    <GestureDetector gesture={drag}>
      <View style={styles.fill} accessibilityLabel={`Page ${page + 1} of ${count}: ${names[page]}`}>
        <View style={styles.face} pointerEvents={turning ? "none" : "box-none"}>
          {Array.from({ length: count }, (_, index) => (
            <TurningPage key={index} index={index} count={count} position={position}>
              {render(index, go)}
            </TurningPage>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

/**
 * One leaf of the book. Pages are stacked with the first on top; a page swings
 * about the spine on its left edge, showing its blank back once past upright,
 * darkening as it bends away from the light and shading the page beneath.
 */
function TurningPage({ index, count, position, children }: { index: number; count: number; position: SharedValue<number>; children: ReactNode }) {
  const leaf = useAnimatedStyle(() => {
    const turned = Math.max(0, Math.min(1, position.value - index));
    return {
      display: turned >= 1 ? "none" : "flex",
      transform: [{ perspective: 1800 }, { rotateY: `${-180 * turned}deg` }, { rotateZ: `${-1.5 * Math.sin(turned * Math.PI)}deg` }],
    };
  });
  const front = useAnimatedStyle(() => ({ opacity: position.value - index < 0.5 ? 1 : 0 }));
  const back = useAnimatedStyle(() => ({ opacity: position.value - index >= 0.5 ? 1 : 0 }));
  const bend = useAnimatedStyle(() => {
    const turned = Math.max(0, Math.min(1, position.value - index));
    return { opacity: Math.sin(turned * Math.PI) * 0.4 };
  });
  // The page above casts a shadow here while it is in the air.
  const shadow = useAnimatedStyle(() => {
    const above = position.value - (index - 1);
    return { opacity: above > 0 && above < 1 ? (1 - above) * 0.5 : 0 };
  });

  return (
    <Animated.View style={[styles.leaf, { zIndex: count - index }, leaf]}>
      <Animated.View style={[styles.face, front]}>
        {children}
        <Animated.View style={[styles.face, shadow]} pointerEvents="none">
          <LinearGradient colors={["rgba(0,0,0,0.75)", "rgba(0,0,0,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0 }} style={styles.fill} />
        </Animated.View>
        <Animated.View style={[styles.face, bend]} pointerEvents="none">
          <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.face, styles.back, back]} pointerEvents="none">
        <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.3)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  leaf: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transformOrigin: "left center" },
  face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  fill: { flex: 1 },
  // The reverse of a page: blank paper, mirrored so it reads correctly from behind.
  back: { backgroundColor: "#eadfc2", transform: [{ rotateY: "180deg" }] },
});
