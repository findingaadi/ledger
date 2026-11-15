import { useState } from "react";

import { OpenBook } from "@/components/open-book";
import { ShelfView, type BookRect, type ShelfBook } from "@/components/shelf-view";
import { sampleCycle } from "@/lib/sample";

const MONTHS = ["November", "October", "September", "August", "July", "June", "May", "April"];

/** Development only: the shelf and an openable book with sample data, so the look can be checked without signing in. */
export default function Preview() {
  const [open, setOpen] = useState<{ book: ShelfBook; rect: BookRect } | null>(null);
  if (!__DEV__) return null;
  const noop = () => {};
  return (
    <>
      <ShelfView
        books={MONTHS.map((month, i) => ({ id: String(i), month, year: "2026", glows: i === 0 }))}
        status="Sample data"
        onOpen={(book, rect) => setOpen({ book, rect })}
        onEnvelopes={noop}
        onTransactions={noop}
        onRefresh={noop}
        onSignOut={noop}
      />
      {open ? <OpenBook book={open.book} rect={open.rect} sample={sampleCycle} onClosed={() => setOpen(null)} /> : null}
    </>
  );
}
