import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors } from "../theme";

type GlowSpec = { color: string; x: string; y: string; size: number; opacity: number };

/**
 * Clean white canvas with soft, slowly drifting color washes and a faint grid.
 */
export const Background: React.FC<{ glows?: GlowSpec[]; vignette?: boolean }> = ({
  glows = [{ color: colors.blue, x: "58%", y: "24%", size: 900, opacity: 0.08 }],
  vignette = true,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 110) * 12;

  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(22,119,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(22,119,255,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 76%)",
        }}
      />
      {glows.map((g, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: g.x,
            top: g.y,
            width: g.size,
            height: g.size,
            translate: `-50% calc(-50% + ${drift * (i % 2 ? -1 : 1)}px)`,
            background: `radial-gradient(circle, ${g.color} 0%, transparent 62%)`,
            opacity: g.opacity,
            filter: "blur(55px)",
            borderRadius: "50%",
          }}
        />
      ))}
      {vignette && (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(246,249,253,0.72) 100%)",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
