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

  const applyLocalGate = ({
    direction,
    currentPrice = 100,
    macdHistogram,
    maSlow,
  }: {
    direction: "LONG" | "SHORT";
    currentPrice?: number;
    macdHistogram?: unknown;
    maSlow?: unknown;
  }) =>
    gartleyAiAdapter.postProcessLocalAnalysis!({
      signal: {
        direction,
        prices: {
          currentPrice,
          takeProfitPrice: direction === "LONG" ? 110 : 90,
          stopLossPrice: direction === "LONG" ? 95 : 105,
        },
      },
      payload: {
        indicators: { macdHistogram, maSlow },
      },
      analysis: { quality: 3 },
    } as any) as any;

  it("approves LONG only above the MACD histogram boundary", () => {
    expect(
      applyLocalGate({ direction: "LONG", macdHistogram: [-1, 0.000001] }),
    ).toMatchObject({
      approved: true,
      direction: "LONG",
      quality: 4,
      gateDecision: "approved",
    });

    for (const macdHistogram of [[-1, 0], [-1], [], undefined, null]) {
      expect(
        applyLocalGate({ direction: "LONG", macdHistogram }),
      ).toMatchObject({
        approved: false,
        direction: null,
        quality: 3,
        gateDecision: "rejected",
      });
    }
  });

  it("approves SHORT only below the latest slow average", () => {
    expect(
      applyLocalGate({ direction: "SHORT", currentPrice: 100, maSlow: [101] }),
    ).toMatchObject({
      approved: true,
      direction: "SHORT",
      quality: 4,
      gateDecision: "approved",
    });

    for (const maSlow of [[100], [99], [], undefined, null]) {
      expect(
        applyLocalGate({ direction: "SHORT", currentPrice: 100, maSlow }),
      ).toMatchObject({
        approved: false,
        direction: null,
        quality: 3,
        gateDecision: "rejected",
      });
    }
  });

  it("does not let SHORT trend context approve LONG", () => {
    expect(
      applyLocalGate({
        direction: "LONG",
        currentPrice: 90,
        maSlow: [100],
        macdHistogram: [-0.1],
      }),
    ).toMatchObject({ approved: false, gateDecision: "rejected" });
  });
});
