import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Logo } from "../components/Logo";
import { colors } from "../theme";
import { sans, mono } from "../fonts";
import { enter, inFade } from "../anim";

export const Outro: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const io = inFade(frame, 16);
  const tail = interpolate(frame, [duration - 20, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: io * tail }}>
      <Background
        glows={[
          { color: colors.blue, x: "66%", y: "40%", size: 850, opacity: 0.10 },
          { color: colors.purple, x: "34%", y: "76%", size: 650, opacity: 0.06 },
        ]}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 24 }}>
        <div style={enter(frame, fps, 2, { y: 40, blur: 14, scaleFrom: 0.85, damping: 15 })}>
          <div style={{ filter: "drop-shadow(0 26px 60px rgba(10,132,255,0.4))" }}>
            <Logo size={170} />
          </div>
        </div>

        <div
          style={{
            ...enter(frame, fps, 12, { y: 32, blur: 10 }),
            fontFamily: sans,
            fontSize: 100,
            fontWeight: 750,
            color: colors.text,
            letterSpacing: -3.8,
          }}
        >
          domaininstall
        </div>

        <div
          style={{
            ...enter(frame, fps, 22, { y: 24, blur: 6 }),
            fontFamily: sans,
            fontSize: 44,
            fontWeight: 430,
            color: colors.textDim,
            letterSpacing: 0.4,
          }}
        >
          The domain is the package.
        </div>

        <div
          style={{
            ...enter(frame, fps, 34, { y: 22, blur: 6 }),
            marginTop: 20,
            fontFamily: mono,
            fontSize: 34,
            color: colors.text,
            padding: "20px 34px",
            borderRadius: 18,
            background: colors.card,
            border: `1px solid ${colors.cardBorder}`,
            boxShadow: "0 16px 40px rgba(31,52,82,0.09)",
          }}
        >
          <span style={{ color: colors.green }}>$</span> npm i -g domaininstall
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
