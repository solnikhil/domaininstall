import { interpolate, spring } from "remotion";
import type React from "react";

/** Apple-style entrance: fade + upward drift + de-blur, driven by a spring. */
export function enter(
  frame: number,
  fps: number,
  delay = 0,
  opts: { y?: number; blur?: number; damping?: number; scaleFrom?: number } = {},
): React.CSSProperties {
  const { y = 40, blur = 10, damping = 200, scaleFrom = 1 } = opts;
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping, mass: 0.7, stiffness: 120 },
    durationInFrames: 30,
  });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const translateY = interpolate(s, [0, 1], [y, 0]);
  const blurPx = interpolate(s, [0, 1], [blur, 0]);
  const scale = interpolate(s, [0, 1], [scaleFrom, 1]);
  return {
    opacity,
    transform: `translateY(${translateY}px) scale(${scale})`,
    filter: `blur(${blurPx}px)`,
  };
}

/** Fade an element out over its final frames (for clean scene hand-offs). */
export function exitFade(frame: number, duration: number, tail = 18): number {
  return interpolate(frame, [duration - tail, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Fade in over the first `len` frames of a scene. */
export function inFade(frame: number, len = 16): number {
  return interpolate(frame, [0, len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
