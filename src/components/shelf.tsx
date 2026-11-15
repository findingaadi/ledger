import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { OpenBook } from "@/components/open-book";
import { ShelfView, type BookRect, type ShelfBook } from "@/components/shelf-view";
import { loadCycles, loadSummary } from "@/lib/cycles";
import { syncTransactions } from "@/lib/monzo";

/** Signed-in home: syncs with Monzo, then shows the pay cycles as books on the shelf. */
export function Shelf({ onSignOut }: { onSignOut: () => void }) {
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [status, setStatus] = useState("Syncing with Monzo…");
  const [open, setOpen] = useState<{ book: ShelfBook; rect: BookRect } | null>(null);

  const load = useCallback(async () => {
    try {
      await syncTransactions((n) => setStatus(`Syncing with Monzo… ${n} transactions`));
      const cycles = await loadCycles();
      // The newest book glows when money is unassigned or transactions are unfiled.
      const newest = cycles[0] ? await loadSummary(cycles[0].id) : null;
      const glows = Boolean(newest && (newest.left_to_assign !== 0 || newest.unfiled > 0));
      setBooks(cycles.map((c, i) => {
        const [month, year] = c.name.split(" ");
        return { id: c.id, month, year, glows: i === 0 && glows };
      }));
      setStatus(cycles.length ? "" : "No salary payment found yet.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data on mount; state is set after the request
    load();
  }, [load]);

  return (
    <>
      <ShelfView
      books={books}
      status={status}
      onOpen={(book, rect) => setOpen({ book, rect })}
      onEnvelopes={() => router.push("/envelopes")}
      onTransactions={() => router.push("/transactions")}
      onRefresh={() => {
        setStatus("Syncing with Monzo…");
        load();
      }}
      onSignOut={onSignOut}
      />
      {open ? (
        // On Android the shelf's top bar could draw over the open book, hiding the book's own
        // Shelf button; this layer sits above everything on the shelf.
        <View style={styles.bookLayer}>
        <OpenBook
          key={open.book.id}
          book={open.book}
          rect={open.rect}
          onClosed={() => {
            setOpen(null);
            load(); // what was done inside the book may have cleared its glow
          }}
        />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bookLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 },
});
