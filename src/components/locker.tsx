import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Grain, WOOD_UPRIGHT } from "@/components/wood";
import { serif, wood } from "@/lib/theme";

const LEATHER = require("@/assets/textures/leather.png");

/**
 * - intro: still finding out whether you're signed in
 * - login: show the "Login to Monzo" button
 * - waiting: signed in, waiting for approval in the Monzo app
 * - unlock: approved; turn the key, open the doors and reveal the shelf
 */
export type LockerPhase = "intro" | "login" | "waiting" | "unlock";

type Props = {
  phase: LockerPhase;
  message?: string;
  error?: string;
  onLogin: () => void;
  onSignOut?: () => void;
  /** Called once the doors are fully open, so the locker can be removed. */
  onUnlocked: () => void;
};

const brass = ["#f3d98b", "#c99a3e", "#8a6420"] as const;
const brassEdge = "#5e4212";
const doorWood = ["#5c3a1d", "#3f2611"] as const;
const panelLeather = "#4a1717";

/**
 * The sign-in screen: an antique cabinet locked with a brass lock. On opening the
 * app the doors close in, the lock drops into place and the button rises. Once
 * Monzo access is approved the key turns, the lock falls away and the doors swing
 * open onto the bookshelf, which is already rendered behind them.
 */
export function Locker({ phase, message, error, onLogin, onSignOut, onUnlocked }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [introDone, setIntroDone] = useState(false);

  const doorsIn = useSharedValue(0);   // 0 apart off screen, 1 shut
  const lockIn = useSharedValue(0);    // the lock drops onto the doors
  const titleIn = useSharedValue(0);
  const buttonIn = useSharedValue(0);
  const glint = useSharedValue(0);     // light sweeping across the brass
  const key = useSharedValue(0);       // 0 upright, 1 turned
  const wiggle = useSharedValue(0);    // the key jiggles while waiting
  const open = useSharedValue(0);      // doors swinging open

  // Opening sequence.
  useEffect(() => {
    doorsIn.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.1)) }));
    lockIn.set(withDelay(550, withSpring(1, { damping: 9, stiffness: 120 })));
    titleIn.set(withDelay(850, withTiming(1, { duration: 600 })));
    glint.set(withDelay(1400, withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withDelay(2200, withTiming(0, { duration: 0 }))), -1)));
    const t = setTimeout(() => setIntroDone(true), 1300);
    return () => clearTimeout(t);
  }, [doorsIn, lockIn, titleIn, glint]);

  // The button rises once the intro is over and we know you need to log in.
  useEffect(() => {
    buttonIn.set(withTiming(introDone && (phase === "login" || phase === "waiting") ? 1 : 0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [introDone, phase, buttonIn]);

  // While waiting for approval the key jiggles in the lock.
  useEffect(() => {
    wiggle.set(phase === "waiting" ? withRepeat(withSequence(withTiming(1, { duration: 140 }), withTiming(-1, { duration: 280 }), withTiming(0, { duration: 140 }), withDelay(1200, withTiming(0, { duration: 0 }))), -1) : withTiming(0));
  }, [phase, wiggle]);

  // Unlock: turn the key, then open the doors, then hand over to the shelf.
  useEffect(() => {
    if (phase !== "unlock" || !introDone) return;
    buttonIn.set(withTiming(0, { duration: 250 }));
    key.set(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.cubic) }));
    lockIn.set(withDelay(700, withTiming(2, { duration: 450, easing: Easing.in(Easing.cubic) })));
    titleIn.set(withDelay(700, withTiming(0, { duration: 300 })));
    open.set(withDelay(950, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(onUnlocked);
    })));
  }, [phase, introDone, key, lockIn, titleIn, open, buttonIn, onUnlocked]);

  const half = width / 2;
  const leftDoor = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { translateX: (doorsIn.value - 1) * half },
      { rotateY: `${-open.value * 112}deg` },
    ],
  }));
  const rightDoor = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { translateX: (1 - doorsIn.value) * half },
      { rotateY: `${open.value * 112}deg` },
    ],
  }));
  const lock = useAnimatedStyle(() => {
    const v = lockIn.value;
    // 0 → 1 drops in from above; 1 → 2 falls away downwards.
    const y = v <= 1 ? (v - 1) * 160 : (v - 1) * height * 0.6;
    return { opacity: v <= 1 ? Math.min(1, v * 1.5) : 2 - v, transform: [{ translateY: y }, { rotate: `${v > 1 ? (v - 1) * 25 : 0}deg` }] };
  });
  const keyStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${key.value * 90 + wiggle.value * 9}deg` }] }));
  const title = useAnimatedStyle(() => ({ opacity: titleIn.value, transform: [{ translateY: (1 - titleIn.value) * -14 }] }));
  const button = useAnimatedStyle(() => ({ opacity: buttonIn.value, transform: [{ translateY: (1 - buttonIn.value) * 60 }] }));
  const shine = useAnimatedStyle(() => ({ opacity: glint.value > 0 && glint.value < 1 ? 0.55 : 0, transform: [{ translateX: -160 + glint.value * 360 }, { rotate: "20deg" }] }));
  const shade = useAnimatedStyle(() => ({ opacity: 1 - open.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={phase === "unlock" ? "none" : "auto"}>
      {/* The cabinet's dark interior, seen until the doors are open. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.interior, shade]} />

      <Animated.View style={[styles.door, { left: 0, width: half, transformOrigin: "left center" }, leftDoor]}>
        <Door side="left" />
      </Animated.View>
      <Animated.View style={[styles.door, { left: half, width: half, transformOrigin: "right center" }, rightDoor]}>
        <Door side="right" />
      </Animated.View>

      <Animated.View style={[styles.titleWrap, { top: insets.top + height * 0.1 }, title]} pointerEvents="none">
        <LinearGradient colors={brass} style={styles.nameplate}>
          <Text style={styles.nameplateTitle}>LEDGER</Text>
          <Text style={styles.nameplateSub}>Adi Money Tracker</Text>
          <Animated.View style={[styles.shine, shine]} />
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[styles.lockWrap, { top: height * 0.36 }, lock]} pointerEvents="none">
        <LinearGradient colors={brass} style={styles.lockPlate}>
          <View style={styles.lockRing}>
            <View style={styles.keyholeTop} />
            <View style={styles.keyholeSlot} />
            <Animated.View style={[styles.key, keyStyle]}>
              <View style={styles.keyBow} />
              <View style={styles.keyStem} />
            </Animated.View>
          </View>
          <View style={[styles.screw, { top: 8, left: 8 }]} />
          <View style={[styles.screw, { top: 8, right: 8 }]} />
          <View style={[styles.screw, { bottom: 8, left: 8 }]} />
          <View style={[styles.screw, { bottom: 8, right: 8 }]} />
          <Animated.View style={[styles.shine, shine]} />
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[styles.bottom, { bottom: insets.bottom + 40 }, button]}>
        {phase === "waiting" ? (
          <View style={styles.label}>
            <ActivityIndicator color={wood.ink} />
            <Text style={styles.labelText}>{message ?? "Open your Monzo app and approve access for Ledger."}</Text>
          </View>
        ) : (
          <Pressable onPress={onLogin} disabled={phase !== "login"} style={({ pressed }) => [styles.buttonOuter, pressed && styles.pressed]} accessibilityRole="button">
            <LinearGradient colors={brass} style={styles.button}>
              <Text style={styles.buttonText}>Login to Monzo</Text>
            </LinearGradient>
          </Pressable>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {phase === "waiting" && onSignOut ? (
          <Text style={styles.link} onPress={onSignOut}>
            Start again
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** One wooden door with a leather panel and brass hinges. */
function Door({ side }: { side: "left" | "right" }) {
  const outer = side === "left" ? { left: 6 } : { right: 6 };
  const inner = side === "left" ? { borderRightWidth: 2 } : { borderLeftWidth: 2 };
  return (
    <LinearGradient colors={doorWood} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.doorFace, inner]}>
      <Grain source={WOOD_UPRIGHT} opacity={0.5} />
      <View style={styles.panel}>
        <Grain source={LEATHER} opacity={0.8} />
        <View style={styles.panelFrame} />
      </View>
      <View style={[styles.panel, styles.panelLow]}>
        <Grain source={LEATHER} opacity={0.8} />
        <View style={styles.panelFrame} />
      </View>
      <LinearGradient colors={brass} style={[styles.hinge, outer, { top: "16%" }]} />
      <LinearGradient colors={brass} style={[styles.hinge, outer, { bottom: "16%" }]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  interior: { backgroundColor: "#140b04" },
  door: { position: "absolute", top: 0, bottom: 0, backfaceVisibility: "hidden" },
  doorFace: { flex: 1, borderColor: "#1d1006", paddingHorizontal: 18, paddingTop: "34%", paddingBottom: 30, gap: 18, overflow: "hidden" },
  panel: { flex: 1.25, backgroundColor: panelLeather, borderRadius: 6, overflow: "hidden", borderWidth: 2, borderColor: "#24100a", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)" },
  panelLow: { flex: 1 },
  panelFrame: { position: "absolute", top: 6, left: 6, right: 6, bottom: 6, borderWidth: 1.5, borderColor: "rgba(232,198,106,0.7)", borderRadius: 3 },
  hinge: { position: "absolute", width: 10, height: 46, borderRadius: 3, borderWidth: 1, borderColor: brassEdge },
  titleWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  nameplate: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: brassEdge, alignItems: "center", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.6)" },
  nameplateTitle: { fontFamily: serif, fontSize: 28, fontWeight: "bold", letterSpacing: 6, color: "#3b2606", textShadowColor: "rgba(255,240,200,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  nameplateSub: { fontFamily: serif, fontSize: 13, fontStyle: "italic", color: "#4a3008", letterSpacing: 1 },
  lockWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  lockPlate: { width: 132, height: 168, borderRadius: 18, borderWidth: 2, borderColor: brassEdge, alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 8px 18px rgba(0,0,0,0.7)" },
  lockRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: brassEdge, backgroundColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  keyholeTop: { position: "absolute", top: 20, width: 18, height: 18, borderRadius: 9, backgroundColor: "#1a1006" },
  keyholeSlot: { position: "absolute", top: 32, width: 10, height: 30, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: "#1a1006" },
  key: { position: "absolute", top: 4, alignItems: "center", transformOrigin: "center 34px" },
  keyBow: { width: 22, height: 22, borderRadius: 11, borderWidth: 4, borderColor: "#e8c870", boxShadow: "0 1px 2px rgba(0,0,0,0.6)" },
  keyStem: { width: 5, height: 16, backgroundColor: "#e8c870", marginTop: -2 },
  screw: { position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: "#7a571a", borderWidth: 1, borderColor: brassEdge },
  shine: { position: "absolute", top: -40, bottom: -40, width: 40, backgroundColor: "rgba(255,255,240,0.9)" },
  bottom: { position: "absolute", left: 24, right: 24, alignItems: "center", gap: 12 },
  buttonOuter: { borderRadius: 10, boxShadow: "0 6px 14px rgba(0,0,0,0.6)" },
  pressed: { transform: [{ scale: 0.97 }] },
  button: { paddingHorizontal: 34, paddingVertical: 14, borderRadius: 10, borderWidth: 2, borderColor: brassEdge },
  buttonText: { fontFamily: serif, fontSize: 18, fontWeight: "bold", color: "#3b2606", letterSpacing: 1 },
  label: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 340, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: "rgba(20,11,4,0.75)", borderWidth: 1, borderColor: "rgba(232,198,106,0.5)" },
  labelText: { flexShrink: 1, fontFamily: serif, fontSize: 14, fontStyle: "italic", color: wood.ink },
  error: { fontFamily: serif, color: "#ffb3a7", textAlign: "center", backgroundColor: "rgba(20,11,4,0.75)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  link: { fontFamily: serif, color: wood.ink, textDecorationLine: "underline" },
});
