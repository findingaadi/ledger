import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { gold, leathers, serif, wood } from "@/lib/theme";

export type ShelfBook = { id: string; month: string; year: string; glows?: boolean };

type Props = {
  books: ShelfBook[];
  status?: string;
  onOpen: (id: string) => void;
  onEnvelopes: () => void;
  onTransactions: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
};

const PER_ROW = 3;
const MIN_ROWS = 4;

/** The wooden bookshelf: one leather book per pay cycle, newest first. Pure display; data comes from the parent. */
export function ShelfView({ books, status, onOpen, onEnvelopes, onTransactions, onRefresh, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const shelfWidth = Math.min(width, 520);
  const bookWidth = Math.min(112, Math.floor((shelfWidth - 64) / PER_ROW));
  const bookHeight = Math.round(bookWidth * 1.55);

  const rowCount = Math.max(MIN_ROWS, Math.ceil(books.length / PER_ROW));
  const rows = Array.from({ length: rowCount }, (_, r) => books.slice(r * PER_ROW, r * PER_ROW + PER_ROW));

  return (
    <LinearGradient colors={wood.back} style={styles.screen}>
      <LinearGradient colors={[wood.light, wood.mid, wood.dark]} style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <WoodButton label="Envelopes" onPress={onEnvelopes} />
        <Text style={styles.title}>Ledgers</Text>
        <WoodButton label="Transactions" onPress={onTransactions} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={{ width: shelfWidth, alignSelf: "center" }}>
          {rows.map((row, r) => (
            <View key={r} style={[styles.row, { height: bookHeight + 46 }]}>
              <LinearGradient colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0)"]} style={styles.rowShade} />
              <View style={styles.books}>
                {Array.from({ length: PER_ROW }, (_, k) => {
                  const book = row[k];
                  return book ? (
                    <Book key={book.id} book={book} color={leathers[(r * PER_ROW + k) % leathers.length]} width={bookWidth} height={bookHeight} onPress={() => onOpen(book.id)} />
                  ) : (
                    <View key={k} style={{ width: bookWidth }} />
                  );
                })}
              </View>
              <LinearGradient colors={wood.plank} locations={[0, 0.18, 1]} style={styles.plank} />
            </View>
          ))}
          <View style={styles.footer}>
            {status ? <Text style={styles.footerText}>{status}</Text> : null}
            <Text style={styles.footerLink} onPress={onRefresh}>
              Refresh
            </Text>
            <Text style={styles.footerLink} onPress={onSignOut}>
              Sign out
            </Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function WoodButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Book({ book, color, width, height, onPress }: { book: ShelfBook; color: string; width: number; height: number; onPress: () => void }) {
  // A book with something to do pulses with a gold glow.
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!book.glows) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [book.glows, pulse]);

  return (
    <Pressable onPress={onPress} style={{ width, height }} accessibilityRole="button" accessibilityLabel={`${book.month} ${book.year}${book.glows ? ", needs attention" : ""}`}>
      {book.glows ? (
        <Animated.View style={[styles.halo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
      ) : null}
      <View style={[styles.cover, { backgroundColor: color }]}>
        <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)", "rgba(0,0,0,0.22)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.spine} />
        <View style={styles.frame}>
          <Text style={[styles.month, { fontSize: Math.max(11, width * 0.125) }]} numberOfLines={1} adjustsFontSizeToFit>
            {book.month}
          </Text>
          <Text style={styles.ornament}>❦</Text>
          <Text style={[styles.year, { fontSize: Math.max(11, width * 0.13) }]}>{book.year}</Text>
        </View>
      </View>
      {book.glows ? (
        <LinearGradient colors={gold.ribbon} style={styles.ribbon}>
          <Text style={styles.ribbonText}>To do</Text>
        </LinearGradient>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignSelf: "stretch" },
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingBottom: 8,
    borderBottomWidth: 1, borderColor: wood.edge, boxShadow: "0 3px 8px rgba(0,0,0,0.4)", zIndex: 2,
  },
  title: { fontFamily: serif, fontSize: 20, fontWeight: "bold", color: wood.ink },
  button: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: wood.edge, backgroundColor: "#d3a465" },
  buttonPressed: { backgroundColor: wood.dark },
  buttonText: { fontFamily: serif, fontSize: 13, fontWeight: "bold", color: wood.ink },
  row: { justifyContent: "flex-end" },
  rowShade: { position: "absolute", top: 0, left: 0, right: 0, height: 34 },
  books: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", paddingHorizontal: 14 },
  plank: { height: 18, boxShadow: "0 7px 10px rgba(0,0,0,0.4)" },
  halo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 5, boxShadow: `0 0 18px 8px ${gold.glow}` },
  cover: {
    flex: 1, borderTopRightRadius: 5, borderBottomRightRadius: 5, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, overflow: "hidden",
    borderRightWidth: 3, borderRightColor: "#efe3c4", boxShadow: "5px 3px 7px rgba(0,0,0,0.5)",
  },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 9, backgroundColor: "rgba(0,0,0,0.3)", borderRightWidth: 2, borderRightColor: "rgba(255,255,255,0.12)" },
  frame: {
    flex: 1, marginLeft: 16, marginRight: 7, marginVertical: 8, borderWidth: 1, borderColor: "rgba(232,198,106,0.75)",
    alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 2,
  },
  month: { fontFamily: serif, fontWeight: "bold", color: gold.leaf },
  ornament: { fontSize: 22, color: gold.leaf, opacity: 0.85 },
  year: { fontFamily: serif, color: gold.leaf, letterSpacing: 2 },
  ribbon: { position: "absolute", top: -6, right: 10, paddingHorizontal: 5, paddingTop: 9, paddingBottom: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, boxShadow: "0 2px 3px rgba(0,0,0,0.4)" },
  ribbonText: { fontFamily: serif, fontSize: 10, fontWeight: "bold", color: wood.ink },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 20, paddingTop: 20 },
  footerText: { fontFamily: serif, color: wood.ink, fontStyle: "italic" },
  footerLink: { fontFamily: serif, color: wood.ink, textDecorationLine: "underline" },
});
