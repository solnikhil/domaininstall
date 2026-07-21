import { Easing, interpolate } from "remotion";
import type React from "react";

/** Smooth editorial entrance: quick fade, gentle lift, and light de-blur. */
export function enter(
  frame: number,
  fps: number,
  delay = 0,
  opts: { y?: number; blur?: number; damping?: number; scaleFrom?: number } = {},
): React.CSSProperties {
  const { y = 28, blur = 6, scaleFrom = 0.985 } = opts;
  const progress = interpolate(frame, [delay, delay + Math.round(fps * 0.7)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [y, 0]);
  const blurPx = interpolate(progress, [0, 1], [blur, 0]);
  const scale = interpolate(progress, [0, 1], [scaleFrom, 1]);
  return {
    opacity,
    translate: `0 ${translateY}px`,
    scale,
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
