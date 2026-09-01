import {
  StrategyEntryModelFigures,
  StrategyFigureLine,
  StrategyFigurePoints,
} from "@tradejs/types";
import { GartleyPattern } from "./engine";

export const buildGartleyFigures = ({
  pattern,
  entryTimestamp,
  entryPrice,
}: {
  pattern: GartleyPattern;
  entryTimestamp: number;
  entryPrice: number;
}): StrategyEntryModelFigures => {
  const color = pattern.direction === "LONG" ? "#22c55e" : "#ef4444";
  const [x, a, b, c, d] = pattern.pivots;
  const patternPoints = [x, a, b, c, d].map(({ timestamp, value }) => ({
    timestamp,
    value,
  }));

  const lines: StrategyFigureLine[] = [
    {
      id: `gartley-pattern-${entryTimestamp}`,
      kind: `gartley_${pattern.kind}_pattern`,
      points: [
        ...patternPoints,
        { timestamp: entryTimestamp, value: entryPrice },
      ],
      color,
      width: 2,
      style: "solid",
    },
    {
      id: `gartley-ab-${entryTimestamp}`,
      kind: "gartley_ab_leg",
      points: [
        { timestamp: a.timestamp, value: a.value },
        { timestamp: b.timestamp, value: b.value },
      ],
      color: "#2563eb",
      width: 2,
      style: "dashed",
    },
    {
      id: `gartley-cd-${entryTimestamp}`,
      kind: "gartley_cd_leg",
      points: [
        { timestamp: c.timestamp, value: c.value },
        { timestamp: d.timestamp, value: d.value },
      ],
      color: "#7c3aed",
      width: 2,
      style: "dashed",
    },
    {
      id: `gartley-confirmation-${entryTimestamp}`,
      kind: "gartley_b_confirmation",
      points: [
        { timestamp: b.timestamp, value: pattern.confirmationPrice },
        { timestamp: entryTimestamp, value: pattern.confirmationPrice },
      ],
      color: "#f59e0b",
      width: 1,
      style: "dashed",
    },
    {
      id: `gartley-target-${entryTimestamp}`,
      kind: "gartley_target",
      points: [
        { timestamp: d.timestamp, value: pattern.targetPrice },
        { timestamp: entryTimestamp, value: pattern.targetPrice },
      ],
      color: "#22c55e",
      width: 1,
      style: "dashed",
    },
    {
      id: `gartley-stop-${entryTimestamp}`,
      kind: "gartley_stop",
      points: [
        { timestamp: d.timestamp, value: pattern.stopLossPrice },
        { timestamp: entryTimestamp, value: pattern.stopLossPrice },
      ],
      color: "#ef4444",
      width: 1,
      style: "dashed",
    },
  ];

  const points: StrategyFigurePoints[] = [
    {
      id: `gartley-pivots-${entryTimestamp}`,
      kind: `gartley_${pattern.kind}_pivots`,
      points: patternPoints,
      color,
      radius: 4,
    },
    {
      id: `gartley-entry-${entryTimestamp}`,
      kind: "gartley_entry",
      points: [{ timestamp: entryTimestamp, value: entryPrice }],
      color,
      radius: 5,
    },
  ];

  return { lines, points };
};
