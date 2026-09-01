/** @jest-environment node */

import { config as DEFAULT_CONFIG } from "../config";
import { createGartleyEngine } from "../engine";

const makeCandle = (
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
) => ({
  timestamp: 1_700_000_000_000 + index * 60_000,
  dt: new Date(1_700_000_000_000 + index * 60_000).toISOString(),
  open,
  high,
  low,
  close,
  volume: 1_000,
  turnover: close * 1_000,
});

const makeConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    ...DEFAULT_CONFIG,
    GARTLEY_PIVOT_LENGTH: 1,
    GARTLEY_MIN_XA_HEIGHT_PCT: 0,
    GARTLEY_MIN_XA_HEIGHT_ATR: 0,
    GARTLEY_MIN_BREAKOUT_DISTANCE_ATR: 0,
    GARTLEY_MAX_BREAKOUT_DISTANCE_XA_RATIO: 1,
    GARTLEY_ENTRY_MODE: "breakout",
    ...overrides,
  }) as any;

export const makeBullishGartleyCandles = () => [
  makeCandle(0, 105, 106, 104, 105),
  makeCandle(1, 101, 102, 100, 101),
  makeCandle(2, 106, 110, 105, 109),
  makeCandle(3, 119, 120, 118, 119),
  makeCandle(4, 113, 115, 111, 112),
  makeCandle(5, 108, 109, 107.64, 108),
  makeCandle(6, 112, 114, 110, 113),
  makeCandle(7, 116, 117.35496, 115, 116),
  makeCandle(8, 110, 112, 108, 109),
  makeCandle(9, 105, 106, 104.28, 105),
  makeCandle(10, 106, 107, 105, 106.5),
  makeCandle(11, 107, 109, 106, 108),
];

const mirrorCandles = (candles: ReturnType<typeof makeBullishGartleyCandles>) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

describe("Gartley engine", () => {
  it("detects a bullish classical Gartley after the B-level break", () => {
    const engine = createGartleyEngine({ config: makeConfig() });
    const states = makeBullishGartleyCandles().map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bullish_gartley");
    expect(pattern?.direction).toBe("LONG");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      100, 120, 107.64, 117.35496, 104.28,
    ]);
    expect(pattern?.abRetracementRatio).toBeCloseTo(0.618);
    expect(pattern?.bcRetracementRatio).toBeCloseTo(0.786);
    expect(pattern?.cdExtensionRatio).toBeCloseTo(1.346);
    expect(pattern?.adRetracementRatio).toBeCloseTo(0.786);
    expect(pattern?.abCdDeviationPct).toBeCloseTo(5.785, 2);
    expect(pattern?.confirmationPrice).toBeCloseTo(107.64);
    expect(pattern?.targetPrice).toBeCloseTo(116.64);
    expect(pattern?.stopLossPrice).toBeCloseTo(99);
  });

  it("detects the mirrored bearish Gartley", () => {
    const engine = createGartleyEngine({ config: makeConfig() });
    const states = mirrorCandles(makeBullishGartleyCandles()).map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bearish_gartley");
    expect(pattern?.direction).toBe("SHORT");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      120, 100, 112.36, 102.64504, 115.72,
    ]);
    expect(pattern?.abRetracementRatio).toBeCloseTo(0.618);
    expect(pattern?.adRetracementRatio).toBeCloseTo(0.786);
    expect(pattern?.targetPrice).toBeLessThan(pattern?.close ?? 0);
    expect(pattern?.stopLossPrice).toBeGreaterThan(pattern?.close ?? Infinity);
  });

  it("rejects B outside the configured XA retracement band", () => {
    const candles = makeBullishGartleyCandles();
    candles[5] = makeCandle(5, 106, 108, 105, 106);
    const engine = createGartleyEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects C outside the configured AB retracement band", () => {
    const candles = makeBullishGartleyCandles();
    candles[7] = makeCandle(7, 118, 119, 117, 118);
    const engine = createGartleyEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects D outside the configured XA completion band", () => {
    const candles = makeBullishGartleyCandles();
    candles[9] = makeCandle(9, 103, 104, 102, 103);
    candles[10] = makeCandle(10, 104, 107, 103, 106.5);
    const engine = createGartleyEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("enforces AB approximately equal to CD independently of the other ratios", () => {
    const candles = makeBullishGartleyCandles();
    candles[6] = makeCandle(6, 110, 111, 109.5, 110.5);
    candles[7] = makeCandle(7, 112, 112.584, 111.5, 112);
    candles[8] = makeCandle(8, 109, 110, 108, 109);
    candles[9] = makeCandle(9, 106, 107, 105.6, 106);
    candles[10] = makeCandle(10, 106.5, 107, 106, 106.5);

    const strictEngine = createGartleyEngine({ config: makeConfig() });
    const strictState = candles.reduce(
      (_, candle) => strictEngine.next(candle as any),
      strictEngine.getState(),
    );
    expect(strictState.pattern).toBeNull();

    const relaxedEngine = createGartleyEngine({
      config: makeConfig({ GARTLEY_MAX_AB_CD_DEVIATION_PCT: 50 }),
    });
    const relaxedState = candles.reduce(
      (_, candle) => relaxedEngine.next(candle as any),
      relaxedEngine.getState(),
    );
    expect(relaxedState.pattern?.abCdDeviationPct).toBeGreaterThan(40);
  });

  it("waits for close acceptance and emits the setup only once", () => {
    const engine = createGartleyEngine({
      config: makeConfig({
        GARTLEY_ENTRY_MODE: "close_acceptance",
        GARTLEY_CONFIRMATION_MAX_BARS: 2,
      }),
    });
    const history = makeBullishGartleyCandles();
    const breakoutState = history.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(breakoutState.pattern).toBeNull();
    expect(breakoutState.pending?.stage).toBe("b_level_crossed");

    const confirmation = makeCandle(12, 108, 110, 107, 109);
    const accepted = engine.next(confirmation as any);
    expect(accepted.pattern?.entryStage).toBe("close_accepted");
    expect(accepted.pattern?.confirmationBars).toBe(1);

    expect(engine.next(confirmation as any)).toEqual(accepted);
    expect(
      engine.next(makeCandle(13, 109, 111, 108, 110) as any).pattern,
    ).toBeNull();
  });

  it("rebuilds a pending setup identically from initial candles", () => {
    const config = makeConfig({ GARTLEY_ENTRY_MODE: "close_acceptance" });
    const history = makeBullishGartleyCandles();
    const confirmation = makeCandle(12, 108, 110, 107, 109);
    const continuous = createGartleyEngine({ config });
    for (const candle of history) continuous.next(candle as any);
    const continuousState = continuous.next(confirmation as any);

    const restored = createGartleyEngine({
      config,
      initialCandles: history as any,
    });
    expect(restored.next(confirmation as any)).toEqual(continuousState);
  });
});
