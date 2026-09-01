/** @jest-environment node */

import { createTestStateController } from "../../testUtils/stateControllerTestUtils";
import { config as DEFAULT_CONFIG } from "../config";
import { createGartleyCore } from "../core";
import { makeBullishGartleyCandles } from "./engine.test";

const makeConfig = () =>
  ({
    ...DEFAULT_CONFIG,
    GARTLEY_PIVOT_LENGTH: 1,
    GARTLEY_MIN_XA_HEIGHT_PCT: 0,
    GARTLEY_MIN_XA_HEIGHT_ATR: 0,
    GARTLEY_MIN_BREAKOUT_DISTANCE_ATR: 0,
    GARTLEY_MAX_BREAKOUT_DISTANCE_XA_RATIO: 1,
    GARTLEY_ENTRY_MODE: "breakout",
    LONG: { ...DEFAULT_CONFIG.LONG, minRiskRatio: 0.5 },
    SHORT: { ...DEFAULT_CONFIG.SHORT, minRiskRatio: 0.5 },
  }) as any;

const mirrorCandles = (candles: ReturnType<typeof makeBullishGartleyCandles>) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

const makeIndicatorsState = () =>
  ({
    setCurrentBar: jest.fn(),
    next: jest.fn(),
    onBar: jest.fn(),
    ensureInitializedWithCurrentBar: jest.fn(),
    snapshot: jest.fn(() => ({ baseContext: {} })),
    latestNumber: jest.fn(() => undefined),
    isInitialized: jest.fn(() => true),
  }) as any;

const makeStrategyApi = ({
  marketData,
  currentPosition = null,
}: {
  marketData: any;
  currentPosition?: any;
}) =>
  ({
    skip: (code: string) => ({ kind: "skip", code }),
    getDecisionPriceContext: jest.fn(async () => ({
      timestamp: marketData.timestamp,
      currentPrice: marketData.currentPrice,
      candle: marketData.lastCandle,
    })),
    getCurrentPosition: jest.fn(async () => currentPosition),
    createLastTradeController: jest.fn(() => ({
      isInCooldown: () => false,
      markTrade: jest.fn(),
      getLastTradeTimestamp: () => null,
    })),
    createStateController: createTestStateController(),
    entry: jest.fn(async (params: any) => ({
      kind: "entry",
      code: params.code,
      entryContext: {
        strategy: "Gartley",
        symbol: "TESTUSDT",
        interval: "15",
        direction: params.direction,
        timestamp: marketData.timestamp,
        prices: {
          currentPrice: marketData.currentPrice,
          takeProfitPrice: params.orderPlan.takeProfits[0].price,
          stopLossPrice: params.orderPlan.stopLossPrice,
          riskRatio: 1,
        },
        isConfigFromBacktest: false,
      },
      orderPlan: params.orderPlan,
      signal: {
        signalId: "gartley-test-signal",
        strategy: "Gartley",
        symbol: "TESTUSDT",
        interval: "15",
        direction: params.direction,
        timestamp: marketData.timestamp,
        figures: params.figures ?? {},
        prices: {
          currentPrice: marketData.currentPrice,
          takeProfitPrice: params.orderPlan.takeProfits[0].price,
          stopLossPrice: params.orderPlan.stopLossPrice,
          riskRatio: 1,
        },
        indicators: params.indicators ?? {},
        additionalIndicators: params.additionalIndicators,
      },
    })),
    exit: jest.fn(async (params: any) => ({
      kind: "exit",
      code: params.code,
      closePlan: {
        direction: params.direction,
        price: marketData.currentPrice,
        timestamp: marketData.timestamp,
      },
    })),
  }) as any;

describe("Gartley core", () => {
  it("creates a long entry with XABCD figures on a bullish Gartley", async () => {
    const candles = makeBullishGartleyCandles();
    const currentCandle = candles[candles.length - 1]!;
    const marketData = {
      timestamp: currentCandle.timestamp,
      currentPrice: currentCandle.close,
      lastCandle: currentCandle,
    };
    const core = await createGartleyCore({
      config: makeConfig(),
      data: candles.slice(0, -1) as any,
      strategyApi: makeStrategyApi({ marketData }),
      indicatorsState: makeIndicatorsState(),
    });

    const result = await core(currentCandle as any, currentCandle as any);

    expect(result.kind).toBe("entry");
    expect((result as any).code).toBe("GARTLEY_BULLISH_BREAKOUT");
    expect((result as any).entryContext.direction).toBe("LONG");
    expect((result as any).signal.figures.lines).toHaveLength(6);
    expect(
      (result as any).signal.additionalIndicators.gartleyContext.patternKind,
    ).toBe("bullish_gartley");
  });

  it("exits an existing long on a bearish Gartley", async () => {
    const candles = mirrorCandles(makeBullishGartleyCandles());
    const currentCandle = candles[candles.length - 1]!;
    const marketData = {
      timestamp: currentCandle.timestamp,
      currentPrice: currentCandle.close,
      lastCandle: currentCandle,
    };
    const core = await createGartleyCore({
      config: makeConfig(),
      data: candles.slice(0, -1) as any,
      strategyApi: makeStrategyApi({
        marketData,
        currentPosition: { direction: "LONG", price: 110, qty: 1 },
      }),
      indicatorsState: makeIndicatorsState(),
    });

    const result = await core(currentCandle as any, currentCandle as any);
    expect(result).toMatchObject({
      kind: "exit",
      code: "GARTLEY_OPPOSITE_PATTERN_EXIT",
    });
  });
});
