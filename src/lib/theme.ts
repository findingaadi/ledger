import { Platform } from "react-native";

/** The retro bookshelf look: wood, leather, gold leaf and ledger paper. */
export const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" });

export const wood = {
  light: "#e9c58c",
  mid: "#c9995a",
  dark: "#b98346",
  edge: "#7a4f22",
  ink: "#5a3610",
  back: ["#d6a565", "#c48f4f"] as const,
  plank: ["#f0cf97", "#d9ab6b", "#b57d3d"] as const,
};

export const gold = { leaf: "#ecd084", glow: "rgba(255, 220, 120, 0.95)", ribbon: ["#ffe08a", "#e3a92c"] as const };

/** Leather colours, reused in order along the shelf. */
export const leathers = ["#6b1f1f", "#1f3a5f", "#24452f", "#7a5a16", "#4a2545", "#1f4f52"];
