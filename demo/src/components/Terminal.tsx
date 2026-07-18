import React from "react";
import { colors } from "../theme";
import { sans as font_display, mono as font_mono } from "../fonts";

/** A macOS-style terminal window with traffic-light controls. */
export const Terminal: React.FC<{
  title?: string;
  width?: number;
  minHeight?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ title = "zsh — dnstall", width = 900, minHeight = 520, style, children }) => {
  return (
    <div
      style={{
        width,
        minHeight,
        borderRadius: 28,
        background: "rgba(22,22,24,0.92)",
        border: `1px solid ${colors.cardBorder}`,
        boxShadow:
          "0 40px 120px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
        backdropFilter: "blur(30px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {/* title bar */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          padding: "0 26px",
          gap: 12,
          background: "rgba(255,255,255,0.03)",
          borderBottom: `1px solid ${colors.hairline}`,
        }}
      >
        <Dot color="#ff5f57" />
        <Dot color="#febc2e" />
        <Dot color="#28c840" />
        <div
          style={{
            flex: 1,
            textAlign: "center",
            color: colors.textDim,
            fontFamily: font_display,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: 0.2,
            marginRight: 54,
          }}
        >
          {title}
        </div>
      </div>
      {/* body */}
      <div
        style={{
          flex: 1,
          padding: "36px 40px",
          fontFamily: font_mono,
          fontSize: 34,
          lineHeight: 1.55,
          color: colors.text,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: color,
      boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)",
    }}
  />
);
