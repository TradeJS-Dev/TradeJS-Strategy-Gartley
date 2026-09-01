import { GartleyPattern } from "../engine";
import { buildGartleyFigures } from "../figures";

describe("Gartley figures", () => {
  it("renders XABCD, AB/CD comparison, confirmation, target, stop and entry", () => {
    const pattern: GartleyPattern = {
      setupId: "bullish-gartley-1",
      kind: "bullish_gartley",
      direction: "LONG",
      entryMode: "close_acceptance",
      entryStage: "close_accepted",
      pivots: [
        { timestamp: 1, index: 0, value: 100, kind: "low", traded: false },
        { timestamp: 2, index: 1, value: 120, kind: "high", traded: false },
        { timestamp: 3, index: 2, value: 107.64, kind: "low", traded: false },
        {
          timestamp: 4,
          index: 3,
          value: 117.35496,
          kind: "high",
          traded: false,
        },
        { timestamp: 5, index: 4, value: 104.28, kind: "low", traded: true },
      ],
      confirmationPrice: 107.64,
      targetPrice: 116.64,
      stopLossPrice: 99,
      xaLength: 20,
      xaHeightAtr: 4,
      patternAgeBars: 6,
      breakoutAfterDBars: 2,
      xToABars: 1,
      aToBBars: 1,
      bToCBars: 1,
      cToDBars: 1,
      abRetracementRatio: 0.618,
      bcRetracementRatio: 0.786,
      cdExtensionRatio: 1.346,
      adRetracementRatio: 0.786,
      abCdRatio: 1.058,
      abCdDeviationPct: 5.8,
      breakoutDistancePct: 0.33,
      breakoutDistanceAtr: 0.2,
      breakoutDistanceXaRatio: 0.018,
      breakoutTimestamp: 6,
      confirmationBars: 1,
      timestamp: 7,
      close: 108,
    };

    const figures = buildGartleyFigures({
      pattern,
      entryTimestamp: 7,
      entryPrice: 108,
    });

    expect(figures.lines).toHaveLength(6);
    expect(figures.points).toHaveLength(2);
    expect(figures.lines?.map((line) => line.kind)).toEqual([
      "gartley_bullish_gartley_pattern",
      "gartley_ab_leg",
      "gartley_cd_leg",
      "gartley_b_confirmation",
      "gartley_target",
      "gartley_stop",
    ]);
    expect(figures.points?.[0]?.points).toHaveLength(5);
  });
});
