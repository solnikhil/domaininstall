import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { colors } from "../theme";
import { sans, mono } from "../fonts";
import { enter, exitFade } from "../anim";

const TAKEN = ["http", "auth", "config", "utils", "logger", "cache", "api", "server"];

export const Problem: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitFade(frame, duration, 20);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background glows={[{ color: colors.red, x: "50%", y: "62%", size: 1000, opacity: 0.14 }]} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          padding: 90,
          gap: 54,
        }}
      >
        <div
          style={{
            ...enter(frame, fps, 0, { y: 40 }),
            fontFamily: sans,
            fontSize: 78,
            fontWeight: 700,
            color: colors.text,
            textAlign: "center",
            letterSpacing: -1.5,
            lineHeight: 1.1,
          }}
        >
          Every good name
          <br />
          is already taken.
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            justifyContent: "center",
            maxWidth: 820,
          }}
        >
          {TAKEN.map((name, i) => {
            const st = enter(frame, fps, 22 + i * 4, { y: 24, blur: 6 });
            const strike = interpolate(frame, [40 + i * 4, 52 + i * 4], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={name}
                style={{
                  ...st,
                  position: "relative",
                  fontFamily: mono,
                  fontSize: 40,
                  fontWeight: 500,
                  color: colors.textDim,
                  padding: "12px 26px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.hairline}`,
                }}
              >
                {name}
                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    right: 14,
                    top: "52%",
                    height: 4,
                    borderRadius: 2,
                    background: colors.red,
                    transform: `scaleX(${strike})`,
                    transformOrigin: "left",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div
          style={{
            ...enter(frame, fps, 74, { y: 24, blur: 6 }),
            fontFamily: sans,
            fontSize: 40,
            fontWeight: 300,
            color: colors.textDim,
            textAlign: "center",
          }}
        >
          …and the look-alikes can be malicious.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
