import { ShelfView } from "@/components/shelf-view";

const MONTHS = ["November", "October", "September", "August", "July", "June", "May", "April"];

/** Development only: the shelf with sample books, so its look can be checked without signing in. */
export default function Preview() {
  if (!__DEV__) return null;
  const noop = () => {};
  return (
    <ShelfView
      books={MONTHS.map((month, i) => ({ id: String(i), month, year: "2026", glows: i === 0 }))}
      status="Sample data"
      onOpen={noop}
      onEnvelopes={noop}
      onTransactions={noop}
      onRefresh={noop}
      onSignOut={noop}
    />
  );
}
