import { gartleyAiAdapter } from "../adapters/ai";

describe("gartleyAiAdapter", () => {
  it("carries Gartley geometry into the AI payload and prompt", () => {
    const context = {
      patternKind: "bullish_gartley",
      signalDirection: "LONG",
      abRetracementRatio: 0.618,
      adRetracementRatio: 0.786,
      abCdDeviationPct: 5.8,
      pivots: [{ role: "x", value: 100 }],
    };
    const payload = gartleyAiAdapter.buildPayload!({
      signal: { additionalIndicators: { gartleyContext: context } },
      basePayload: {
        additionalIndicators: { baseContext: { available: true } },
      },
    } as any);

    expect((payload.additionalIndicators as any).gartleyContext).toEqual(
      context,
    );
    expect((payload.additionalIndicators as any).baseContext).toEqual({
      available: true,
    });

    const prompt = gartleyAiAdapter.buildHumanPromptAddon!({ payload } as any);
    expect(prompt).toContain("patternKind=bullish_gartley");
    expect(prompt).toContain("abRetracementRatio=0.618");
    expect(prompt).toContain("adRetracementRatio=0.786");
    expect(prompt).toContain("abCdDeviationPct=5.8");
  });
});
