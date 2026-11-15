import { BookView } from "@/components/book-view";
import { sampleCycle } from "@/lib/sample";

/** Development only: an open book with sample numbers, so the pages can be checked without signing in. */
export default function PreviewBook() {
  if (!__DEV__) return null;
  return <BookView state={sampleCycle} onClose={() => {}} />;
}
