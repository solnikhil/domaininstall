import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { colors } from "../theme";
import { sans } from "../fonts";
import { enter, exitFade } from "../anim";

const POINTS = [
  { title: "Verified by DNS", sub: "the domain owner vouches for the package" },
  { title: "Pinned on first use", sub: "warns if a domain's mapping ever changes" },
  { title: "Never runs the record", sub: "it's a pointer, not code" },
];

export const Security: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitFade(frame, duration, 18);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background glows={[{ color: colors.green, x: "50%", y: "45%", size: 1100, opacity: 0.14 }]} />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 54, padding: 90 }}
      >
        <div
          style={{
            ...enter(frame, fps, 0, { y: 36 }),
            fontFamily: sans,
            fontSize: 72,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: -1.4,
          }}
        >
          Safe by design.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26, width: 800 }}>
          {POINTS.map((p, i) => (
            <div
              key={p.title}
              style={{
                ...enter(frame, fps, 18 + i * 12, { y: 26, blur: 8 }),
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: "26px 32px",
                borderRadius: 22,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${colors.cardBorder}`,
              }}
            >
              <Check />
              <div>
                <div style={{ fontFamily: sans, fontSize: 42, fontWeight: 600, color: colors.text }}>
                  {p.title}
                </div>
                <div style={{ fontFamily: sans, fontSize: 30, fontWeight: 300, color: colors.textDim, marginTop: 4 }}>
                  {p.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Check: React.FC = () => (
  <div
    style={{
      width: 64,
      height: 64,
      borderRadius: "50%",
      background: colors.green,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: "0 10px 30px rgba(48,209,88,0.4)",
    }}
  >
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <polyline
        points="7,18 14,25 27,10"
        stroke="#00220c"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </div>
);
