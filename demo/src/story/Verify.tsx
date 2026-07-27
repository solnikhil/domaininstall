import React from "react";
import {AbsoluteFill, interpolate} from "remotion";
import {mono, sans} from "../fonts";
import {
  CLAMP,
  PERSPECTIVE,
  SAFE,
  cue,
  flip,
  hue,
  ink,
  radius,
  ramp,
  rise,
  settle,
  shadow,
  type,
} from "../design";
import {Caret, Tick} from "../components/primitives";

/*
 * Panel vocabulary: BROADCAST BOARD.
 *
 * One line of text, two facts, one verdict. The lookup happens on the bare page
 * — the DNS name types itself while query rings push out of it, then the two
 * facts flip face-up and the verdict lands. Everything else that the real CLI
 * prints (resolver, outcome, raw records) is detail a viewer cannot read at
 * this speed, so it is gone.
 */

const TYPE_FROM = 6;
const TYPE_TO = 30;
const RINGS_FROM = 8;
const FACTS_FROM = 30; // beat 1.67
const VERDICT_AT = 54; // beat 3

const DNS_NAME = "_dnstall.example.com";

/** Concentric rings leaving the query. */
const QueryRings: React.FC<{frame: number}> = ({frame}) => (
  <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center"}}>
    {[0, 1, 2].map((index) => {
      const t = ramp(frame, RINGS_FROM + index * 9, 34);
      if (t <= 0 || t >= 1) return null;
      const size = interpolate(t, [0, 1], [200, 1500], CLAMP);
      return (
        <div
          key={index}
          style={{
            position: "absolute",
            width: size,
            height: size * 0.5,
            borderRadius: "50%",
            border: `1px solid ${hue.blue}`,
            opacity: interpolate(t, [0, 0.15, 1], [0, 0.3, 0], CLAMP),
          }}
        />
      );
    })}
  </div>
);

const FACTS = [
  {
    label: "dnssec",
    value: "authenticated",
    color: hue.green,
    tick: true,
  },
  {
    label: "nothing installed",
    value: "read-only lookup",
    color: hue.blue,
    tick: false,
  },
];

export const Verify: React.FC<{frame: number}> = ({frame}) => {
  const shown = Math.max(
    0,
    Math.floor((frame - TYPE_FROM) * (DNS_NAME.length / (TYPE_TO - TYPE_FROM))),
  );
  const typing = frame >= TYPE_FROM - 2 && frame < TYPE_TO + 8;
  const verdict = cue(frame, VERDICT_AT, 18);
  const ring = ramp(frame, VERDICT_AT + 2, 26);

  return (
    <AbsoluteFill style={{...SAFE, alignItems: "center", justifyContent: "center", gap: 56}}>
      {/* the query */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 150,
          width: "100%",
        }}
      >
        <QueryRings frame={frame} />
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "baseline",
            fontFamily: mono,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -3,
            whiteSpace: "pre",
          }}
        >
          <span style={{color: hue.cyan}}>{DNS_NAME.slice(0, shown)}</span>
          {typing ? <Caret frame={frame} height={64} color={hue.cyan} /> : null}
        </div>
      </div>

      {/* two facts, flipped face-up */}
      <div
        style={{
          display: "flex",
          gap: 32,
          perspective: PERSPECTIVE,
          opacity: interpolate(verdict, [0, 1], [1, 0.5], CLAMP),
        }}
      >
        {FACTS.map((fact, index) => {
          const t = cue(frame, FACTS_FROM + index * 8, 18);
          return (
            <div
              key={fact.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "22px 32px",
                borderRadius: radius.lg,
                background: ink.paper,
                border: `1px solid ${ink.line}`,
                boxShadow: shadow.flat,
                fontFamily: mono,
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: -0.6,
                color: fact.color,
                ...flip(t),
              }}
            >
              {fact.tick ? <Tick size={26} progress={t} /> : null}
              {fact.value}
            </div>
          );
        })}
      </div>

      {/* the verdict */}
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
            width: interpolate(ring, [0, 1], [140, 1000], CLAMP),
            height: interpolate(ring, [0, 1], [140, 1000], CLAMP) * 0.32,
            borderRadius: "50%",
            border: `1px solid ${hue.green}`,
            opacity: interpolate(ring, [0, 0.2, 1], [0, 0.32, 0], CLAMP),
          }}
        />
        <div style={{opacity: verdict, scale: settle(verdict, 0.6), display: "flex"}}>
          <Tick size={62} progress={cue(frame, VERDICT_AT + 3, 18)} />
        </div>
        <div
          style={{
            fontFamily: sans,
            fontSize: type.h2.size,
            fontWeight: type.h2.weight,
            letterSpacing: type.h2.tracking,
            color: ink[900],
            ...rise(verdict, 22, 5),
          }}
        >
          Verified.
        </div>
      </div>
    </AbsoluteFill>
  );
};
