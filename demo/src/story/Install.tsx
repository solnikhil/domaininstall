import React from "react";
import {AbsoluteFill, interpolate} from "remotion";
import {mono, sans} from "../fonts";
import {
  CLAMP,
  SAFE,
  cue,
  hue,
  ink,
  ramp,
  rise,
  settle,
  shadow,
  type,
  wipeLeft,
  wipeOpen,
  wipeRight,
} from "../design";
import {Caret, Code, Tick, type Part} from "../components/primitives";

/*
 * Panel vocabulary: THE SPINE.
 *
 * A hairline draws down the middle of the page and three facts are uncovered
 * outward from it — labels left, values right. Then the exact npm command opens
 * from the centre, gets a yes, and lands.
 *
 * The real CLI prints eight rows before the command. Three is what a viewer can
 * take in at this speed, so the other five are cut: the command line itself
 * carries the rest.
 */

const TYPE_FROM = 4;
const TYPE_TO = 26;
const SPINE_AT = 24;
const ROWS_FROM = 30;
const ROW_STEP = 6;
const RUN_AT = 66;
const ASK_AT = 96;
const ANSWER_AT = 108;
const DONE_AT = 126; // beat 7 — the drop in the track lands on this frame

const COMMAND = "di example.com";

const WILL_RUN: Part[] = [
  {text: "npm install ", color: ink[900], weight: 700},
  {text: "--ignore-scripts ", color: hue.green, weight: 700},
  {text: "example-package", color: hue.violet, weight: 700},
];

const ROWS: Array<{label: string; value: React.ReactNode}> = [
  {label: "package", value: <span style={{color: ink[900], fontWeight: 700}}>example-package</span>},
  {label: "registry", value: <span style={{color: ink[600]}}>registry.npmjs.org</span>},
  {label: "scripts", value: <span style={{color: hue.green, fontWeight: 700}}>disabled</span>},
];

const LABEL_W = 260;
const VALUE_W = 620;
const ROW_H = 52;

export const Install: React.FC<{frame: number}> = ({frame}) => {
  const shown = Math.max(
    0,
    Math.floor((frame - TYPE_FROM) * (COMMAND.length / (TYPE_TO - TYPE_FROM))),
  );
  const typing = frame >= TYPE_FROM - 2 && frame < TYPE_TO + 10;
  const spine = ramp(frame, SPINE_AT, 22);
  const run = cue(frame, RUN_AT, 20);
  const runScan = ramp(frame, RUN_AT, 24);
  const answer = cue(frame, ANSWER_AT, 12);
  const done = cue(frame, DONE_AT, 20);
  const doneRing = ramp(frame, DONE_AT + 2, 28);

  return (
    <AbsoluteFill style={{...SAFE, alignItems: "center", justifyContent: "center", gap: 44}}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          fontFamily: mono,
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: -2.8,
          color: ink[900],
          whiteSpace: "pre",
        }}
      >
        <span style={{color: hue.blue, marginRight: 20}}>›</span>
        {COMMAND.slice(0, shown)}
        {typing ? <Caret frame={frame} height={60} /> : null}
      </div>

      {/* three facts, wiped outward from the spine */}
      <div style={{position: "relative", width: LABEL_W + VALUE_W + 80, opacity: 1 - done * 0.55}}>
        <div
          style={{
            position: "absolute",
            left: LABEL_W + 40,
            top: 0,
            width: 1,
            height: ROWS.length * ROW_H,
            background: `linear-gradient(180deg, ${hue.blue}, ${ink[200]})`,
            transformOrigin: "top",
            scale: `1 ${spine}`,
          }}
        />
        {ROWS.map((row, index) => {
          const t = cue(frame, ROWS_FROM + index * ROW_STEP, 16);
          return (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                height: ROW_H,
                gap: 80,
                fontFamily: mono,
                fontSize: 29,
                whiteSpace: "pre",
              }}
            >
              <span
                style={{
                  width: LABEL_W,
                  textAlign: "right",
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: 2.8,
                  textTransform: "uppercase",
                  color: ink[400],
                  ...wipeLeft(t),
                }}
              >
                {row.label}
              </span>
              <span style={{width: VALUE_W, ...wipeRight(t)}}>{row.value}</span>
            </div>
          );
        })}
      </div>

      {/* the exact command, opened from the centre with a light passing through */}
      <div
        style={{
          position: "relative",
          padding: "22px 30px",
          boxSizing: "border-box",
          borderRadius: 16,
          background: hue.blueSoft,
          boxShadow: shadow.flat,
          overflow: "hidden",
          opacity: 1 - done * 0.4,
          ...wipeOpen(run),
        }}
      >
        <Code parts={WILL_RUN} style={{fontSize: 30, letterSpacing: -0.8}} />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 220,
            left: `${interpolate(runScan, [0, 1], [-20, 105], CLAMP)}%`,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 100%)",
            opacity: interpolate(runScan, [0, 0.15, 0.85, 1], [0, 1, 1, 0], CLAMP),
            filter: "blur(10px)",
          }}
        />
      </div>

      {/* the answer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: mono,
          fontSize: 28,
          whiteSpace: "pre",
          color: ink[500],
          opacity: (1 - done * 0.7) * cue(frame, ASK_AT, 14),
          translate: `0 ${(1 - cue(frame, ASK_AT, 14)) * 12}px`,
        }}
      >
        Continue? <span style={{color: ink[400]}}>(y/N) </span>
        <span
          style={{
            display: "inline-block",
            color: hue.green,
            fontWeight: 700,
            opacity: answer,
            scale: settle(answer, 0.5),
          }}
        >
          y
        </span>
        {frame >= ASK_AT && frame < ANSWER_AT + 6 ? (
          <Caret frame={frame} height={24} color={ink[300]} />
        ) : null}
      </div>

      {/* the landing */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          height: 92,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: interpolate(doneRing, [0, 1], [140, 1100], CLAMP),
            height: interpolate(doneRing, [0, 1], [140, 1100], CLAMP) * 0.3,
            borderRadius: "50%",
            border: `1px solid ${hue.green}`,
            opacity: interpolate(doneRing, [0, 0.2, 1], [0, 0.34, 0], CLAMP),
          }}
        />
        <div style={{opacity: done, scale: settle(done, 0.55), display: "flex"}}>
          <Tick size={58} progress={cue(frame, DONE_AT + 3, 18)} />
        </div>
        <div
          style={{
            fontFamily: sans,
            fontSize: type.h2.size,
            fontWeight: type.h2.weight,
            letterSpacing: type.h2.tracking,
            color: ink[900],
            ...rise(done, 24, 5),
          }}
        >
          Installed.
        </div>
      </div>
    </AbsoluteFill>
  );
};
