import React from "react";
import { colors } from "../theme";
import { sans as font_display, mono as font_mono } from "../fonts";

/** A focused macOS-style terminal window on the bright editorial canvas. */
export const Terminal: React.FC<{
  title?: string;
  width?: number;
  minHeight?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ title = "zsh — di", width = 1320, minHeight = 650, style, children }) => {
  return (
    <div
      style={{
        width,
        minHeight,
        borderRadius: 24,
        background: "#111827",
        border: "1px solid rgba(16,24,40,0.16)",
        boxShadow:
          "0 34px 90px rgba(31,52,82,0.20), 0 8px 24px rgba(31,52,82,0.10), inset 0 1px 0 rgba(255,255,255,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {/* title bar */}
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          gap: 10,
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
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: 0.2,
            marginRight: 46,
          }}
        >
          {title}
        </div>
      </div>
      {/* body */}
      <div
        style={{
          flex: 1,
          padding: "28px 34px",
          fontFamily: font_mono,
          fontSize: 26,
          lineHeight: 1.42,
          color: "#f8fafc",
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
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: color,
      boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)",
    }}
  />
);
