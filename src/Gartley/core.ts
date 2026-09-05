import { round } from "@tradejs/core/math";
import {
  buildTradeEconomics,
  isStopLossOnCorrectSide,
} from "@tradejs/strategy-kit/risk";
import type {
  CreateStrategyCore,
  IndicatorsHistorySnapshot,
  Position,
} from "@tradejs/types";
import { GartleyConfig } from "./config";
import { buildGartleySignalContext, createGartleyEngine } from "./engine";
import { buildGartleyFigures } from "./figures";

const isOpenPosition = (position: Position | null): position is Position =>
  Boolean(
    position &&
    typeof position.price === "number" &&
    Number.isFinite(position.price) &&
    typeof position.qty === "number" &&
    Number.isFinite(position.qty) &&
    position.qty > 0 &&
    (position.direction === "LONG" || position.direction === "SHORT"),
  );

const latestFiniteNumber = (value: unknown): number | null => {
  if (!Array.isArray(value)) return null;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const candidate = Number(value[index]);
    if (Number.isFinite(candidate)) return candidate;
  }

  return null;
};

const buildGartleyStateKey = (config: GartleyConfig) =>
  JSON.stringify({
    pivotLength: config.GARTLEY_PIVOT_LENGTH,
    minAbRetracementRatio: config.GARTLEY_MIN_AB_RETRACEMENT_RATIO,
    maxAbRetracementRatio: config.GARTLEY_MAX_AB_RETRACEMENT_RATIO,
    minBcRetracementRatio: config.GARTLEY_MIN_BC_RETRACEMENT_RATIO,
    maxBcRetracementRatio: config.GARTLEY_MAX_BC_RETRACEMENT_RATIO,
    minCdExtensionRatio: config.GARTLEY_MIN_CD_EXTENSION_RATIO,
    maxCdExtensionRatio: config.GARTLEY_MAX_CD_EXTENSION_RATIO,
    minAdRetracementRatio: config.GARTLEY_MIN_AD_RETRACEMENT_RATIO,
    maxAdRetracementRatio: config.GARTLEY_MAX_AD_RETRACEMENT_RATIO,
    maxAbCdDeviationPct: config.GARTLEY_MAX_AB_CD_DEVIATION_PCT,
    targetXaFibPct: config.GARTLEY_TARGET_XA_FIB_PCT,
    stopXaFibPct: config.GARTLEY_STOP_XA_FIB_PCT,
    minXaHeightPct: config.GARTLEY_MIN_XA_HEIGHT_PCT,
    minXaHeightAtr: config.GARTLEY_MIN_XA_HEIGHT_ATR,
    atrPeriod: config.GARTLEY_ATR_PERIOD,
    minLegBars: config.GARTLEY_MIN_LEG_BARS,
    maxPatternAgeBars: config.GARTLEY_MAX_PATTERN_AGE_BARS,
    maxBreakoutAfterDBars: config.GARTLEY_MAX_BREAKOUT_AFTER_D_BARS,
    minBreakoutDistanceAtr: config.GARTLEY_MIN_BREAKOUT_DISTANCE_ATR,
    maxBreakoutDistanceXaRatio: config.GARTLEY_MAX_BREAKOUT_DISTANCE_XA_RATIO,
    entryMode: config.GARTLEY_ENTRY_MODE,
    confirmationMaxBars: config.GARTLEY_CONFIRMATION_MAX_BARS,
    retestMaxBars: config.GARTLEY_RETEST_MAX_BARS,
    retestToleranceAtr: config.GARTLEY_RETEST_TOLERANCE_ATR,
  });

export const createGartleyCore: CreateStrategyCore<
  GartleyConfig,
  IndicatorsHistorySnapshot | undefined
> = async ({ config, data: initialData, strategyApi, indicatorsState }) => {
  const detectorState = strategyApi.createStateController<
    { engine: ReturnType<typeof createGartleyEngine> },
    ReturnType<ReturnType<typeof createGartleyEngine>["next"]>,
    ReturnType<ReturnType<typeof createGartleyEngine>["getState"]>
  >(
    "Gartley",
    () => ({
      engine: createGartleyEngine({
        config,
        initialCandles: initialData,
      }),
    }),
    {
      configKey: buildGartleyStateKey(config),
      snapshot: (state) => state.engine.getState(),
    },
  );
  const lastTradeController = strategyApi.createLastTradeController({
    enabled: true,
  });
  const nextDetectorState = (
    candle: Parameters<ReturnType<typeof createGartleyEngine>["next"]>[0],
  ) =>
    detectorState.oncePerTimestamp(candle.timestamp, (state) =>
      state.engine.next(candle),
    );

  return async (candle) => {
    const runtimeState = nextDetectorState(candle);
    const pattern = runtimeState.pattern;
    if (!pattern) return strategyApi.skip("NO_PATTERN");

    const position = await strategyApi.getCurrentPosition();
    if (isOpenPosition(position)) {
      const oppositePattern = position.direction !== pattern.direction;
      if (Boolean(config.GARTLEY_EXIT_ON_OPPOSITE_PATTERN) && oppositePattern) {
        return strategyApi.exit({
          code: "GARTLEY_OPPOSITE_PATTERN_EXIT",
          direction: position.direction,
        });
      }
      return strategyApi.skip("POSITION_EXISTS");
    }

    if (lastTradeController.isInCooldown(candle.timestamp)) {
      return strategyApi.skip("DEV_TRADE_COOLDOWN");
    }

    const modeConfig =
      pattern.direction === "LONG" ? config.LONG : config.SHORT;
    if (!modeConfig.enable) return strategyApi.skip("STRATEGY_DISABLED");

    const { timestamp, currentPrice } =
      await strategyApi.getDecisionPriceContext();
    if (
      !isStopLossOnCorrectSide({
        direction: pattern.direction,
        currentPrice,
        stopLossPrice: pattern.stopLossPrice,
      })
    ) {
      return strategyApi.skip("INVALID_STOP");
    }

    const targetIsValid =
      pattern.direction === "LONG"
        ? pattern.targetPrice > currentPrice
        : pattern.targetPrice < currentPrice;
    if (!targetIsValid) return strategyApi.skip("TARGET_ALREADY_PASSED");

    const economics = buildTradeEconomics({
      entryPrice: currentPrice,
      stopLossPrice: pattern.stopLossPrice,
      takeProfitPrice: pattern.targetPrice,
      feeRate: Number(config.RISK_FEE_RATE ?? 0),
      slippageBps:
        Number(config.RISK_SLIPPAGE_BPS ?? 0) +
        Number(config.RISK_MARKET_IMPACT_BPS ?? 0),
    });
    const qty =
      economics.lossPerUnit > 0
        ? Number(config.MAX_LOSS_VALUE ?? 0) / economics.lossPerUnit
        : 0;
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return strategyApi.skip("INVALID_QTY");
    }

    const riskRatio = economics.netRiskRatio;
    if (riskRatio <= modeConfig.minRiskRatio) {
      return strategyApi.skip(`RISK_RATIO:${round(riskRatio)}`);
    }

    const indicators = indicatorsState.snapshot() ?? {};
    const latestMacdHistogram = latestFiniteNumber(indicators.macdHistogram);
    const latestMaSlow = latestFiniteNumber(indicators.maSlow);
    const longMomentumConfirmed =
      latestMacdHistogram != null && latestMacdHistogram > 0;
    const shortTrendConfirmed =
      latestMaSlow != null && currentPrice < latestMaSlow;

    if (
      pattern.direction === "LONG" &&
      config.GARTLEY_LONG_REQUIRE_POSITIVE_MACD_HISTOGRAM &&
      !longMomentumConfirmed
    ) {
      return strategyApi.skip("LONG_MACD_HISTOGRAM_NOT_POSITIVE");
    }
    if (
      pattern.direction === "SHORT" &&
      config.GARTLEY_SHORT_REQUIRE_PRICE_BELOW_MA_SLOW &&
      !shortTrendConfirmed
    ) {
      return strategyApi.skip("SHORT_PRICE_NOT_BELOW_MA_SLOW");
    }

    const signalContext = {
      ...buildGartleySignalContext({ ...pattern, close: currentPrice }),
      executionEconomics: {
        grossRiskRatio: economics.grossRiskRatio,
        netRiskRatio: economics.netRiskRatio,
        lossPerUnit: economics.lossPerUnit,
        rewardPerUnit: economics.rewardPerUnit,
      },
      directionalFilter: {
        latestMacdHistogram,
        latestMaSlow,
        longMomentumConfirmed,
        shortTrendConfirmed,
      },
    };
    lastTradeController.markTrade(timestamp);

    return strategyApi.entry({
      code:
        pattern.direction === "LONG"
          ? `GARTLEY_BULLISH_${pattern.entryStage.toUpperCase()}`
          : `GARTLEY_BEARISH_${pattern.entryStage.toUpperCase()}`,
      direction: modeConfig.direction,
      indicators,
      additionalIndicators: { gartleyContext: signalContext },
      figures: buildGartleyFigures({
        pattern,
        entryTimestamp: timestamp,
        entryPrice: currentPrice,
      }),
      orderPlan: {
        qty,
        stopLossPrice: pattern.stopLossPrice,
        takeProfits: [{ rate: 1, price: pattern.targetPrice }],
      },
    });
  };
};
