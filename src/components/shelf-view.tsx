import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Grain, WOOD_ACROSS, WOOD_UPRIGHT, WoodBar, WoodButton } from "@/components/wood";
import { gold, leathers, serif, wood } from "@/lib/theme";

const LEATHER = require("@/assets/textures/leather.png");

export type ShelfBook = { id: string; month: string; year: string; glows?: boolean };
/** Where a book's cover sits in the window, and its leather colour. */
export type BookRect = { x: number; y: number; width: number; height: number; color: string };

type Props = {
  books: ShelfBook[];
  status?: string;
  onOpen: (book: ShelfBook, rect: BookRect) => void;
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
      <Grain source={WOOD_UPRIGHT} opacity={0.5} />

      <WoodBar title="Kharcha" left={<WoodButton label="Envelopes" onPress={onEnvelopes} />} right={<WoodButton label="Transactions" onPress={onTransactions} />} />

      <View style={styles.strip}>
        <Text style={styles.stripStatus} numberOfLines={1}>
          {status}
        </Text>
        <Text style={styles.stripLink} onPress={onRefresh}>
          Refresh
        </Text>
        <Text style={styles.stripLink} onPress={onSignOut}>
          Sign out
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={{ width: shelfWidth, alignSelf: "center" }}>
          {rows.map((row, r) => (
            <View key={r} style={[styles.row, { height: bookHeight + 50 }]}>
              <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]} style={styles.rowShade} />
              <View style={styles.books}>
                {Array.from({ length: PER_ROW }, (_, k) => {
                  const book = row[k];
                  return book ? (
                    <Book key={book.id} book={book} color={leathers[(r * PER_ROW + k) % leathers.length]} width={bookWidth} height={bookHeight} onPress={(rect) => onOpen(book, rect)} />
                  ) : (
                    <View key={k} style={{ width: bookWidth }} />
                  );
                })}
              </View>
              <LinearGradient colors={wood.plank} locations={[0, 0.22, 1]} style={styles.plank}>
                <Grain source={WOOD_ACROSS} opacity={0.5} />
                <View style={styles.plankHighlight} />
                <View style={styles.plankLip} />
              </LinearGradient>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

/** A book's front cover. Used on the shelf and by the opening animation. */
export function BookCover({ month, year, color, width }: { month: string; year: string; color: string; width: number }) {
  return (
    <View style={[styles.cover, { backgroundColor: color }]}>
      <Grain source={LEATHER} opacity={0.8} />
      <View style={styles.spine}>
        <View style={[styles.band, { top: "7%" }]} />
        <View style={[styles.band, { top: "10%" }]} />
        <View style={[styles.band, { bottom: "10%" }]} />
        <View style={[styles.band, { bottom: "7%" }]} />
      </View>
      <View style={styles.hinge} />
      <View style={styles.frame}>
        <View style={styles.innerFrame}>
          <Stud style={{ top: -3, left: -3 }} />
          <Stud style={{ top: -3, right: -3 }} />
          <Stud style={{ bottom: -3, left: -3 }} />
          <Stud style={{ bottom: -3, right: -3 }} />
          <Text style={[styles.month, { fontSize: Math.min(width * 0.125, (width - 46) / (month.length * 0.68)) }]} numberOfLines={1}>
            {month}
          </Text>
          <View style={styles.emblem}>
            <View style={styles.emblemDiamond} />
          </View>
          <Text style={[styles.year, { fontSize: Math.max(11, width * 0.125) }]}>{year}</Text>
        </View>
      </View>
    </View>
  );
}

function Book({ book, color, width, height, onPress }: { book: ShelfBook; color: string; width: number; height: number; onPress: (rect: BookRect) => void }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
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

  // Report where the cover sits on screen, so the opening animation can start from there.
  const open = () => ref.current?.measureInWindow((x: number, y: number, w: number, h: number) => onPress({ x, y, width: w - 3, height: h, color }));

  return (
    <Pressable ref={ref} onPress={open} style={{ width, height }} accessibilityRole="button" accessibilityLabel={`${book.month} ${book.year}${book.glows ? ", needs attention" : ""}`}>
      {book.glows ? (
        <Animated.View style={[styles.halo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
      ) : null}
      <View style={styles.pages} />
      <View style={styles.coverSlot}>
        <BookCover month={book.month} year={book.year} color={color} width={width} />
      </View>
      {book.glows ? (
        <LinearGradient colors={gold.ribbon} style={styles.ribbon}>
          <Text style={styles.ribbonText}>To do</Text>
        </LinearGradient>
      ) : null}
    </Pressable>
  );
}

/** A small gold stud on a corner of the cover's frame. */
function Stud({ style }: { style: object }) {
  return <View style={[styles.stud, style]} />;
}

const fill = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" } as const;
const goldLine = "rgba(232,198,106,0.8)";

const styles = StyleSheet.create({
  screen: { flex: 1, alignSelf: "stretch" },
  grain: fill,
  row: { justifyContent: "flex-end" },
  rowShade: { position: "absolute", top: 0, left: 0, right: 0, height: 46 },
  books: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", paddingHorizontal: 14 },
  plank: { height: 22, boxShadow: "0 9px 12px rgba(0,0,0,0.6)", overflow: "hidden" },
  plankHighlight: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(255,225,170,0.35)" },
  plankLip: { position: "absolute", bottom: 0, left: 0, right: 0, height: 5, backgroundColor: "rgba(0,0,0,0.3)" },
  halo: { ...fill, borderRadius: 5, boxShadow: `0 0 18px 8px ${gold.glow}` },
  // The page block peeking out on the right-hand edge.
  pages: { position: "absolute", top: 3, bottom: 2, right: 0, width: 6, backgroundColor: "#efe3c4", borderTopRightRadius: 2, borderBottomRightRadius: 2, borderRightWidth: 1, borderRightColor: "#bfae86" },
  coverSlot: { flex: 1, marginRight: 3, boxShadow: "5px 4px 8px rgba(0,0,0,0.65)", borderRadius: 4 },
  cover: {
    flex: 1, borderTopRightRadius: 4, borderBottomRightRadius: 4, borderTopLeftRadius: 2, borderBottomLeftRadius: 2,
    overflow: "hidden",
  },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 10, backgroundColor: "rgba(0,0,0,0.38)" },
  band: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: goldLine },
  hinge: { position: "absolute", left: 10, top: 0, bottom: 0, width: 3, backgroundColor: "rgba(255,255,255,0.10)", borderRightWidth: 1, borderRightColor: "rgba(0,0,0,0.35)" },
  frame: { flex: 1, marginLeft: 19, marginRight: 6, marginVertical: 7, borderWidth: 2, borderColor: goldLine, padding: 3 },
  innerFrame: { flex: 1, borderWidth: 1, borderColor: "rgba(232,198,106,0.55)", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 2 },
  stud: { position: "absolute", width: 5, height: 5, backgroundColor: gold.leaf, transform: [{ rotate: "45deg" }] },
  month: { fontFamily: serif, fontWeight: "bold", color: gold.leaf, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  emblem: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: goldLine, alignItems: "center", justifyContent: "center" },
  emblemDiamond: { width: 9, height: 9, backgroundColor: gold.leaf, transform: [{ rotate: "45deg" }] },
  year: { fontFamily: serif, color: gold.leaf, letterSpacing: 2, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  ribbon: { position: "absolute", top: -6, right: 12, paddingHorizontal: 5, paddingTop: 9, paddingBottom: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, boxShadow: "0 2px 3px rgba(0,0,0,0.5)" },
  ribbonText: { fontFamily: serif, fontSize: 10, fontWeight: "bold", color: "#5a3610" },
  strip: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "rgba(0,0,0,0.28)" },
  stripStatus: { flex: 1, fontFamily: serif, fontSize: 12, fontStyle: "italic", color: wood.ink, opacity: 0.85 },
  stripLink: { fontFamily: serif, fontSize: 13, color: wood.ink, textDecorationLine: "underline" },
});
