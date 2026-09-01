import { FEE_PERCENT } from "@tradejs/core/constants";
import {
  BacktestPriceMode,
  Direction,
  Interval,
  StrategyConfig,
} from "@tradejs/types";

export interface GartleySideConfig {
  enable: boolean;
  direction: Direction;
  minRiskRatio: number;
}

export type GartleyEntryMode = "breakout" | "close_acceptance" | "retest";

export const config = {
  ENV: "BACKTEST",
  INTERVAL: "15" as Interval,
  MAKE_ORDERS: true,
  CLOSE_OPPOSITE_POSITIONS: false,
  BACKTEST_PRICE_MODE: "open" as const,
  AI_ENABLED: false,
  AI_MODE: "llm" as const,
  ML_ENABLED: false,
  ML_THRESHOLD: 0.1,
  MIN_AI_QUALITY: 4,
  FEE_PERCENT,
  MAX_LOSS_VALUE: 10,
  MA_FAST: 14,
  MA_MEDIUM: 49,
  MA_SLOW: 50,
  OBV_SMA: 10,
  ATR: 14,
  ATR_PCT_SHORT: 7,
  ATR_PCT_LONG: 30,
  BB: 20,
  BB_STD: 2,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  GARTLEY_PIVOT_LENGTH: 2,
  GARTLEY_MIN_AB_RETRACEMENT_RATIO: 0.55,
  GARTLEY_MAX_AB_RETRACEMENT_RATIO: 0.68,
  GARTLEY_MIN_BC_RETRACEMENT_RATIO: 0.382,
  GARTLEY_MAX_BC_RETRACEMENT_RATIO: 0.886,
  GARTLEY_MIN_CD_EXTENSION_RATIO: 1.13,
  GARTLEY_MAX_CD_EXTENSION_RATIO: 1.618,
  GARTLEY_MIN_AD_RETRACEMENT_RATIO: 0.72,
  GARTLEY_MAX_AD_RETRACEMENT_RATIO: 0.84,
  GARTLEY_MAX_AB_CD_DEVIATION_PCT: 25,
  GARTLEY_TARGET_XA_FIB_PCT: 61.8,
  GARTLEY_STOP_XA_FIB_PCT: 5,
  GARTLEY_MIN_XA_HEIGHT_PCT: 0.2,
  GARTLEY_MIN_XA_HEIGHT_ATR: 1,
  GARTLEY_ATR_PERIOD: 14,
  GARTLEY_MIN_LEG_BARS: 1,
  GARTLEY_MAX_PATTERN_AGE_BARS: 240,
  GARTLEY_MAX_BREAKOUT_AFTER_D_BARS: 60,
  GARTLEY_MIN_BREAKOUT_DISTANCE_ATR: 0.05,
  GARTLEY_MAX_BREAKOUT_DISTANCE_XA_RATIO: 0.8,
  GARTLEY_ENTRY_MODE: "close_acceptance" as GartleyEntryMode,
  GARTLEY_CONFIRMATION_MAX_BARS: 2,
  GARTLEY_RETEST_MAX_BARS: 4,
  GARTLEY_RETEST_TOLERANCE_ATR: 0.25,
  GARTLEY_LONG_REQUIRE_POSITIVE_MACD_HISTOGRAM: true,
  GARTLEY_SHORT_REQUIRE_PRICE_BELOW_MA_SLOW: true,
  GARTLEY_EXIT_ON_OPPOSITE_PATTERN: true,
  LONG: {
    enable: true,
    direction: "LONG",
    minRiskRatio: 0.7,
  },
  SHORT: {
    enable: true,
    direction: "SHORT",
    minRiskRatio: 0.7,
  },
} as const;

export type GartleyConfig = StrategyConfig &
  Omit<
    typeof config,
    "BACKTEST_PRICE_MODE" | "LONG" | "SHORT" | "MIN_AI_QUALITY"
  > & {
    BACKTEST_PRICE_MODE: BacktestPriceMode;
    MIN_AI_QUALITY: number;
    GARTLEY_ENTRY_MODE: GartleyEntryMode;
    LONG: GartleySideConfig;
    SHORT: GartleySideConfig;
  };
