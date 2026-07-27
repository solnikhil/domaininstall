import React from "react";
import {AbsoluteFill, interpolate} from "remotion";
import {mono} from "../fonts";
import {CLAMP, SAFE, cue, hue, ink, ramp, rise, settle, shadow} from "../design";
import {Caret, Chip, Code, Globe, Headline, partsLength, type Part} from "../components/primitives";

/*
 * Panel vocabulary: INSCRIPTION.
 *
 * Nothing fades in here. The card is drawn — its outline is stroked on like a
 * pen going round a box — then the record is written into it character by
 * character, then a single pulse of light carries the answer down the wire.
 */

const RECORD: Part[] = [
  {text: "_dnstall.example.com.", color: ink[700], weight: 500},
  {text: "   "},
  {text: "TXT", color: hue.amber, weight: 700},
  {text: "   "},
  {text: '"dnstall=', color: ink[400], weight: 500},
  {text: "pkg:npm/", color: hue.blue, weight: 600},
  {text: "example-package", color: hue.violet, weight: 700},
  {text: '"', color: ink[400], weight: 500},
];

const CARD_W = 1460;
const CARD_H = 214;

/* On the beat grid: beat = 18 frames at 100bpm. */
const DRAW_AT = 18; // beat 1
const TYPE_FROM = 30;
const TYPE_TO = 66;
const PIPE_AT = 78; // beat 4.33

const Wire: React.FC<{progress: number}> = ({progress}) => {
  const head = interpolate(progress, [0.6, 1], [0, 1], CLAMP);
  return (
    <div
      style={{position: "relative", width: 210, height: 44, display: "flex", alignItems: "center"}}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          height: 2,
          width: 176,
          borderRadius: 2,
          transformOrigin: "left",
          scale: `${progress} 1`,
          background: `linear-gradient(90deg, ${ink[200]}, ${hue.blue})`,
        }}
      />
      {/* one pulse riding the wire: the answer being handed over */}
      <div
        style={{
          position: "absolute",
          left: interpolate(progress, [0, 1], [0, 168], CLAMP),
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: hue.blue,
          opacity: interpolate(progress, [0, 0.12, 0.86, 1], [0, 1, 1, 0], CLAMP),
          boxShadow: `0 0 16px ${hue.blue}`,
        }}
      />
      <div style={{position: "absolute", left: 168, opacity: head, scale: settle(head, 0.7)}}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12h14M13 6.5 19.5 12 13 17.5"
            stroke={hue.blue}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          top: -30,
          left: 0,
          width: 210,
          textAlign: "center",
          fontFamily: mono,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 2,
          color: ink[400],
          opacity: interpolate(progress, [0.25, 0.8], [0, 1], CLAMP),
        }}
      >
        DNS-OVER-HTTPS
      </div>
    </div>
  );
};

export const RecordScene: React.FC<{frame: number}> = ({frame}) => {
  const total = partsLength(RECORD);
  const shown = Math.round(interpolate(frame, [TYPE_FROM, TYPE_TO], [0, total], CLAMP));
  const typing = frame >= TYPE_FROM - 2 && frame < TYPE_TO + 10;
  const draw = ramp(frame, DRAW_AT, 24);
  const surface = cue(frame, DRAW_AT + 4, 18);

  return (
    <AbsoluteFill style={{...SAFE, alignItems: "center", justifyContent: "center", gap: 54}}>
      <Headline
        axis="x"
        words={[
          {text: "Type"},
          {text: "the"},
          {text: "domain."},
          {text: "Not", color: ink[300]},
          {text: "the", color: ink[300]},
          {text: "name.", color: ink[300]},
        ]}
        progressOf={(index) => cue(frame, index * 4, 20)}
      />

      {/* the record, drawn then written */}
      <div style={{position: "relative", width: CARD_W, height: CARD_H}}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 30,
            background: ink.paper,
            opacity: surface * 0.98,
            boxShadow: shadow.hero,
          }}
        />
        <svg
          width={CARD_W}
          height={CARD_H}
          style={{position: "absolute", inset: 0, overflow: "visible"}}
        >
          <rect
            x="0.75"
            y="0.75"
            width={CARD_W - 1.5}
            height={CARD_H - 1.5}
            rx="29"
            fill="none"
            stroke={hue.blue}
            strokeWidth="1.5"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
            opacity={interpolate(draw, [0, 0.9, 1], [0.85, 0.85, 0.3], CLAMP)}
          />
        </svg>

        <div style={{position: "absolute", inset: 0, padding: "0 42px"}}>
          <div
            style={{
              paddingTop: 26,
              paddingBottom: 20,
              borderBottom: `1px solid ${ink.hair}`,
              display: "flex",
              justifyContent: "space-between",
              fontFamily: mono,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 2.6,
              textTransform: "uppercase",
              color: ink[400],
              opacity: surface,
            }}
          >
            <span>dns · txt record</span>
            <span style={{position: "relative", fontWeight: 500, letterSpacing: 1.8}}>
              <span style={{opacity: 1 - cue(frame, TYPE_TO - 6, 16)}}>published by the owner</span>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  whiteSpace: "nowrap",
                  color: hue.blue,
                  opacity: cue(frame, TYPE_TO - 6, 16),
                }}
              >
                resolved
              </span>
            </span>
          </div>
          <div style={{paddingTop: 30}}>
            <Code parts={RECORD} shown={shown} style={{fontSize: 34, letterSpacing: -0.9}} />
            {typing ? <Caret frame={frame} height={34} /> : null}
          </div>
        </div>
      </div>

      <div style={{display: "flex", alignItems: "center", gap: 26}}>
        <div style={rise(cue(frame, PIPE_AT, 18), 18, 4)}>
          <Chip size={36} icon={<Globe size={28} />}>
            example.com
          </Chip>
        </div>
        <Wire progress={ramp(frame, PIPE_AT + 9, 20)} />
        <div
          style={{
            ...rise(cue(frame, PIPE_AT + 18, 18), 18, 4),
            scale: settle(cue(frame, PIPE_AT + 18, 18), 0.92),
          }}
        >
          <Chip size={36} accent>
            example-package
          </Chip>
        </div>
      </div>
    </AbsoluteFill>
  );
};
