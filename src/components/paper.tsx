import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { paper, serif } from "@/lib/theme";

/** How far above the keyboard a focused field sits, leaving room to see what's under it. */
export const KEYBOARD_GAP = 60;

/** One ledger page: cream paper with a shaded gutter, a small-caps heading, and a footer for page turning. */
export function PaperPage({ title, subtitle, footer, children }: { title: string; subtitle?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.page}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={KEYBOARD_GAP}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        {subtitle ? <Text style={styles.subtitle}>~ {subtitle} ~</Text> : null}
        {children}
      </KeyboardAwareScrollView>
      <LinearGradient colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gutter} pointerEvents="none" />
      {footer}
    </View>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

/** A ruled line of the ledger: label (and optional note) on the left, a figure or control on the right. */
export function Line({ label, note, right, onPress }: { label: ReactNode; note?: ReactNode; right?: ReactNode; onPress?: () => void }) {
  const body = (
    <>
      <View style={styles.grow}>
        <Text style={styles.text}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      {right}
    </>
  );
  return onPress ? (
    <Pressable style={styles.line} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.line}>{body}</View>
  );
}

export function Ink({ children, tone = "ink", small }: { children: ReactNode; tone?: "ink" | "red" | "green" | "faint"; small?: boolean }) {
  return <Text style={[styles.text, { color: paper[tone] }, small && styles.small]}>{children}</Text>;
}

/** A rubber-stamp figure, set slightly askew. */
export function Stamp({ label, value, note, tone }: { label: string; value: string; note?: string; tone: "ink" | "red" | "green" }) {
  return (
    <View style={[styles.stamp, { borderColor: paper[tone] }]}>
      <Text style={[styles.stampLabel, { color: paper[tone] }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.stampValue, { color: paper[tone] }]}>{value}</Text>
      {note ? <Text style={[styles.note, { color: paper[tone] }]}>{note}</Text> : null}
    </View>
  );
}

export function PaperButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primary, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

export function PaperLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text style={styles.link} onPress={onPress}>
      {label}
    </Text>
  );
}

/** A figure written on the page: ink-blue, on a dashed underline. */
export function PaperInput(props: TextInputProps & { wide?: boolean }) {
  const { wide, style, ...rest } = props;
  return <TextInput placeholderTextColor={paper.faint} {...rest} style={[styles.input, wide ? styles.inputWide : styles.inputFigure, style]} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paper.bg },
  content: { paddingTop: 18, paddingRight: 18, paddingLeft: 28, paddingBottom: 28 },
  gutter: { position: "absolute", top: 0, bottom: 0, left: 0, width: 16 },
  title: { fontFamily: serif, fontSize: 19, letterSpacing: 2, textAlign: "center", color: "#4a2c0c", fontWeight: "bold" },
  subtitle: { fontFamily: serif, fontSize: 12, fontStyle: "italic", textAlign: "center", color: paper.faint, marginTop: 2, marginBottom: 10 },
  heading: { fontFamily: serif, fontSize: 13, letterSpacing: 1.5, color: paper.faint, marginTop: 18, marginBottom: 2, textTransform: "uppercase" },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 38, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: paper.rule },
  grow: { flex: 1 },
  text: { fontFamily: serif, fontSize: 15, color: paper.text },
  small: { fontSize: 13 },
  note: { fontFamily: serif, fontSize: 11.5, fontStyle: "italic", color: paper.faint },
  stamp: { alignSelf: "center", alignItems: "center", marginVertical: 12, paddingVertical: 6, paddingHorizontal: 18, borderWidth: 2, borderRadius: 6, transform: [{ rotate: "-2deg" }] },
  stampLabel: { fontFamily: serif, fontSize: 11, letterSpacing: 1.5 },
  stampValue: { fontFamily: serif, fontSize: 26, fontWeight: "bold" },
  button: { alignItems: "center", paddingVertical: 9, paddingHorizontal: 14, marginTop: 8, borderRadius: 6, borderWidth: 1, borderColor: "#7a4f22", backgroundColor: "#ead9ad" },
  primary: { backgroundColor: "#6b211b", borderColor: "#3d0f0c" },
  pressed: { opacity: 0.75 },
  buttonText: { fontFamily: serif, fontSize: 14, fontWeight: "bold", color: "#5a3610" },
  primaryText: { color: "#f3dd9c" },
  link: { fontFamily: serif, fontSize: 14, color: paper.ink, textDecorationLine: "underline", paddingVertical: 8 },
  input: { fontFamily: serif, fontSize: 15, color: paper.ink, backgroundColor: "rgba(255,255,255,0.45)", borderBottomWidth: 1, borderColor: paper.faint, borderStyle: "dashed", paddingVertical: 4, paddingHorizontal: 6 },
  inputFigure: { width: 92, textAlign: "right" },
  inputWide: { alignSelf: "stretch", marginTop: 6 },
});
