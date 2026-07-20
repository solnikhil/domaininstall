import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { colors } from "../theme";
import { sans, mono } from "../fonts";
import { enter, exitFade } from "../anim";
import { Chevron } from "../components/Icons";

export const Solution: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitFade(frame, duration, 18);

  // arrow reveal
  const arrow = interpolate(frame, [46, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background
        glows={[{ color: colors.blue, x: "50%", y: "50%", size: 1200, opacity: 0.2 }]}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 70,
          padding: 80,
        }}
      >
        <div
          style={{
            ...enter(frame, fps, 0, { y: 44 }),
            fontFamily: sans,
            fontSize: 74,
            fontWeight: 700,
            color: colors.text,
            textAlign: "center",
            letterSpacing: -1.5,
            lineHeight: 1.12,
          }}
        >
          What if your domain
          <br />
          <span style={{ color: colors.blue }}>was</span> the package?
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            ...enter(frame, fps, 26, { y: 30, blur: 8 }),
          }}
        >
          <Pill text="stripe.com" mono />
          <div style={{ position: "relative", width: 90, height: 8 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                height: 6,
                top: 1,
                borderRadius: 3,
                background: colors.textDim,
                transform: `scaleX(${arrow})`,
                transformOrigin: "left",
              }}
            />
            <div style={{ position: "absolute", right: -10, top: -19, opacity: arrow }}>
              <Chevron size={44} color={colors.textDim} weight={2.4} />
            </div>
          </div>
          <Pill text="stripe" accent mono />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Pill: React.FC<{ text: string; accent?: boolean; mono?: boolean }> = ({
  text,
  accent,
}) => (
  <div
    style={{
      fontFamily: mono,
      fontSize: 46,
      fontWeight: 500,
      color: accent ? "#fff" : colors.text,
      padding: "18px 36px",
      borderRadius: 20,
      background: accent
        ? "linear-gradient(135deg,#0a84ff,#bf5af2)"
        : "rgba(255,255,255,0.06)",
      border: `1px solid ${accent ? "transparent" : colors.cardBorder}`,
      boxShadow: accent ? "0 20px 50px rgba(10,132,255,0.4)" : "none",
    }}
  >
    {text}
  </div>
);
