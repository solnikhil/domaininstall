import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors } from "../theme";

type GlowSpec = { color: string; x: string; y: string; size: number; opacity: number };

/**
 * Deep-black backdrop with soft, slowly drifting color glows — the signature
 * Apple keynote "dark stage" look.
 */
export const Background: React.FC<{ glows?: GlowSpec[]; vignette?: boolean }> = ({
  glows = [{ color: colors.blue, x: "50%", y: "28%", size: 1100, opacity: 0.22 }],
  vignette = true,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 18;

  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      {glows.map((g, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: g.x,
            top: g.y,
            width: g.size,
            height: g.size,
            transform: `translate(-50%,-50%) translateY(${drift * (i % 2 ? -1 : 1)}px)`,
            background: `radial-gradient(circle, ${g.color} 0%, transparent 62%)`,
            opacity: g.opacity,
            filter: "blur(30px)",
            borderRadius: "50%",
          }}
        />
      ))}
      {vignette && (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
