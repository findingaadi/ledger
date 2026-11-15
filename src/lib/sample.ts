import type { CycleState } from "./use-cycle";

const env = (id: string, name: string, kind: string, allocated: number, spent: number) => ({ id, name, kind, allocated, spent, included: true });
const ENVELOPES = [
  env("1", "Council tax", "bill", 16000, 16000), env("2", "Energy", "bill", 7700, 15800), env("3", "Gym and leisure", "bill", 2350, 0),
  env("4", "Groceries", "flexible", 30000, 20400), env("5", "Fuel and transport", "flexible", 12000, 4900),
  env("6", "Eating out", "flexible", 16000, 17400), env("7", "Guilt-free", "guilt_free", 30000, 9800),
];

const noop = () => {};

/** Made-up numbers for the development-only preview pages. */
export const sampleCycle: CycleState = {
    cycle: { id: "sample", name: "November 2026", starts_at: "2026-10-23T08:00:00Z", ends_at: null },
    summary: { closed: false, assigned: true, income: 255000, carried_in: 0, left_to_assign: 0, guilt_free_left: 10700, unfiled: 0, envelopes: ENVELOPES },
    envelopes: ENVELOPES.map((e) => ({ id: e.id, name: e.name, kind: e.kind, default_amount: e.allocated })),
    amounts: Object.fromEntries(ENVELOPES.map((e) => [e.id, String(e.allocated / 100)])),
    included: Object.fromEntries(ENVELOPES.map((e) => [e.id, e.id !== "3"])),
    saved: true,
    manual: [{ id: "m", label: "Weekend shift", amount: 15000 }],
    left: 140950,
    message: "",
    reloadKey: 0,
    setAmount: noop, toggleIncluded: noop, sendRest: noop, changed: noop,
    save: async () => {}, reset: async () => {}, removeSide: async () => {}, addSide: async () => true,
  };
