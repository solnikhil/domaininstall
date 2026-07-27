import React from "react";
import type {CSSProperties} from "react";
import {AbsoluteFill, interpolate} from "remotion";
import {
  CLAMP,
  HEIGHT,
  MOVES,
  ORDER,
  PERSPECTIVE,
  SLOT,
  TOTAL,
  TRAVEL,
  TRAVEL_LEAD,
  WIDTH,
  glide,
  ink,
  type Move,
} from "../design";

/* --------------------------------------------------------------- backdrop */

const BLOBS = [
  {color: "47,102,255", x: 16, y: 14, size: 1180, alpha: 0.13, drift: 0},
  {color: "122,83,255", x: 88, y: 26, size: 1040, alpha: 0.12, drift: 2.2},
  {color: "10,159,208", x: 76, y: 92, size: 1140, alpha: 0.1, drift: 4.1},
  {color: "255,120,150", x: 8, y: 86, size: 900, alpha: 0.1, drift: 1.3},
];

/**
 * White premium paper: a bright sheet with soft colour bleeding in from the
 * corners, a faint engineering grid, and a very slight vignette so the sheet
 * has edges.
 *
 * It sits behind every transition and drifts slowly against them, which is what
 * keeps five different moves feeling like one film.
 */
export const Backdrop: React.FC<{frame: number; travel: number}> = ({frame, travel}) => {
  const t = frame / TOTAL;

  // The warm blob is the "problem" light. It leaves once the film pivots to
  // the product, so the palette cools down as the story resolves.
  const warm = interpolate(
    frame,
    [SLOT.record.start - 30, SLOT.record.start + 40],
    [1, 0.16],
    CLAMP,
  );
  const cool = interpolate(frame, [SLOT.record.start, SLOT.verify.start], [0.82, 1], CLAMP);
  const lag = -travel * 22;

  return (
    <AbsoluteFill style={{background: ink.paper, overflow: "hidden"}}>
      <AbsoluteFill style={{translate: `0 ${lag}px`}}>
        {BLOBS.map((blob, index) => {
          const isWarm = index === 3;
          return (
            <div
              key={blob.color}
              style={{
                position: "absolute",
                width: blob.size,
                height: blob.size,
                left: `${blob.x + Math.sin(t * Math.PI * 2 + blob.drift) * 3.4}%`,
                top: `${blob.y + Math.cos(t * Math.PI * 2 + blob.drift) * 2.8}%`,
                translate: "-50% -50%",
                scale: 1 + Math.sin(frame / 190 + index) * 0.05,
                borderRadius: "50%",
                background: `radial-gradient(circle at 42% 38%, rgba(${blob.color},1), rgba(${blob.color},0) 68%)`,
                filter: "blur(70px)",
                opacity: blob.alpha * (isWarm ? warm : cool),
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* engineering grid, masked so it never touches the frame edge */}
      <AbsoluteFill
        style={{
          opacity: 0.5,
          backgroundImage:
            "linear-gradient(rgba(8,13,24,0.042) 1px, transparent 1px), linear-gradient(90deg, rgba(8,13,24,0.042) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          backgroundPosition: `${Math.sin(frame / 300) * 8}px ${lag * 0.5}px`,
          maskImage:
            "radial-gradient(ellipse 74% 66% at 50% 46%, rgba(0,0,0,0.9), transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 74% 66% at 50% 46%, rgba(0,0,0,0.9), transparent 100%)",
        }}
      />

      {/* paper lift: bright centre, softly weighted corners */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 42%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 50%, rgba(255,255,255,0) 52%, rgba(9,15,30,0.055) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ camera */

/**
 * Continuous position, in panels. Fractional while a transition is running, so
 * `2.4` means "40% of the way from panel 2 to panel 3".
 */
export const cameraAt = (frame: number): number => {
  let position = 0;
  for (let index = 1; index < ORDER.length; index++) {
    const panel = SLOT[ORDER[index]!]!;
    position += glide(frame, panel.start - TRAVEL_LEAD, TRAVEL);
  }
  return position;
};

/* ------------------------------------------------------------- transitions */

/**
 * The five moves. `t` is 0..1 across the boundary; `role` says whether this
 * panel is the one leaving or the one arriving.
 *
 * Every move is a physical idea rather than a fade — the frame is pushed,
 * panned, driven through, opened up, or turned over — and none of them repeats.
 */
const move = (kind: Move, t: number, role: "out" | "in"): CSSProperties => {
  const out = role === "out";
  const away = out ? t : 1 - t; // 0 = in place, 1 = fully gone

  switch (kind) {
    // straight up: the one move you already liked
    case "push":
      return {
        transform: `translateY(${out ? -t * HEIGHT : (1 - t) * HEIGHT}px) scale(${1 - away * 0.05})`,
        filter: away < 0.01 ? "none" : `blur(${away * 6}px)`,
      };

    // a sideways pan, as though the page continued to the right
    case "slide":
      return {
        transform: `translateX(${out ? -t * WIDTH : (1 - t) * WIDTH}px) scale(${1 - away * 0.04})`,
        filter: away < 0.01 ? "none" : `blur(${away * 5}px)`,
      };

    // the camera drives through the outgoing panel and lands on the next
    case "dolly":
      return {
        opacity: out ? Math.max(0, 1 - t * 1.15) : interpolate(t, [0.1, 0.6], [0, 1], CLAMP),
        transform: `scale(${out ? 1 + t * 0.5 : interpolate(t, [0, 1], [0.7, 1], CLAMP)})`,
        filter: away < 0.01 ? "none" : `blur(${away * 20}px)`,
      };

    // the next panel opens out of the middle of the frame
    case "iris":
      return out
        ? {
            transform: `scale(${1 - t * 0.06})`,
            filter: t < 0.01 ? "none" : `blur(${t * 8}px)`,
          }
        : {
            clipPath: `circle(${interpolate(t, [0, 1], [0, 118], CLAMP)}% at 50% 50%)`,
            transform: `scale(${interpolate(t, [0, 1], [1.08, 1], CLAMP)})`,
          };

    // the whole frame turns over, like a card being flipped
    case "swing":
      return {
        opacity: out ? Math.max(0, 1 - t * 1.2) : interpolate(t, [0.15, 0.7], [0, 1], CLAMP),
        transform: [
          `rotateY(${out ? -t * 22 : (1 - t) * 22}deg)`,
          `translateX(${out ? -t * WIDTH * 0.32 : (1 - t) * WIDTH * 0.32}px)`,
          `scale(${1 - away * 0.06})`,
        ].join(" "),
        filter: away < 0.01 ? "none" : `blur(${away * 7}px)`,
      };
  }
};

/** Only the card turn needs a 3D camera on the container. */
const NEEDS_PERSPECTIVE: Move[] = ["swing"];

/**
 * The deck. At rest exactly one panel is on screen; across a boundary the
 * outgoing and incoming panels are composed with that boundary's own move.
 */
export const Deck: React.FC<{position: number; panels: React.ReactNode[]}> = ({
  position,
  panels,
}) => {
  const from = Math.min(panels.length - 1, Math.floor(position + 1e-6));
  const t = Math.max(0, Math.min(1, position - from));
  const to = Math.min(panels.length - 1, from + 1);
  const kind = MOVES[Math.min(MOVES.length - 1, from)]!;
  const moving = t > 0.0005 && to !== from;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        perspective: NEEDS_PERSPECTIVE.includes(kind) ? PERSPECTIVE : undefined,
      }}
    >
      {moving ? (
        <AbsoluteFill style={{...move(kind, t, "out"), transformOrigin: "50% 50%"}}>
          {panels[from]}
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill
        style={
          moving
            ? {...move(kind, t, "in"), transformOrigin: "50% 50%"}
            : {transformOrigin: "50% 50%"}
        }
      >
        {panels[moving ? to : from]}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
