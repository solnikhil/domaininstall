import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Terminal } from "../components/Terminal";
import { Chevron, CheckMark, Spinner } from "../components/Icons";
import { colors } from "../theme";
import { sans } from "../fonts";
import { enter, exitFade } from "../anim";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const CMD = "di zuraai.xyz";
const TYPE_START = 16;
const CPS = 1.5;
const typeEnd = TYPE_START + Math.ceil(CMD.length / CPS);
const RESOLVE_START = typeEnd + 10;
const RESOLVED = RESOLVE_START + 34;
const SUMMARY = RESOLVED + 6;
const rows = [
  ["domain", "zuraai.xyz"],
  ["package", "zuraai"],
  ["version", "latest"],
  ["registry", "registry.npmjs.org"],
  ["will run", "npm install zuraai"],
];
const PROMPT = SUMMARY + rows.length * 7 + 16;
const TYPE_Y = PROMPT + 14;
const INSTALL = TYPE_Y + 12;
const DONE = INSTALL + 70;

const Caret: React.FC<{ frame: number }> = ({ frame }) =>
  Math.floor(frame / 15) % 2 === 0 ? (
    <span
      style={{
        display: "inline-block",
        width: 15,
        height: 34,
        background: colors.blue,
        borderRadius: 2,
        transform: "translateY(6px)",
        marginLeft: 4,
      }}
    />
  ) : (
    <span style={{ display: "inline-block", width: 15, marginLeft: 4 }} />
  );

export const TerminalDemo: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exitFade(frame, duration, 20);

  const typedLen = clamp(Math.floor((frame - TYPE_START) * CPS), 0, CMD.length);
  const resolving = frame >= RESOLVE_START && frame < RESOLVED;
  const resolved = frame >= RESOLVED;
  const win = enter(frame, fps, 0, { y: 70, blur: 18, scaleFrom: 0.92, damping: 16 });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background glows={[{ color: colors.blue, x: "50%", y: "42%", size: 1300, opacity: 0.22 }]} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={win}>
          <Terminal width={960} minHeight={900}>
            {/* command line */}
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Chevron color={colors.green} weight={2.8} size={30} />
              <span>
                {CMD.slice(0, typedLen)}
                {frame < PROMPT && <Caret frame={frame} />}
              </span>
            </div>

            {/* resolving spinner */}
            {frame >= RESOLVE_START && (
              <div style={{ marginTop: 18, color: colors.textDim, display: "flex", alignItems: "center", gap: 12 }}>
                {resolving ? (
                  <>
                    <Spinner frame={frame} size={30} />
                    <span>Resolving _dnstall.zuraai.xyz …</span>
                  </>
                ) : (
                  <>
                    <CheckMark size={30} />
                    <span>
                      resolved via cloudflare-dns.com{"   "}
                      <span style={{ color: colors.textDim, fontWeight: 500 }}>DNSSEC —</span>
                    </span>
                  </>
                )}
              </div>
            )}

            {/* summary card */}
            {resolved && (
              <div
                style={{
                  ...enter(frame, fps, SUMMARY, { y: 26, blur: 8 }),
                  marginTop: 26,
                  padding: "26px 30px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${colors.cardBorder}`,
                }}
              >
                {rows.map(([label, value], i) => {
                  const st = enter(frame, fps, SUMMARY + 4 + i * 7, { y: 14, blur: 4 });
                  const isRun = label === "will run";
                  return (
                    <div
                      key={label}
                      style={{ ...st, display: "flex", gap: 22, marginBottom: i === rows.length - 1 ? 0 : 12 }}
                    >
                      <span style={{ color: colors.textDim, width: 200, display: "inline-block" }}>
                        {label}
                      </span>
                      <span style={{ color: isRun ? colors.blue : colors.text, fontWeight: isRun ? 700 : 400 }}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* confirm prompt */}
            {frame >= PROMPT && (
              <div style={{ marginTop: 24, display: "flex", gap: 14, alignItems: "center" }}>
                <span>
                  Install <span style={{ fontWeight: 700 }}>zuraai</span> from{" "}
                  <span style={{ fontWeight: 700 }}>zuraai.xyz</span>?{" "}
                  <span style={{ color: colors.textDim }}>(y/N)</span>
                </span>
                <span style={{ color: colors.green }}>
                  {frame >= TYPE_Y ? "y" : ""}
                  {frame >= PROMPT && frame < INSTALL && <Caret frame={frame} />}
                </span>
              </div>
            )}

            {/* install output */}
            {frame >= INSTALL && (
              <div style={{ marginTop: 20, color: colors.textDim, fontSize: 30 }}>
                {frame >= INSTALL + 6 && (
                  <div style={enter(frame, fps, INSTALL + 6, { y: 8, blur: 2 })}>
                    added 1 package in 1.2s
                  </div>
                )}
                {frame >= DONE - 8 && (
                  <div
                    style={{
                      ...enter(frame, fps, DONE - 8, { y: 12, blur: 4 }),
                      marginTop: 16,
                      color: colors.green,
                      fontSize: 36,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <CheckMark size={36} />
                    <span>Installed zuraai from zuraai.xyz</span>
                  </div>
                )}
              </div>
            )}
          </Terminal>
        </div>

        {/* caption */}
        <div
          style={{
            opacity: interpolate(frame, [10, 30, duration - 24, duration], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            marginTop: 56,
            fontFamily: sans,
            fontSize: 40,
            fontWeight: 300,
            color: colors.textDim,
            letterSpacing: 0.3,
          }}
        >
          One command. Verified. Installed.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
