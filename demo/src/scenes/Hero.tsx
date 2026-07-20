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
          { color: colors.blue, x: "50%", y: "34%", size: 1300, opacity: 0.28 },
          { color: colors.purple, x: "70%", y: "70%", size: 900, opacity: 0.16 },
        ]}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div style={enter(frame, fps, 0, { y: 60, blur: 16, scaleFrom: 0.82, damping: 14 })}>
          <div
            style={{
              filter: "drop-shadow(0 30px 60px rgba(10,132,255,0.35))",
            }}
          >
            <Logo size={260} />
          </div>
        </div>

        <div
          style={{
            ...enter(frame, fps, 12, { y: 40, blur: 12 }),
            fontFamily: sans,
            fontSize: 96,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: -2,
            marginTop: 20,
          }}
        >
          domaininstall
        </div>

        <div
          style={{
            ...enter(frame, fps, 22, { y: 28, blur: 8 }),
            fontFamily: sans,
            fontSize: 44,
            fontWeight: 300,
            color: colors.textDim,
            letterSpacing: 0.5,
          }}
        >
          Install by domain.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
