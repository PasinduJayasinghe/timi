import { describe, expect, it } from "vitest";
import css from "./tokens.css?raw";

/**
 * WCAG contrast of the design's text colours on the surfaces they sit on (Phase 6b). Translucent
 * glass is blended over the app gradient, as on screen. Normal text needs 4.5:1. Disabled text is
 * exempt, and icons only need 3:1, so icon tiles are not listed.
 */

const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
);

type Rgb = [number, number, number];

function color(name: string): Rgb {
  const hex = tokens[name];
  if (!hex) throw new Error(`No colour token --color-${name}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** `top` at `alpha` over `base`. */
function over(top: Rgb, alpha: number, base: Rgb): Rgb {
  return top.map((value, i) => Math.round(value * alpha + base[i] * (1 - alpha))) as Rgb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const white: Rgb = [255, 255, 255];
// The darker end of the app gradient: the worst case for dark text
const app = color("app-to");
const glass = over(white, 0.55, app);
const pane = over(white, 0.4, app);

type Pair = [label: string, text: Rgb, surface: Rgb];

const PAIRS: Pair[] = [
  ["ink on glass", color("ink"), glass],
  ["muted text on glass", color("ink-muted"), glass],
  ["muted text on the app background", color("ink-muted"), app],
  ["placeholder in quick add (white 62%)", color("ink-placeholder"), over(white, 0.62, app)],
  ["placeholder on white", color("ink-placeholder"), white],
  ...["client", "internal", "support", "meeting", "other", "calendar"].flatMap((type): Pair[] => [
    [`${type} ink on glass`, color(`type-${type}-ink`), glass],
    [
      `${type} chip in the popover (16% on white 90%)`,
      color(`type-${type}-ink`),
      over(color(`type-${type}`), 0.16, over(white, 0.9, app)),
    ],
    [
      `${type} strong ink on a timeline bar (32%)`,
      color(`type-${type}-ink-strong`),
      over(color(`type-${type}`), 0.32, over(white, 0.3, app)),
    ],
  ]),
  ...["client", "internal", "meeting", "other"].map((type): Pair => [
    `${type} wide filter chip (1d)`,
    color(`type-${type}-ink`),
    over(color(`type-${type}`), type === "other" ? 0.2 : 0.16, pane),
  ]),
  ["error text on the error surface", color("status-error"), color("status-error-surface")],
  ["accent ink on an accent 12% chip", color("accent-ink"), over(color("accent"), 0.12, glass)],
  ["Syncing chip (2e)", color("type-internal-ink"), over(color("type-internal"), 0.18, app)],
  ["Offline chip (2e)", color("type-other-ink"), over(color("ink-muted"), 0.12, app)],
  ["white on the strong accent gradient (start)", white, color("accent-strong")],
  ["white on the strong accent gradient (middle)", white, over(color("accent-strong"), 0.5, color("accent-strong-to"))],
  ["white on calendar ink (Join Google Meet)", white, color("type-calendar-ink")],
  ["white on accent ink (today in the week view)", white, color("accent-ink")],
  ["white on the success colour (Copied)", white, color("status-success")],
];

/**
 * Below 4.5:1 in the design as drawn. Reported in Phase 6b and waiting for a design decision;
 * listed here so they stay visible. Remove an entry once its colours change.
 */
const KNOWN_LOW: Pair[] = [
  [
    "Saved chip (2e): success text on support 16% over the app",
    color("status-success"),
    over(color("type-support"), 0.16, app),
  ],
  [
    "support wide filter chip (1d): 14% on the pane",
    color("type-support-ink"),
    over(color("type-support"), 0.14, pane),
  ],
  ["white on the strong accent gradient (far end)", white, color("accent-strong-to")],
];

describe("text contrast (WCAG AA, 4.5:1)", () => {
  it.each(PAIRS)("%s", (_label, text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(KNOWN_LOW)("known low, awaiting design: %s", (_label, text, surface) => {
    const value = contrast(text, surface);
    // Still close to AA; fails loudly if it gets worse, and asks for removal once fixed
    expect(value).toBeGreaterThanOrEqual(4.1);
    expect(value).toBeLessThan(4.5);
  });
});
