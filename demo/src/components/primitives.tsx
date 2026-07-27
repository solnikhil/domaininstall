import React from "react";
import type {CSSProperties} from "react";
import {mono, sans} from "../fonts";
import {hue, ink, radius, shadow, type} from "../design";

/* ------------------------------------------------------------------- text */

/*
 * There are deliberately no small label / kicker components any more. Every
 * panel gets one headline and, at most, one supporting line — the film had far
 * too much text to read at this speed.
 */

type Step = keyof typeof type;

export const Text: React.FC<{
  as?: Step;
  children: React.ReactNode;
  color?: string;
  style?: CSSProperties;
}> = ({as = "body", children, color = ink[900], style}) => {
  const t = type[as];
  return (
    <div
      style={{
        fontFamily: sans,
        fontSize: t.size,
        fontWeight: t.weight,
        letterSpacing: t.tracking,
        lineHeight: t.lineHeight,
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Headline with a per-word entrance. Words are the unit, not letters: letters
 * read as a gimmick at this speed, words read as intent.
 */
export const Headline: React.FC<{
  words: Array<{text: string; color?: string}>;
  progressOf: (index: number) => number;
  as?: Step;
  /** Which way the words arrive from. Panels use different axes on purpose. */
  axis?: "y" | "x";
  style?: CSSProperties;
}> = ({words, progressOf, as = "h1", axis = "y", style}) => {
  const t = type[as];
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        gap: `0 ${Math.round(t.size * 0.26)}px`,
        fontFamily: sans,
        fontSize: t.size,
        fontWeight: t.weight,
        letterSpacing: t.tracking,
        lineHeight: t.lineHeight,
        ...style,
      }}
    >
      {words.map((word, index) => {
        const p = progressOf(index);
        return (
          <span
            key={`${word.text}-${index}`}
            style={{
              display: "inline-block",
              color: word.color ?? ink[900],
              opacity: p,
              translate:
                axis === "y" ? `0 ${(1 - p) * 46}px` : `${(1 - p) * -70}px 0`,
              filter: p > 0.999 ? "none" : `blur(${(1 - p) * 12}px)`,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------- shell */

export const Card: React.FC<{
  children: React.ReactNode;
  style?: CSSProperties;
  tone?: "paper" | "wash" | "blue" | "amber" | "green";
  depth?: "flat" | "card" | "hero";
}> = ({children, style, tone = "paper", depth = "card"}) => {
  const tones: Record<string, {bg: string; border: string}> = {
    paper: {bg: ink.paper, border: ink.line},
    wash: {bg: ink.wash, border: ink.line},
    blue: {bg: "#fbfcff", border: "#dbe6ff"},
    amber: {bg: "#fffdf9", border: "#f6e4c6"},
    green: {bg: "#fbfefc", border: "#cfeede"},
  };
  const t = tones[tone] ?? tones.paper!;
  return (
    <div
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: radius.xl,
        boxShadow: shadow[depth],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Small label strip used at the top of the record and protection cards. */
export const CardLabel: React.FC<{
  left: React.ReactNode;
  right?: React.ReactNode;
  color?: string;
}> = ({left, right, color = ink[400]}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "20px 30px",
      borderBottom: `1px solid ${ink.hair}`,
      fontFamily: mono,
      fontSize: 15,
      fontWeight: 700,
      letterSpacing: 2.6,
      textTransform: "uppercase",
      color,
    }}
  >
    <span>{left}</span>
    {right ? <span style={{fontWeight: 500, letterSpacing: 1.8}}>{right}</span> : null}
  </div>
);

/** A pill for a domain or a package name. */
export const Chip: React.FC<{
  children: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
  style?: CSSProperties;
  size?: number;
}> = ({children, accent, icon, style, size = 38}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: `${Math.round(size * 0.46)}px ${Math.round(size * 0.74)}px`,
      borderRadius: 999,
      fontFamily: mono,
      fontSize: size,
      fontWeight: 600,
      letterSpacing: -0.8,
      whiteSpace: "nowrap",
      color: accent ? "#ffffff" : ink[800],
      background: accent ? `linear-gradient(135deg, ${hue.blue}, ${hue.violet})` : ink.paper,
      border: accent ? "1px solid rgba(255,255,255,0.28)" : `1px solid ${ink.line}`,
      boxShadow: accent ? shadow.glowBlue : shadow.flat,
      ...style,
    }}
  >
    {icon}
    {children}
  </div>
);

/* -------------------------------------------------------------------- code */

export type Part = {text: string; color?: string; weight?: number; dim?: boolean};

export const partsLength = (parts: Part[]): number =>
  parts.reduce((sum, part) => sum + part.text.length, 0);

/**
 * Renders coloured code, optionally truncated to `shown` characters so a line
 * can type itself in without losing its syntax colouring.
 */
export const Code: React.FC<{
  parts: Part[];
  shown?: number;
  style?: CSSProperties;
}> = ({parts, shown, style}) => {
  let consumed = 0;
  return (
    <span style={{fontFamily: mono, whiteSpace: "pre", ...style}}>
      {parts.map((part, index) => {
        const start = consumed;
        consumed += part.text.length;
        const visible =
          shown === undefined
            ? part.text
            : part.text.slice(0, Math.max(0, Math.min(part.text.length, shown - start)));
        if (visible.length === 0) return null;
        return (
          <span
            key={index}
            style={{
              color: part.color ?? ink[800],
              fontWeight: part.weight ?? 500,
              opacity: part.dim ? 0.62 : 1,
            }}
          >
            {visible}
          </span>
        );
      })}
    </span>
  );
};

export const Caret: React.FC<{frame: number; height?: number; color?: string}> = ({
  frame,
  height = 28,
  color = hue.blue,
}) => (
  <span
    style={{
      display: "inline-block",
      width: 11,
      height,
      marginLeft: 6,
      verticalAlign: -4,
      borderRadius: 2,
      background: color,
      opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0.18,
    }}
  />
);

/* ------------------------------------------------------------------- glyphs */

export const Globe: React.FC<{size?: number; color?: string}> = ({
  size = 30,
  color = hue.blue,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" />
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth="1.7" />
    <path d="M3 12h18" stroke={color} strokeWidth="1.7" />
  </svg>
);

export const Tick: React.FC<{size?: number; color?: string; progress?: number}> = ({
  size = 26,
  color = hue.green,
  progress = 1,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M4.5 12.6 L9.6 17.5 L19.5 6.8"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

export const Warn: React.FC<{size?: number; color?: string}> = ({
  size = 24,
  color = hue.amber,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 3.6 L21.4 20 H2.6 Z"
      stroke={color}
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
    <path d="M12 9.4v5" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
    <circle cx="12" cy="17.4" r="1.15" fill={color} />
  </svg>
);
