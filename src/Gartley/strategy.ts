import { createCostIsolatedStrategyConfigParser } from "@tradejs/strategy-kit/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import { config as DEFAULT_CONFIG, GartleyConfig } from "./config";
import { createGartleyCore } from "./core";
import { gartleyManifest } from "./manifest";

export const GartleyStrategyDefinition: ValidatedStrategyRegistryEntry<GartleyConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: createCostIsolatedStrategyConfigParser({
      strategyName: "Gartley",
      defaults: DEFAULT_CONFIG,
    }),
    createCore: createGartleyCore,
    manifest: gartleyManifest,
  };
