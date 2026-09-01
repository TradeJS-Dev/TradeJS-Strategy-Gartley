import { defineStrategyPlugin } from "@tradejs/core/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type { StrategyConfig } from "@tradejs/types";
import { config as gartleyDefaultConfig } from "./Gartley/config";
import { GartleyStrategyDefinition } from "./Gartley/strategy";

export const strategyEntries: ValidatedStrategyRegistryEntry<any>[] = [
  GartleyStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  Gartley: gartleyDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export { GartleyStrategyDefinition } from "./Gartley/strategy";
export { gartleyDefaultConfig };
export { gartleyManifest } from "./Gartley/manifest";
export { gartleyAiAdapter } from "./Gartley/adapters/ai";

export default defineStrategyPlugin({ strategyEntries });
