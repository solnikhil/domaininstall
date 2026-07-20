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
      <Background glows={[{ color: colors.red, x: "72%", y: "55%", size: 780, opacity: 0.07 }]} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
          padding: "100px 150px",
          gap: 110,
        }}
      >
        <div style={{ width: 690, display: "flex", flexDirection: "column", gap: 34 }}>
          <div
            style={{
              ...enter(frame, fps, 0, { y: 34 }),
              fontFamily: sans,
              fontSize: 92,
              fontWeight: 740,
              color: colors.text,
              letterSpacing: -3.6,
              lineHeight: 1.04,
            }}
          >
            Every good name is already taken.
          </div>
          <div
            style={{
              ...enter(frame, fps, 62, { y: 18, blur: 4 }),
              fontFamily: sans,
              fontSize: 38,
              lineHeight: 1.25,
              color: colors.textDim,
            }}
          >
            And look-alikes can be malicious.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            alignContent: "center",
            justifyContent: "flex-start",
            width: 760,
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
                  fontSize: 38,
                  fontWeight: 500,
                  color: colors.textDim,
                  padding: "14px 28px",
                  borderRadius: 18,
                  background: colors.card,
                  border: `1px solid ${colors.hairline}`,
                  boxShadow: "0 12px 30px rgba(31,52,82,0.07)",
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

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
