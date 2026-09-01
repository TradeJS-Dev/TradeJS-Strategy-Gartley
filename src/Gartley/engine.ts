import { Candle, Direction } from "@tradejs/types";
import { GartleyConfig, GartleyEntryMode } from "./config";

export type GartleyPatternKind = "bullish_gartley" | "bearish_gartley";
export type GartleyEntryStage = "breakout" | "close_accepted" | "retest_held";
export type GartleyPivotRole = "x" | "a" | "b" | "c" | "d";

export interface GartleyPivot {
  timestamp: number;
  index: number;
  value: number;
  kind: "high" | "low";
  traded: boolean;
}

export interface GartleyPattern {
  setupId: string;
  kind: GartleyPatternKind;
  direction: Direction;
  entryMode: GartleyEntryMode;
  entryStage: GartleyEntryStage;
  pivots: [
    GartleyPivot,
    GartleyPivot,
    GartleyPivot,
    GartleyPivot,
    GartleyPivot,
  ];
  confirmationPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  xaLength: number;
  xaHeightAtr: number;
  patternAgeBars: number;
  breakoutAfterDBars: number;
  xToABars: number;
  aToBBars: number;
  bToCBars: number;
  cToDBars: number;
  abRetracementRatio: number;
  bcRetracementRatio: number;
  cdExtensionRatio: number;
  adRetracementRatio: number;
  abCdRatio: number;
  abCdDeviationPct: number;
  breakoutDistancePct: number;
  breakoutDistanceAtr: number;
  breakoutDistanceXaRatio: number;
  breakoutTimestamp: number;
  confirmationBars: number;
  timestamp: number;
  close: number;
}

export interface GartleyPendingSetup {
  setupId: string;
  mode: Exclude<GartleyEntryMode, "breakout">;
  stage: "b_level_crossed" | "retest_pending";
  breakoutIndex: number;
  pattern: GartleyPattern;
}

export interface GartleyRuntimeState {
  pattern: GartleyPattern | null;
  pending: GartleyPendingSetup | null;
  pivots: GartleyPivot[];
}

interface CandleRecord {
  candle: Candle;
  index: number;
}

interface EngineState {
  records: CandleRecord[];
  currentIndex: number;
  pivots: GartleyPivot[];
  pattern: GartleyPattern | null;
  pending: GartleyPendingSetup | null;
  consumedSetupIds: string[];
  lastTimestamp: number | null;
}

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getConfigNumbers = (config: GartleyConfig) => {
  const minAbRetracementRatio = Math.max(
    0,
    Number(config.GARTLEY_MIN_AB_RETRACEMENT_RATIO ?? 0.55),
  );
  const minBcRetracementRatio = Math.max(
    0,
    Number(config.GARTLEY_MIN_BC_RETRACEMENT_RATIO ?? 0.382),
  );
  const minCdExtensionRatio = Math.max(
    0,
    Number(config.GARTLEY_MIN_CD_EXTENSION_RATIO ?? 1.13),
  );
  const minAdRetracementRatio = Math.max(
    0,
    Number(config.GARTLEY_MIN_AD_RETRACEMENT_RATIO ?? 0.72),
  );

  return {
    pivotLength: Math.max(1, Math.floor(config.GARTLEY_PIVOT_LENGTH ?? 2)),
    minAbRetracementRatio,
    maxAbRetracementRatio: Math.max(
      minAbRetracementRatio,
      Number(config.GARTLEY_MAX_AB_RETRACEMENT_RATIO ?? 0.68),
    ),
    minBcRetracementRatio,
    maxBcRetracementRatio: Math.max(
      minBcRetracementRatio,
      Number(config.GARTLEY_MAX_BC_RETRACEMENT_RATIO ?? 0.886),
    ),
    minCdExtensionRatio,
    maxCdExtensionRatio: Math.max(
      minCdExtensionRatio,
      Number(config.GARTLEY_MAX_CD_EXTENSION_RATIO ?? 1.618),
    ),
    minAdRetracementRatio,
    maxAdRetracementRatio: Math.max(
      minAdRetracementRatio,
      Number(config.GARTLEY_MAX_AD_RETRACEMENT_RATIO ?? 0.84),
    ),
    maxAbCdDeviationPct: Math.max(
      0,
      Number(config.GARTLEY_MAX_AB_CD_DEVIATION_PCT ?? 25),
    ),
    targetXaFibPct: Math.max(
      0,
      Number(config.GARTLEY_TARGET_XA_FIB_PCT ?? 61.8),
    ),
    stopXaFibPct: Math.max(0, Number(config.GARTLEY_STOP_XA_FIB_PCT ?? 5)),
    minXaHeightPct: Math.max(0, Number(config.GARTLEY_MIN_XA_HEIGHT_PCT ?? 0)),
    minXaHeightAtr: Math.max(0, Number(config.GARTLEY_MIN_XA_HEIGHT_ATR ?? 0)),
    atrPeriod: Math.max(2, Math.floor(config.GARTLEY_ATR_PERIOD ?? 14)),
    minLegBars: Math.max(1, Math.floor(config.GARTLEY_MIN_LEG_BARS ?? 1)),
    maxPatternAgeBars: Math.max(
      5,
      Math.floor(config.GARTLEY_MAX_PATTERN_AGE_BARS ?? 240),
    ),
    maxBreakoutAfterDBars: Math.max(
      1,
      Math.floor(config.GARTLEY_MAX_BREAKOUT_AFTER_D_BARS ?? 60),
    ),
    minBreakoutDistanceAtr: Math.max(
      0,
      Number(config.GARTLEY_MIN_BREAKOUT_DISTANCE_ATR ?? 0),
    ),
    maxBreakoutDistanceXaRatio: Math.max(
      0,
      Number(config.GARTLEY_MAX_BREAKOUT_DISTANCE_XA_RATIO ?? 0),
    ),
    entryMode: config.GARTLEY_ENTRY_MODE ?? "close_acceptance",
    confirmationMaxBars: Math.max(
      1,
      Math.floor(config.GARTLEY_CONFIRMATION_MAX_BARS ?? 2),
    ),
    retestMaxBars: Math.max(1, Math.floor(config.GARTLEY_RETEST_MAX_BARS ?? 4)),
    retestToleranceAtr: Math.max(
      0,
      Number(config.GARTLEY_RETEST_TOLERANCE_ATR ?? 0.25),
    ),
  };
};

type EngineOptions = ReturnType<typeof getConfigNumbers>;

const calculateAtr = (
  records: CandleRecord[],
  period: number,
): number | null => {
  const relevant = records.slice(-(period + 1));
  if (relevant.length < 2) return null;
  const trueRanges: number[] = [];

  for (let index = 1; index < relevant.length; index += 1) {
    const candle = relevant[index]?.candle;
    const previous = relevant[index - 1]?.candle;
    const high = asNumber(candle?.high);
    const low = asNumber(candle?.low);
    const previousClose = asNumber(previous?.close);
    if (high == null || low == null || previousClose == null) continue;
    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }

  if (trueRanges.length === 0) return null;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
};

const pushBoundedRecord = (
  state: Pick<EngineState, "records" | "currentIndex">,
  candle: Candle,
  maxRecords: number,
) => {
  state.currentIndex += 1;
  state.records.push({ candle, index: state.currentIndex });
  if (state.records.length > maxRecords) {
    state.records.splice(0, state.records.length - maxRecords);
  }
};

const appendPivot = (state: EngineState, pivot: GartleyPivot) => {
  const latest = state.pivots[state.pivots.length - 1];
  if (latest?.kind === pivot.kind) {
    if (latest.traded) return;
    const moreExtreme =
      pivot.kind === "high"
        ? pivot.value > latest.value
        : pivot.value < latest.value;
    if (moreExtreme) state.pivots[state.pivots.length - 1] = pivot;
    return;
  }

  state.pivots.push(pivot);
  if (state.pivots.length > 20) state.pivots.shift();
};

const detectConfirmedPivot = (state: EngineState, pivotLength: number) => {
  const windowLength = pivotLength * 2 + 1;
  if (state.records.length < windowLength) return;

  const centerPosition = state.records.length - pivotLength - 1;
  const start = centerPosition - pivotLength;
  const end = centerPosition + pivotLength + 1;
  if (start < 0) return;

  const window = state.records.slice(start, end);
  const center = state.records[centerPosition];
  const high = asNumber(center?.candle.high);
  const low = asNumber(center?.candle.low);
  if (!center || high == null || low == null) return;

  const highs = window.map(({ candle }) => asNumber(candle.high));
  const lows = window.map(({ candle }) => asNumber(candle.low));
  if (
    highs.some((value) => value == null) ||
    lows.some((value) => value == null)
  ) {
    return;
  }

  const isHigh =
    highs.every((value) => high >= (value as number)) &&
    highs.filter((value) => value === high).length === 1;
  const isLow =
    lows.every((value) => low <= (value as number)) &&
    lows.filter((value) => value === low).length === 1;
  if (isHigh === isLow) return;

  appendPivot(state, {
    timestamp: center.candle.timestamp,
    index: center.index,
    value: isHigh ? high : low,
    kind: isHigh ? "high" : "low",
    traded: false,
  });
};

const patternRolesForDirection = (direction: Direction) =>
  direction === "LONG"
    ? (["low", "high", "low", "high", "low"] as const)
    : (["high", "low", "high", "low", "high"] as const);

const findLatestPatternPivots = (
  state: EngineState,
  direction: Direction,
): GartleyPattern["pivots"] | null => {
  const roles = patternRolesForDirection(direction);
  const firstCandidate = Math.max(0, state.pivots.length - 8);

  for (
    let index = state.pivots.length - 5;
    index >= firstCandidate;
    index -= 1
  ) {
    const candidate = state.pivots.slice(index, index + 5);
    if (
      candidate.length === 5 &&
      candidate.every((pivot, roleIndex) => pivot.kind === roles[roleIndex]) &&
      candidate[4]!.index < state.currentIndex &&
      !candidate[4]!.traded
    ) {
      return candidate as GartleyPattern["pivots"];
    }
  }

  return null;
};

const findLatestConfirmationCross = ({
  records,
  confirmationPrice,
  d,
  direction,
}: {
  records: CandleRecord[];
  confirmationPrice: number;
  d: GartleyPivot;
  direction: Direction;
}): CandleRecord | null => {
  const sign = direction === "LONG" ? 1 : -1;
  let crossing: CandleRecord | null = null;

  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1];
    const current = records[index];
    if (!previous || !current || current.index <= d.index) continue;

    const previousClose = asNumber(previous.candle.close);
    const currentClose = asNumber(current.candle.close);
    if (previousClose == null || currentClose == null) continue;

    const crossed =
      previousClose * sign <= confirmationPrice * sign &&
      currentClose * sign > confirmationPrice * sign;
    if (crossed) crossing = current;
  }

  return crossing;
};

const hasConsumed = (state: EngineState, setupId: string) =>
  state.consumedSetupIds.includes(setupId);

const markTerminal = (state: EngineState, setup: GartleyPendingSetup) => {
  if (!hasConsumed(state, setup.setupId)) {
    state.consumedSetupIds.push(setup.setupId);
    if (state.consumedSetupIds.length > 64) state.consumedSetupIds.shift();
  }
  const d = state.pivots.find(
    (pivot) => pivot.timestamp === setup.pattern.pivots[4].timestamp,
  );
  if (d) d.traded = true;
};

const buildBreakoutPattern = ({
  state,
  candle,
  atr,
  direction,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  direction: Direction;
  options: EngineOptions;
}): GartleyPattern | null => {
  const pivots = findLatestPatternPivots(state, direction);
  if (!pivots) return null;
  const [x, a, b, c, d] = pivots;
  const sign = direction === "LONG" ? 1 : -1;
  const xValue = x.value * sign;
  const aValue = a.value * sign;
  const bValue = b.value * sign;
  const cValue = c.value * sign;
  const dValue = d.value * sign;
  const xaLength = aValue - xValue;
  const abLength = aValue - bValue;
  const bcLength = cValue - bValue;
  const cdLength = cValue - dValue;
  if (Math.min(xaLength, abLength, bcLength, cdLength) <= 0) return null;

  const xToABars = a.index - x.index;
  const aToBBars = b.index - a.index;
  const bToCBars = c.index - b.index;
  const cToDBars = d.index - c.index;
  if (Math.min(xToABars, aToBBars, bToCBars, cToDBars) < options.minLegBars) {
    return null;
  }

  const abRetracementRatio = abLength / xaLength;
  const bcRetracementRatio = bcLength / abLength;
  const cdExtensionRatio = cdLength / bcLength;
  const adRetracementRatio = (aValue - dValue) / xaLength;
  const abCdRatio = cdLength / abLength;
  const abCdDeviationPct = Math.abs(abCdRatio - 1) * 100;
  if (
    abRetracementRatio < options.minAbRetracementRatio ||
    abRetracementRatio > options.maxAbRetracementRatio ||
    bcRetracementRatio < options.minBcRetracementRatio ||
    bcRetracementRatio > options.maxBcRetracementRatio ||
    cdExtensionRatio < options.minCdExtensionRatio ||
    cdExtensionRatio > options.maxCdExtensionRatio ||
    adRetracementRatio < options.minAdRetracementRatio ||
    adRetracementRatio > options.maxAdRetracementRatio ||
    abCdDeviationPct > options.maxAbCdDeviationPct ||
    bValue <= xValue ||
    bValue >= aValue ||
    cValue <= bValue ||
    cValue >= aValue ||
    dValue <= xValue ||
    dValue >= bValue
  ) {
    return null;
  }

  const patternAgeBars = state.currentIndex - x.index;
  const breakoutAfterDBars = state.currentIndex - d.index;
  if (
    patternAgeBars > options.maxPatternAgeBars ||
    breakoutAfterDBars > options.maxBreakoutAfterDBars
  ) {
    return null;
  }

  const xaHeightPct = x.value !== 0 ? (xaLength / Math.abs(x.value)) * 100 : 0;
  const xaHeightAtr = atr != null && atr > 0 ? xaLength / atr : 0;
  if (
    xaHeightPct < options.minXaHeightPct ||
    xaHeightAtr < options.minXaHeightAtr
  ) {
    return null;
  }

  const confirmationPrice = b.value;
  const crossing = findLatestConfirmationCross({
    records: state.records,
    confirmationPrice,
    d,
    direction,
  });
  const close = asNumber(candle.close);
  if (!crossing || close == null) return null;

  const normalizedBreakoutDistance = close * sign - confirmationPrice * sign;
  if (normalizedBreakoutDistance <= 0) return null;

  const breakoutDistancePct =
    confirmationPrice !== 0
      ? (normalizedBreakoutDistance / Math.abs(confirmationPrice)) * 100
      : 0;
  const breakoutDistanceAtr =
    atr != null && atr > 0 ? normalizedBreakoutDistance / atr : 0;
  const breakoutDistanceXaRatio = normalizedBreakoutDistance / xaLength;
  if (
    breakoutDistanceAtr < options.minBreakoutDistanceAtr ||
    (options.maxBreakoutDistanceXaRatio > 0 &&
      breakoutDistanceXaRatio > options.maxBreakoutDistanceXaRatio)
  ) {
    return null;
  }

  const kind: GartleyPatternKind =
    direction === "LONG" ? "bullish_gartley" : "bearish_gartley";
  const setupId = `${kind}:${x.timestamp}:${a.timestamp}:${b.timestamp}:${c.timestamp}:${d.timestamp}`;
  if (hasConsumed(state, setupId)) return null;

  return {
    setupId,
    kind,
    direction,
    entryMode: options.entryMode,
    entryStage: "breakout",
    pivots,
    confirmationPrice,
    targetPrice: d.value + sign * xaLength * (options.targetXaFibPct / 100),
    stopLossPrice: x.value - sign * xaLength * (options.stopXaFibPct / 100),
    xaLength,
    xaHeightAtr,
    patternAgeBars,
    breakoutAfterDBars,
    xToABars,
    aToBBars,
    bToCBars,
    cToDBars,
    abRetracementRatio,
    bcRetracementRatio,
    cdExtensionRatio,
    adRetracementRatio,
    abCdRatio,
    abCdDeviationPct,
    breakoutDistancePct,
    breakoutDistanceAtr,
    breakoutDistanceXaRatio,
    breakoutTimestamp: crossing.candle.timestamp,
    confirmationBars: 0,
    timestamp: candle.timestamp,
    close,
  };
};

const resolvePending = ({
  state,
  candle,
  atr,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  options: EngineOptions;
}): GartleyPattern | null => {
  const pending = state.pending;
  if (!pending) return null;
  const confirmationBars = state.currentIndex - pending.breakoutIndex;
  if (confirmationBars < 1) return null;

  const close = asNumber(candle.close);
  const high = asNumber(candle.high);
  const low = asNumber(candle.low);
  if (close == null || high == null || low == null) return null;

  const pattern = pending.pattern;
  const invalidated =
    pattern.direction === "LONG"
      ? low <= pattern.stopLossPrice
      : high >= pattern.stopLossPrice;
  const maxBars =
    pending.mode === "retest"
      ? options.retestMaxBars
      : options.confirmationMaxBars;
  if (invalidated || confirmationBars > maxBars) {
    markTerminal(state, pending);
    state.pending = null;
    return null;
  }

  const sign = pattern.direction === "LONG" ? 1 : -1;
  const effectiveAtr = atr != null && atr > 0 ? atr : pattern.xaLength;
  const minimumDistance = effectiveAtr * options.minBreakoutDistanceAtr;
  const normalizedDistance = close * sign - pattern.confirmationPrice * sign;
  const closeAccepted = normalizedDistance >= minimumDistance;
  let entryStage: GartleyEntryStage | null = null;

  if (pending.mode === "close_acceptance") {
    if (closeAccepted) entryStage = "close_accepted";
  } else {
    const tolerance = effectiveAtr * options.retestToleranceAtr;
    const touchPrice = pattern.direction === "LONG" ? low : high;
    const touched =
      Math.abs(touchPrice - pattern.confirmationPrice) <= tolerance;
    if (touched && closeAccepted) entryStage = "retest_held";
  }

  if (!entryStage) return null;
  markTerminal(state, pending);
  state.pending = null;
  return {
    ...pattern,
    entryStage,
    breakoutDistancePct:
      pattern.confirmationPrice !== 0
        ? (normalizedDistance / Math.abs(pattern.confirmationPrice)) * 100
        : 0,
    breakoutDistanceAtr:
      effectiveAtr > 0 ? normalizedDistance / effectiveAtr : 0,
    breakoutDistanceXaRatio: normalizedDistance / pattern.xaLength,
    confirmationBars,
    timestamp: candle.timestamp,
    close,
  };
};

const clonePending = (
  pending: GartleyPendingSetup | null,
): GartleyPendingSetup | null =>
  pending
    ? {
        ...pending,
        pattern: { ...pending.pattern, pivots: [...pending.pattern.pivots] },
      }
    : null;

export const buildGartleySignalContext = (pattern: GartleyPattern) => ({
  setupId: pattern.setupId,
  patternKind: pattern.kind,
  signalDirection: pattern.direction,
  entryMode: pattern.entryMode,
  entryStage: pattern.entryStage,
  confirmationPrice: pattern.confirmationPrice,
  targetPrice: pattern.targetPrice,
  stopLossPrice: pattern.stopLossPrice,
  xaLength: pattern.xaLength,
  xaHeightAtr: pattern.xaHeightAtr,
  patternAgeBars: pattern.patternAgeBars,
  breakoutAfterDBars: pattern.breakoutAfterDBars,
  xToABars: pattern.xToABars,
  aToBBars: pattern.aToBBars,
  bToCBars: pattern.bToCBars,
  cToDBars: pattern.cToDBars,
  abRetracementRatio: pattern.abRetracementRatio,
  bcRetracementRatio: pattern.bcRetracementRatio,
  cdExtensionRatio: pattern.cdExtensionRatio,
  adRetracementRatio: pattern.adRetracementRatio,
  abCdRatio: pattern.abCdRatio,
  abCdDeviationPct: pattern.abCdDeviationPct,
  breakoutDistancePct: pattern.breakoutDistancePct,
  breakoutDistanceAtr: pattern.breakoutDistanceAtr,
  breakoutDistanceXaRatio: pattern.breakoutDistanceXaRatio,
  breakoutTimestamp: pattern.breakoutTimestamp,
  confirmationBars: pattern.confirmationBars,
  currentPrice: pattern.close,
  pivots: pattern.pivots.map(({ timestamp, value, kind }, index) => ({
    role: (["x", "a", "b", "c", "d"] as GartleyPivotRole[])[index],
    timestamp,
    value,
    kind,
  })),
});

export type GartleySignalContext = ReturnType<typeof buildGartleySignalContext>;

export const createGartleyEngine = ({
  config,
  initialCandles = [],
}: {
  config: GartleyConfig;
  initialCandles?: Candle[];
}): {
  next: (candle: Candle) => GartleyRuntimeState;
  getState: () => GartleyRuntimeState;
} => {
  const options = getConfigNumbers(config);
  const state: EngineState = {
    records: [],
    currentIndex: -1,
    pivots: [],
    pattern: null,
    pending: null,
    consumedSetupIds: [],
    lastTimestamp: null,
  };
  const maxRecords = Math.max(
    options.maxPatternAgeBars + options.pivotLength * 2 + 5,
    options.atrPeriod + 2,
  );

  const snapshot = (): GartleyRuntimeState => ({
    pattern: state.pattern
      ? { ...state.pattern, pivots: [...state.pattern.pivots] }
      : null,
    pending: clonePending(state.pending),
    pivots: state.pivots.map((pivot) => ({ ...pivot })),
  });

  const apply = (candle: Candle): GartleyRuntimeState => {
    if (state.lastTimestamp === candle.timestamp) return snapshot();
    state.lastTimestamp = candle.timestamp;
    state.pattern = null;
    pushBoundedRecord(state, candle, maxRecords);
    detectConfirmedPivot(state, options.pivotLength);
    const atr = calculateAtr(state.records, options.atrPeriod);

    const pendingPattern = resolvePending({ state, candle, atr, options });
    if (pendingPattern) {
      state.pattern = pendingPattern;
      return snapshot();
    }
    if (state.pending) return snapshot();

    const breakout =
      buildBreakoutPattern({
        state,
        candle,
        atr,
        direction: "LONG",
        options,
      }) ??
      buildBreakoutPattern({
        state,
        candle,
        atr,
        direction: "SHORT",
        options,
      });
    if (!breakout) return snapshot();

    if (options.entryMode === "breakout") {
      const terminal: GartleyPendingSetup = {
        setupId: breakout.setupId,
        mode: "close_acceptance",
        stage: "b_level_crossed",
        breakoutIndex: state.currentIndex,
        pattern: breakout,
      };
      markTerminal(state, terminal);
      state.pattern = breakout;
      return snapshot();
    }

    state.pending = {
      setupId: breakout.setupId,
      mode: options.entryMode,
      stage:
        options.entryMode === "retest" ? "retest_pending" : "b_level_crossed",
      breakoutIndex: state.currentIndex,
      pattern: breakout,
    };
    return snapshot();
  };

  for (const candle of initialCandles) apply(candle);
  return { next: apply, getState: snapshot };
};
