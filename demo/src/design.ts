/**
 * One design system for the whole film.
 *
 * Everything visual comes from here: the timing grid, the easing curves, the
 * colour tokens, and the handful of motion primitives every scene reuses.
 * Nothing in `story/` is allowed to hardcode a colour or an easing.
 *
 * Motion philosophy: nothing snaps. Entrances are long and decelerating, the
 * camera glides between panels instead of cutting, and elements leaving frame
 * drift out of the way rather than blinking off.
 */

import type {CSSProperties} from "react";
import {Easing, interpolate} from "remotion";

/* ------------------------------------------------------------------ format */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/* ------------------------------------------------------------- timing grid */

/**
 * The film is cut to the track: 100bpm, 4/4, at 30fps.
 *
 *   beat = 18 frames (0.6s)   bar = 72 frames (2.4s)
 *
 * Every panel is a whole number of half-bars and every camera move is exactly
 * half a bar, so the picture and `bed-groove-100.wav` cannot drift apart.
 * Change `BEAT` and you have to regenerate the audio to match.
 */
export const BEAT = 18;
export const BAR = BEAT * 4;

/** Beats-to-frames, for readable cue positions inside a panel. */
export const beat = (count: number): number => Math.round(count * BEAT);

/**
 * Panel lengths, in bars. Starts are derived, so a panel can be retimed
 * without hand-editing every later number.
 *
 * Rule for every panel: its last element finishes animating at least 12 frames
 * before the camera starts moving away. Nothing important lands on an exit.
 */
const BARS = {
  hook: 1.5,
  record: 2,
  verify: 1.5,
  install: 2.5,
  trust: 1.5,
  outro: 1.5,
} as const;

const LENGTHS = {
  hook: BARS.hook * BAR,
  record: BARS.record * BAR,
  verify: BARS.verify * BAR,
  install: BARS.install * BAR,
  trust: BARS.trust * BAR,
  outro: BARS.outro * BAR,
} as const;

export type PanelName = keyof typeof LENGTHS;

const slots = (): Record<PanelName, {start: number; length: number}> => {
  let at = 0;
  const out = {} as Record<PanelName, {start: number; length: number}>;
  for (const key of Object.keys(LENGTHS) as PanelName[]) {
    out[key] = {start: at, length: LENGTHS[key]};
    at += LENGTHS[key];
  }
  return out;
};

export const SLOT = slots();
export const ORDER: PanelName[] = ["hook", "record", "verify", "install", "trust", "outro"];

export const TOTAL = SLOT.outro.start + SLOT.outro.length; // 756 = 25.2s = 10.5 bars

/**
 * One transition per boundary, never the same one twice. Index `i` is the move
 * from panel `i` to panel `i + 1`.
 */
export type Move = "push" | "slide" | "dolly" | "iris" | "swing";

export const MOVES: Move[] = [
  "push", // hook -> record: the vertical push up
  "slide", // record -> verify: pan sideways
  "dolly", // verify -> install: through the frame
  "iris", // install -> trust: opens out of the checkmark
  "swing", // trust -> outro: the frame turns over
];

/**
 * The camera move between panels: exactly half a bar, starting half a beat
 * before the bar line so the outgoing panel is already drifting as the
 * downbeat lands. The move resolves on the beat, not between beats.
 */
export const TRAVEL = BAR / 2; // 36
export const TRAVEL_LEAD = BEAT / 2; // 9

/* ----------------------------------------------------------------- easings */

/** The house curve: gentle start, long decelerating settle. Every entrance. */
export const easeSoft = Easing.bezier(0.3, 0, 0.16, 1);
/** For line draws and wipes that must not overshoot or hesitate. */
export const easeLinearish = Easing.bezier(0.4, 0.05, 0.35, 0.95);
/** Camera: eases in and out of the move so there is no visible start or stop. */
export const easeGlide = Easing.bezier(0.5, 0, 0.16, 1);
/** Exits: slow, so leaving frame reads as drifting, not as a cut. */
export const easeAway = Easing.bezier(0.4, 0, 0.7, 0.4);

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/* ------------------------------------------------------- motion primitives */

/** Normalised 0..1 progress of a cue that starts at `from`. Long by default. */
export const cue = (frame: number, from: number, duration = 20): number =>
  interpolate(frame, [from, from + duration], [0, 1], {easing: easeSoft, ...CLAMP});

/** Even 0..1, for things that should move at a steady rate. */
export const ramp = (frame: number, from: number, duration = 20): number =>
  interpolate(frame, [from, from + duration], [0, 1], {easing: easeLinearish, ...CLAMP});

/** The camera curve, as a 0..1 value. */
export const glide = (frame: number, from: number, duration = TRAVEL): number =>
  interpolate(frame, [from, from + duration], [0, 1], {easing: easeGlide, ...CLAMP});

/**
 * A decaying 0..1 impulse, for soft emphasis. Silent before `from` — a clamped
 * interpolate would otherwise sit at full strength for the whole lead-up.
 */
export const impulse = (frame: number, from: number, duration = 30): number =>
  frame < from
    ? 0
    : interpolate(frame, [from, from + duration], [1, 0], {easing: easeAway, ...CLAMP});

/**
 * A barely-there scale settle. Deliberately tiny: a real overshoot reads as
 * bouncy, and this film should read as heavy glass moving slowly.
 */
export const settle = (t: number, from = 0.965): number =>
  interpolate(t, [0, 1], [from, 1], {easing: easeSoft});

/**
 * The single entrance used everywhere: lift, soften, fade. Passing the same
 * helper through every element is what makes the film feel like one object.
 */
export const rise = (t: number, distance = 30, blur = 5): CSSProperties => ({
  opacity: t,
  translate: `0 ${(1 - t) * distance}px`,
  filter: t > 0.995 ? "none" : `blur(${(1 - t) * blur}px)`,
});

/** Same idea, horizontal — for rows and lists. */
export const slide = (t: number, distance = 22, blur = 4): CSSProperties => ({
  opacity: t,
  translate: `${(1 - t) * -distance}px 0`,
  filter: t > 0.995 ? "none" : `blur(${(1 - t) * blur}px)`,
});

/* --------------------------------------------------- per-scene vocabularies */

/**
 * Each panel gets its own way of arriving. Same curves everywhere, different
 * geometry — that is what stops six scenes from looking like one template.
 */

/** Depth: used by the card deck. A tilt that flattens as it settles. */
export const PERSPECTIVE = 1800;

export const tilt = (t: number, degrees = -14, distance = 90): CSSProperties => ({
  opacity: t,
  transform: `translateY(${(1 - t) * distance}px) rotateX(${(1 - t) * degrees}deg) scale(${interpolate(
    t,
    [0, 1],
    [0.94, 1],
    {easing: easeSoft},
  )})`,
  filter: t > 0.995 ? "none" : `blur(${(1 - t) * 6}px)`,
});

/** Fold: used by the protection panels. Hinged on their outer edge. */
export const fold = (t: number, direction: 1 | -1): CSSProperties => ({
  opacity: t,
  transform: `rotateY(${(1 - t) * 34 * direction}deg) translateX(${(1 - t) * 60 * direction}px)`,
  transformOrigin: direction === -1 ? "left center" : "right center",
  filter: t > 0.995 ? "none" : `blur(${(1 - t) * 6}px)`,
});

/** Mask reveals: used by the install sheet. Content is uncovered, not faded. */
export const wipeRight = (t: number): CSSProperties => ({
  clipPath: `inset(0 ${(1 - t) * 100}% 0 0)`,
});

export const wipeLeft = (t: number): CSSProperties => ({
  clipPath: `inset(0 0 0 ${(1 - t) * 100}%)`,
});

export const wipeOpen = (t: number): CSSProperties => ({
  clipPath: `inset(0 ${(1 - t) * 50}% 0 ${(1 - t) * 50}%)`,
});

/** Flip: used by the verification board. A card turning face-up. */
export const flip = (t: number): CSSProperties => ({
  opacity: interpolate(t, [0, 0.25, 1], [0, 1, 1], CLAMP),
  transform: `rotateX(${(1 - t) * -82}deg) translateY(${(1 - t) * 14}px)`,
  transformOrigin: "50% 0%",
});

/** Push: used by the end card. Comes toward the lens and stops. */
export const push = (t: number, from = 0.72): CSSProperties => ({
  opacity: interpolate(t, [0, 0.3, 1], [0, 1, 1], CLAMP),
  transform: `scale(${interpolate(t, [0, 1], [from, 1], {easing: easeSoft})})`,
  filter: t > 0.995 ? "none" : `blur(${(1 - t) * 14}px)`,
});

/* ------------------------------------------------------------------ colour */

/** Ink ramp. The film is drawn on paper, so text is ink, not "white theme". */
export const ink = {
  900: "#080d18",
  800: "#131b2b",
  700: "#293445",
  600: "#465366",
  500: "#6a7688",
  400: "#8f9bad",
  300: "#b6c0cd",
  200: "#dbe2ec",
  line: "#e3e9f1",
  hair: "#eef2f8",
  paper: "#ffffff",
  wash: "#f7f9fd",
} as const;

/** Accents. One meaning each: blue = the product, green = proven, red = wrong. */
export const hue = {
  blue: "#2f66ff",
  blueSoft: "#e8efff",
  violet: "#7a53ff",
  violetSoft: "#f0ebff",
  cyan: "#0a9fd0",
  green: "#0a9e68",
  greenSoft: "#e6f7ef",
  red: "#e11d48",
  redSoft: "#ffecf0",
  amber: "#c2760a",
  amberSoft: "#fff5e6",
} as const;

/* ------------------------------------------------------------------ depth */

/** Layered shadows. Real objects cast a contact shadow and an ambient one. */
export const shadow = {
  flat: "0 1px 2px rgba(10,18,40,0.05), 0 6px 14px -8px rgba(10,18,40,0.12)",
  card: "0 1px 2px rgba(10,18,40,0.05), 0 14px 30px -14px rgba(10,18,40,0.18), 0 44px 90px -50px rgba(10,18,40,0.28)",
  hero: "0 2px 4px rgba(10,18,40,0.06), 0 22px 48px -18px rgba(10,18,40,0.20), 0 70px 130px -60px rgba(10,18,40,0.32)",
  glowBlue: "0 18px 44px -18px rgba(47,102,255,0.45)",
  glowGreen: "0 18px 44px -18px rgba(10,158,104,0.38)",
} as const;

export const radius = {sm: 12, md: 18, lg: 24, xl: 30} as const;

/* -------------------------------------------------------------- type scale */

/** A real ladder, so no scene invents its own headline size. */
export const type = {
  hero: {size: 128, tracking: -6.2, weight: 800, lineHeight: 0.98},
  h1: {size: 96, tracking: -4.6, weight: 800, lineHeight: 1.02},
  h2: {size: 66, tracking: -2.8, weight: 800, lineHeight: 1.06},
  h3: {size: 44, tracking: -1.4, weight: 700, lineHeight: 1.12},
  lead: {size: 32, tracking: -0.4, weight: 400, lineHeight: 1.35},
  body: {size: 26, tracking: -0.2, weight: 400, lineHeight: 1.4},
  kicker: {size: 16, tracking: 3.6, weight: 700, lineHeight: 1},
  code: {size: 25, tracking: -0.2, weight: 500, lineHeight: 1.6},
} as const;

/** Safe area. No chrome any more, so the frame is symmetrical. */
export const SAFE: CSSProperties = {
  paddingTop: 96,
  paddingBottom: 96,
  paddingLeft: 100,
  paddingRight: 100,
};
