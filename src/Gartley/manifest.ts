import { StrategyManifest } from "@tradejs/types";
import { gartleyAiAdapter } from "./adapters/ai";

export const gartleyManifest: StrategyManifest = {
  name: "Gartley",
  aiAdapter: gartleyAiAdapter,
};
