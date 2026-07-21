import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { colors } from "../theme";
import { sans, mono } from "../fonts";
import { enter, exitFade } from "../anim";
import { Chevron } from "../components/Icons";

export const HowItWorks: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitFade(frame, duration, 18);

  const steps = [
    { label: "your domain", value: "zuraai.xyz" },
    { label: "DNS-over-HTTPS", value: "TXT lookup" },
    { label: "the package", value: "zuraai" },
  ];

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background glows={[{ color: colors.purple, x: "50%", y: "64%", size: 820, opacity: 0.07 }]} />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 42, padding: "80px 120px" }}
      >
        <div
          style={{
            ...enter(frame, fps, 0, { y: 36 }),
            fontFamily: sans,
            fontSize: 80,
            fontWeight: 740,
            color: colors.text,
            letterSpacing: -1.2,
          }}
        >
          One DNS record.
        </div>

        {/* the record */}
        <div
          style={{
            ...enter(frame, fps, 14, { y: 30, blur: 10 }),
            fontFamily: mono,
            fontSize: 31,
            padding: "26px 38px",
            borderRadius: 20,
            background: colors.card,
            border: `1px solid ${colors.cardBorder}`,
            boxShadow: "0 18px 48px rgba(31,52,82,0.10)",
            display: "flex",
            gap: 26,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: 1560,
          }}
        >
          <span style={{ color: colors.textDim }}>_dnstall.zuraai.xyz</span>
          <span style={{ color: colors.yellow }}>TXT</span>
          <span style={{ color: colors.text }}>
            "dnstall=<span style={{ color: colors.green }}>pkg:npm/zuraai</span>"
          </span>
        </div>

        {/* flow */}
        <div style={{ display: "flex", alignItems: "center", gap: 30, justifyContent: "center" }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.label}>
              <div
                style={{
                  ...enter(frame, fps, 40 + i * 12, { y: 22, blur: 6 }),
                  textAlign: "center",
                  padding: "20px 32px",
                  borderRadius: 18,
                  background: i === 2 ? "linear-gradient(135deg,#1677ff,#7857d9)" : colors.card,
                  border: `1px solid ${i === 2 ? "transparent" : colors.cardBorder}`,
                  minWidth: 330,
                  boxShadow: i === 2 ? "0 18px 42px rgba(22,119,255,0.20)" : "0 12px 32px rgba(31,52,82,0.08)",
                }}
              >
                <div style={{ fontFamily: sans, fontSize: 24, color: i === 2 ? "rgba(255,255,255,0.8)" : colors.textDim, marginBottom: 7 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: mono, fontSize: 34, fontWeight: 600, color: i === 2 ? "#fff" : colors.text }}>{s.value}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={enter(frame, fps, 46 + i * 12, { y: 0, blur: 4 })}>
                  <Chevron size={42} color={colors.blue} weight={2.2} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div
          style={{
            ...enter(frame, fps, 80, { y: 20, blur: 6 }),
            fontFamily: sans,
            fontSize: 30,
            fontWeight: 420,
            color: colors.textDim,
          }}
        >
          No server to run. It never executes the record.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
