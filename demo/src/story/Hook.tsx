import React from "react";
import {AbsoluteFill, interpolate} from "remotion";
import {mono} from "../fonts";
import {
  CLAMP,
  PERSPECTIVE,
  SAFE,
  cue,
  hue,
  impulse,
  ink,
  radius,
  ramp,
  rise,
  settle,
  shadow,
  tilt,
} from "../design";
import {Card, Headline, Text, Tick} from "../components/primitives";

/* The three names differ by exactly one character. `bad` marks which one. */
const CANDIDATES = [
  {name: "examp1e-package", bad: 5},
  {name: "example-package", bad: -1},
  {name: "example-packge", bad: 12},
] as const;

/* On the beat grid: beat = 18 frames at 100bpm. */
const CARDS_AT = 18; // beat 1
const SCAN_AT = 30;
const REVEAL_AT = 54; // beat 3
const BADGE_AT = 58;
const CAPTION_AT = 72; // beat 4

const NameLine: React.FC<{name: string; bad: number; reveal: number; pulse: number}> = ({
  name,
  bad,
  reveal,
  pulse,
}) => (
  <div
    style={{
      display: "flex",
      fontFamily: mono,
      fontSize: 38,
      fontWeight: 600,
      letterSpacing: -1,
      color: ink[900],
      whiteSpace: "pre",
    }}
  >
    {Array.from(name).map((char, index) => {
      if (index !== bad) return <span key={index}>{char}</span>;
      const mix = (from: number, to: number) => Math.round(interpolate(reveal, [0, 1], [from, to]));
      return (
        <span
          key={index}
          style={{
            display: "inline-block",
            color: `rgb(${mix(8, 225)}, ${mix(13, 29)}, ${mix(24, 72)})`,
            scale: 1 + pulse * 0.12,
            translate: `0 ${-pulse * 2}px`,
            textShadow: `0 6px 20px rgba(225,29,72,${0.32 * reveal})`,
          }}
        >
          {char}
        </span>
      );
    })}
  </div>
);

const Badge: React.FC<{show: number; real: boolean}> = ({show, real}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      height: 40,
      padding: "0 16px",
      borderRadius: radius.sm,
      fontFamily: mono,
      fontSize: 15,
      fontWeight: 700,
      letterSpacing: 2.2,
      color: real ? hue.green : hue.red,
      background: real ? hue.greenSoft : hue.redSoft,
      border: `1px solid ${real ? "#bfe9d5" : "#ffd2dc"}`,
      opacity: show,
      translate: `0 ${(1 - show) * 14}px`,
      scale: settle(show, 0.94),
    }}
  >
    {real ? (
      <Tick size={17} progress={show} />
    ) : (
      <span style={{width: 9, height: 9, borderRadius: "50%", background: hue.red}} />
    )}
    {real ? "AUTHENTIC" : "TYPOSQUAT"}
  </div>
);

export const Hook: React.FC<{frame: number}> = ({frame}) => {
  const reveal = cue(frame, REVEAL_AT, 16);
  const pulse = Math.max(0, Math.sin((frame - REVEAL_AT) * 0.3)) * impulse(frame, REVEAL_AT, 28);
  const scan = ramp(frame, SCAN_AT, 20);

  return (
    <AbsoluteFill style={{...SAFE, alignItems: "center", justifyContent: "center", gap: 62}}>
      <Headline
        words={[
          {text: "Which"},
          {text: "one"},
          {text: "is"},
          {text: "the"},
          {text: "real", color: hue.blue},
          {text: "package?"},
        ]}
        progressOf={(index) => cue(frame, index * 4, 20)}
      />

      {/*
        Panel vocabulary: THE DECK. Cards are dealt in on a tilt and flatten as
        they land; on the reveal the real one rises toward the lens while the
        fakes lean back. The answer separates in depth.
      */}
      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 40,
          perspective: PERSPECTIVE,
          transformStyle: "preserve-3d",
        }}
      >
        {CANDIDATES.map((candidate, index) => {
          const enter = cue(frame, CARDS_AT + index * 6, 20);
          const real = candidate.bad < 0;
          const lift = real ? reveal * 22 : reveal * -8;
          const fade = real ? 1 : interpolate(reveal, [0, 1], [1, 0.68], CLAMP);
          return (
            <Card
              key={candidate.name}
              style={{
                width: 520,
                boxSizing: "border-box",
                padding: "36px 36px 30px",
                opacity: enter * fade,
                transform: [
                  `translateY(${(1 - enter) * 80 - lift}px)`,
                  `rotateX(${(1 - enter) * -16 + (real ? 0 : reveal * 7)}deg)`,
                  `scale(${settle(enter, 0.94) * (real ? 1 + reveal * 0.03 : 1 - reveal * 0.03)})`,
                ].join(" "),
                filter: enter > 0.995 ? "none" : `blur(${(1 - enter) * 8}px)`,
                borderColor: real
                  ? `rgba(47,102,255,${0.12 + reveal * 0.45})`
                  : `rgba(225,29,72,${reveal * 0.35})`,
                boxShadow: real
                  ? `${shadow.card}${reveal > 0 ? `, 0 0 0 ${reveal * 5}px rgba(47,102,255,0.09)` : ""}`
                  : shadow.card,
              }}
            >
              <NameLine name={candidate.name} bad={candidate.bad} reveal={reveal} pulse={pulse} />
              <div style={{marginTop: 26, height: 40}}>
                <Badge show={cue(frame, BADGE_AT + index * 3, 14)} real={real} />
              </div>
            </Card>
          );
        })}

        {/* the inspection pass: the beat where you try to tell them apart */}
        <div
          style={{
            position: "absolute",
            top: -30,
            bottom: -30,
            width: 320,
            left: `${interpolate(scan, [0, 1], [-16, 100], CLAMP)}%`,
            translate: "-50% 0",
            background:
              "linear-gradient(90deg, rgba(47,102,255,0) 0%, rgba(47,102,255,0.13) 45%, rgba(47,102,255,0.02) 100%)",
            filter: "blur(22px)",
            opacity: interpolate(scan, [0, 0.2, 0.8, 1], [0, 1, 1, 0], CLAMP),
          }}
        />
      </div>

      <div style={{perspective: PERSPECTIVE}}>
        <Text
          as="lead"
          color={ink[500]}
          style={{...tilt(cue(frame, CAPTION_AT, 18), -10, 24), textAlign: "center"}}
        >
          One character off is a different package.
        </Text>
      </div>
    </AbsoluteFill>
  );
};
