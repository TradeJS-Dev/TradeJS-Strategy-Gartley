# @tradejs/strategy-gartley

TradeJS strategy plugin providing `Gartley`.

## Strategy overview

`Gartley` detects the classical five-pivot XABCD harmonic reversal in both
directions. The bullish form uses `low → high → low → high → low`; the bearish
form is its exact mirror.

The default geometry accepts:

- `AB / XA`: `0.55–0.68`, centered on the classical `0.618` retracement;
- `BC / AB`: `0.382–0.886`;
- `CD / BC`: `1.13–1.618`;
- `AD / XA`: `0.72–0.84`, centered on the classical `0.786` retracement;
- `AB≈CD`: at most `25%` length deviation.

Here `AD / XA` means the distance from `A` back toward `X`, so an ideal `D`
completes near a `0.786` retracement of the original `XA` impulse.

![Gartley strategy logic](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Gartley/main/docs/strategy-logic.svg)

## Entry and risk

The pattern becomes eligible only after `D` is confirmed and price closes
through the `B` level in the reversal direction. The entry can use the first
break, a second accepted close, or a held retest.

The default target is `61.8%` of `XA` projected from `D` toward `A`. The stop is
`5%` of `XA` beyond `X`. Every ratio, tolerance, age limit, confirmation mode,
target, and stop is explicit in the strategy config so research can change the
geometry without changing detector code.

![Bullish Gartley signal](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Gartley/main/docs/signal-example.svg)

## Install

```bash
yarn add @tradejs/strategy-gartley
```

Register the package in `tradejs.config.ts`:

```ts
import { defineConfig } from "@tradejs/core/config";

export default defineConfig({
  strategies: ["@tradejs/strategy-gartley"],
});
```

The package exports `strategyEntries`, the `Gartley` strategy definition,
manifest, default config, and AI adapter.

## Development

```bash
yarn install --immutable
yarn checks
```

Publishing is beta-first and delegated to the pinned
`TradeJS-Workflows@v1` reusable workflow.

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS
Project owns their exact installed versions and package manifest, so this
package never loads a hidden nested engine, types package, or Strategy Kit.
