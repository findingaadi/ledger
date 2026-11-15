import { useEffect } from "react";
import { BackHandler, StyleSheet, Text, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { BookView } from "@/components/book-view";
import { BookCover, type BookRect, type ShelfBook } from "@/components/shelf-view";
import { paper, serif } from "@/lib/theme";
import { useCycle, type CycleState } from "@/lib/use-cycle";

const LIFT = { duration: 480, easing: Easing.inOut(Easing.cubic) };
const SWING = { duration: 720, easing: Easing.inOut(Easing.cubic) };

/**
 * A book taken off the shelf. Its cover lifts from where it sat, grows to fill
 * the screen, then swings open on its spine to show the pages. Closing runs
 * the same thing backwards.
 */
export function OpenBook({ book, rect, onClosed, sample }: { book: ShelfBook; rect: BookRect; onClosed: () => void; sample?: CycleState }) {
  const live = useCycle(sample ? "" : book.id);
  const state = sample ?? live; // the preview page passes made-up numbers
  const { width, height } = useWindowDimensions();
  const pageWidth = Math.min(width, 520);
  const left = (width - pageWidth) / 2;

  const lift = useSharedValue(0);   // 0 on the shelf, 1 filling the screen
  const swing = useSharedValue(0);  // 0 closed, 1 open

  useEffect(() => {
    lift.set(withTiming(1, LIFT, () => {
      swing.set(withTiming(1, SWING));
    }));
  }, [lift, swing]);

  const close = () => {
    swing.set(withTiming(0, SWING, () => {
      lift.set(withTiming(0, LIFT, () => scheduleOnRN(onClosed)));
    }));
  };

  // Android's back button closes the book instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only uses stable shared values and onClosed
  }, []);

  const cover = useAnimatedStyle(() => ({
    opacity: swing.value > 0.97 ? 0 : 1,
    transform: [
      { perspective: 1600 },
      { translateX: lift.value * (left - rect.x) },
      { translateY: lift.value * -rect.y },
      { rotateY: `${-swing.value * 105}deg` },
      { scaleX: 1 + lift.value * (pageWidth / rect.width - 1) },
      { scaleY: 1 + lift.value * (height / rect.height - 1) },
    ],
  }));
  // The pages are only there once the cover has covered the screen.
  const pages = useAnimatedStyle(() => ({ opacity: lift.value > 0.98 ? 1 : 0 }));

  return (
    <>
      <Animated.View style={[styles.pages, pages]}>
        {state ? <BookView state={state} onClose={close} /> : <Text style={styles.opening}>Opening…</Text>}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.cover, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }, cover]}>
        <BookCover month={book.month} year={book.year} color={rect.color} width={rect.width} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  pages: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: paper.bg },
  opening: { flex: 1, paddingTop: 120, textAlign: "center", fontFamily: serif, fontStyle: "italic", color: paper.faint },
  cover: { position: "absolute", transformOrigin: "left top", backfaceVisibility: "hidden", boxShadow: "6px 6px 18px rgba(0,0,0,0.6)" },
});
