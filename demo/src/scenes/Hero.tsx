import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Logo } from "../components/Logo";
import { colors } from "../theme";
import { sans } from "../fonts";
import { enter, exitFade } from "../anim";

export const Hero: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitFade(frame, duration, 20);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background
        glows={[
          { color: colors.blue, x: "70%", y: "42%", size: 900, opacity: 0.10 },
          { color: colors.purple, x: "30%", y: "78%", size: 700, opacity: 0.06 },
        ]}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
          gap: 104,
          padding: "100px 150px",
        }}
      >
        <div style={enter(frame, fps, 0, { y: 36, blur: 10, scaleFrom: 0.9 })}>
          <div
            style={{
              filter: "drop-shadow(0 30px 56px rgba(22,119,255,0.22))",
            }}
          >
            <Logo size={300} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}>
          <div
            style={{
              ...enter(frame, fps, 10, { y: 30, blur: 8 }),
              fontFamily: sans,
              fontSize: 124,
              lineHeight: 0.96,
              fontWeight: 750,
              color: colors.text,
              letterSpacing: -5,
            }}
          >
            domaininstall
          </div>

          <div
            style={{
              ...enter(frame, fps, 20, { y: 22, blur: 5 }),
              fontFamily: sans,
              fontSize: 54,
              fontWeight: 420,
              color: colors.textDim,
              letterSpacing: -0.8,
            }}
          >
            Install by domain.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
