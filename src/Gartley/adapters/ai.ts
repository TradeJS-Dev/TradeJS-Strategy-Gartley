import { mapAiRuntimeFromConfig } from "@tradejs/core/strategies";
import type { StrategyAiAdapter } from "@tradejs/types";
import type { GartleyConfig } from "../config";

export const gartleyAiAdapter: StrategyAiAdapter = {
  buildPayload: ({ signal, basePayload }) => {
    const baseAdditional =
      (basePayload.additionalIndicators as
        Record<string, unknown> | undefined) ?? {};

    return {
      ...basePayload,
      additionalIndicators: {
        ...baseAdditional,
        gartleyContext: (
          signal.additionalIndicators as Record<string, unknown> | undefined
        )?.gartleyContext,
      },
    };
  },
  buildHumanPromptAddon: ({ payload }) => {
    const additional =
      (payload.additionalIndicators as Record<string, unknown> | undefined) ??
      {};
    const context =
      (additional.gartleyContext as Record<string, unknown> | undefined) ?? {};

    return `
Additional Gartley context:
- patternKind=${String(context.patternKind ?? "n/a")}
- signalDirection=${String(context.signalDirection ?? "n/a")}
- entryStage=${String(context.entryStage ?? "n/a")}
- confirmationPrice=${String(context.confirmationPrice ?? "n/a")}
- abRetracementRatio=${String(context.abRetracementRatio ?? "n/a")}
- bcRetracementRatio=${String(context.bcRetracementRatio ?? "n/a")}
- cdExtensionRatio=${String(context.cdExtensionRatio ?? "n/a")}
- adRetracementRatio=${String(context.adRetracementRatio ?? "n/a")}
- abCdDeviationPct=${String(context.abCdDeviationPct ?? "n/a")}
- breakoutDistanceXaRatio=${String(context.breakoutDistanceXaRatio ?? "n/a")}
- targetPrice=${String(context.targetPrice ?? "n/a")}
- stopLossPrice=${String(context.stopLossPrice ?? "n/a")}
- pivots=${JSON.stringify(context.pivots ?? [])}

Interpretation rules for Gartley:
- A bullish pattern is low X, high A, low B, high C, low D, followed by a close above B.
- A bearish pattern is the exact mirror image and confirms below B.
- B is expected near a 0.618 retracement of XA, D near a 0.786 retracement of XA, and AB should be close to CD.
- BC and CD ratios validate the harmonic geometry; they are not independent entry signals.
- Prefer a fresh B-level confirmation and reject analysis that contradicts the signal direction.
`.trim();
  },
  mapEntryRuntimeFromConfig: (config) =>
    mapAiRuntimeFromConfig(
      config as Pick<
        GartleyConfig,
        "AI_ENABLED" | "AI_MODE" | "MIN_AI_QUALITY"
      >,
    ),
};
