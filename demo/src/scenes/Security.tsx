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
      <Background glows={[{ color: colors.green, x: "50%", y: "54%", size: 850, opacity: 0.07 }]} />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 64, padding: "90px 130px" }}
      >
        <div
          style={{
            ...enter(frame, fps, 0, { y: 36 }),
            fontFamily: sans,
            fontSize: 88,
            fontWeight: 740,
            color: colors.text,
            letterSpacing: -1.4,
          }}
        >
          Safe by design.
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 28, width: "100%", justifyContent: "center" }}>
          {POINTS.map((p, i) => (
            <div
              key={p.title}
              style={{
                ...enter(frame, fps, 18 + i * 12, { y: 26, blur: 8 }),
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 24,
                padding: "38px 38px",
                borderRadius: 24,
                background: colors.card,
                border: `1px solid ${colors.cardBorder}`,
                width: 480,
                minHeight: 290,
                boxShadow: "0 18px 48px rgba(31,52,82,0.08)",
              }}
            >
              <Check />
              <div>
                <div style={{ fontFamily: sans, fontSize: 38, fontWeight: 650, color: colors.text }}>
                  {p.title}
                </div>
                <div style={{ fontFamily: sans, fontSize: 27, lineHeight: 1.25, fontWeight: 400, color: colors.textDim, marginTop: 10 }}>
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
      boxShadow: "0 10px 26px rgba(18,161,80,0.20)",
    }}
  >
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <polyline
        points="7,18 14,25 27,10"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </div>
);
