import { Platform } from "react-native";

/** The retro bookshelf look: wood, leather, gold leaf and ledger paper. */
export const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" });

export const wood = {
  bar: ["#7d5230", "#5e3a1c", "#4a2c13"] as const,
  back: ["#6b4424", "#553418"] as const,
  plank: ["#b07c43", "#86562a", "#5f3a19"] as const,
  button: "#6a4424",
  buttonPressed: "#4a2c13",
  edge: "#2e1a0a",
  /** Lettering on wood. */
  ink: "#f1dfb4",
};

export const gold = { leaf: "#ecd084", glow: "rgba(255, 220, 120, 0.95)", ribbon: ["#ffe08a", "#e3a92c"] as const };

/** Leather colours, reused in order along the shelf. */
export const leathers = ["#6b1f1f", "#1f3a5f", "#24452f", "#7a5a16", "#4a2545", "#1f4f52"];
