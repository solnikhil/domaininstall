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
    { label: "your domain", value: "stripe.com" },
    { label: "DNS-over-HTTPS", value: "TXT lookup" },
    { label: "the package", value: "stripe" },
  ];

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background glows={[{ color: colors.purple, x: "50%", y: "60%", size: 1100, opacity: 0.16 }]} />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 66, padding: 80 }}
      >
        <div
          style={{
            ...enter(frame, fps, 0, { y: 36 }),
            fontFamily: sans,
            fontSize: 68,
            fontWeight: 700,
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
            fontSize: 38,
            padding: "34px 42px",
            borderRadius: 22,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${colors.cardBorder}`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            display: "flex",
            gap: 26,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: 940,
          }}
        >
          <span style={{ color: colors.textDim }}>_dnstall.stripe.com</span>
          <span style={{ color: colors.yellow }}>TXT</span>
          <span style={{ color: colors.text }}>
            "dnstall=<span style={{ color: colors.green }}>pkg:npm/stripe</span>"
          </span>
        </div>

        {/* flow */}
        <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap", justifyContent: "center" }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.label}>
              <div
                style={{
                  ...enter(frame, fps, 40 + i * 12, { y: 22, blur: 6 }),
                  textAlign: "center",
                  padding: "22px 30px",
                  borderRadius: 18,
                  background: i === 2 ? "linear-gradient(135deg,#0a84ff,#bf5af2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${i === 2 ? "transparent" : colors.cardBorder}`,
                  minWidth: 210,
                }}
              >
                <div style={{ fontFamily: sans, fontSize: 26, color: i === 2 ? "rgba(255,255,255,0.8)" : colors.textDim, marginBottom: 8 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: mono, fontSize: 36, fontWeight: 600, color: "#fff" }}>{s.value}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={enter(frame, fps, 46 + i * 12, { y: 0, blur: 4 })}>
                  <Chevron size={46} color={colors.textDim} weight={2.2} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div
          style={{
            ...enter(frame, fps, 80, { y: 20, blur: 6 }),
            fontFamily: sans,
            fontSize: 38,
            fontWeight: 300,
            color: colors.textDim,
          }}
        >
          No server to run. It never executes the record.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
