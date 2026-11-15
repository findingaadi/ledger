/** Pence to "£12.34". Pass signed:true to prefix + or -. */
export const gbp = (pence: number, signed = false) =>
  (signed ? (pence < 0 ? "-" : "+") : pence < 0 ? "-" : "") +
  "£" + (Math.abs(pence) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
