import React from "react";
import {AbsoluteFill} from "remotion";
import {mono} from "../fonts";
import {PERSPECTIVE, SAFE, cue, fold, hue, impulse, ink, ramp, rise, shadow} from "../design";
import {Card, Code, Headline, Text, Warn, type Part} from "../components/primitives";

/*
 * Panel vocabulary: THE FOLD.
 *
 * Two panels swing in on their outer hinges, like a document being opened. The
 * left one is what was remembered, the right one is what happens if it changes.
 * Trimmed to the two lines that matter — the rest of the CLI's warning text is
 * unreadable at this speed.
 */

const CARD_W = 760;
const CARD_H = 268;

const PIN: Part[] = [
  {text: '"example.com"', color: hue.blue, weight: 700},
  {text: ": {\n"},
  {text: '  "package"'},
  {text: ":   "},
  {text: '"example-package"', color: hue.violet, weight: 600},
  {text: ",\n"},
  {text: '  "firstSeen"'},
  {text: ": "},
  {text: '"2026-07-25"', color: ink[500]},
  {text: "\n}"},
];

const Header: React.FC<{children: React.ReactNode; color?: string; upper?: boolean}> = ({
  children,
  color = ink[400],
  upper,
}) => (
  <div
    style={{
      padding: "20px 30px",
      borderBottom: `1px solid ${ink.hair}`,
      fontFamily: mono,
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: upper ? 2.6 : 0.4,
      textTransform: upper ? "uppercase" : "none",
      color,
    }}
  >
    {children}
  </div>
);

export const Trust: React.FC<{frame: number}> = ({frame}) => {
  /* On the beat grid: beat = 18 frames at 100bpm. */
  const left = cue(frame, 18, 22); // beat 1
  const right = cue(frame, 24, 22);
  const flag = cue(frame, 42, 18);
  const strike = ramp(frame, 48, 18);
  const breathe = Math.max(0, Math.sin((frame - 42) * 0.28)) * impulse(frame, 42, 34);

  return (
    <AbsoluteFill style={{...SAFE, alignItems: "center", justifyContent: "center", gap: 52}}>
      <Headline
        as="h2"
        words={[
          {text: "It"},
          {text: "remembers"},
          {text: "what"},
          {text: "the"},
          {text: "domain"},
          {text: "said."},
        ]}
        progressOf={(index) => cue(frame, index * 4, 20)}
      />

      <div style={{display: "flex", gap: 44, perspective: PERSPECTIVE}}>
        <Card
          style={{
            width: CARD_W,
            minHeight: CARD_H,
            boxSizing: "border-box",
            ...fold(left, -1),
          }}
        >
          <Header>~/.domaininstall/pins.json</Header>
          <div style={{padding: "28px 30px"}}>
            <Code
              parts={PIN}
              style={{
                fontSize: 22,
                lineHeight: 1.75,
                display: "block",
                color: ink[600],
                whiteSpace: "pre",
              }}
            />
          </div>
        </Card>

        <Card
          tone="amber"
          style={{
            width: CARD_W,
            minHeight: CARD_H,
            boxSizing: "border-box",
            ...fold(right, 1),
            borderColor: `rgba(194,118,10,${0.22 + flag * 0.28})`,
            boxShadow: `${shadow.card}${flag > 0 ? `, 0 0 0 ${flag * 5}px rgba(194,118,10,0.07)` : ""}`,
          }}
        >
          <Header upper color={hue.amber}>
            if it ever changes
          </Header>
          <div
            style={{
              padding: "28px 30px",
              fontFamily: mono,
              fontSize: 22,
              lineHeight: 1.5,
              color: ink[700],
            }}
          >
            <div style={{display: "flex", gap: 14, ...rise(cue(frame, 30, 18), 12, 3)}}>
              <span style={{paddingTop: 3}}>
                <Warn size={22} />
              </span>
              <span>The install stops and asks.</span>
            </div>

            <div
              style={{
                display: "inline-block",
                marginTop: 22,
                padding: "12px 18px",
                borderRadius: 10,
                background: `rgba(255,255,255,${0.5 + flag * 0.5})`,
                border: `1px solid rgba(194,118,10,${0.12 + flag * 0.26})`,
                opacity: flag,
                translate: `${(1 - flag) * -14}px 0`,
                scale: 1 + breathe * 0.008,
                transformOrigin: "left center",
                whiteSpace: "pre",
              }}
            >
              <span style={{position: "relative", color: hue.red, fontWeight: 600}}>
                example-package
                <span
                  style={{
                    position: "absolute",
                    left: -1,
                    right: -1,
                    top: "54%",
                    height: 2,
                    borderRadius: 2,
                    background: hue.red,
                    transformOrigin: "left center",
                    scale: `${strike} 1`,
                  }}
                />
              </span>
              <span style={{color: ink[400]}}> → </span>
              <span style={{color: hue.amber, fontWeight: 700}}>examp1e-package</span>
            </div>
          </div>
        </Card>
      </div>

      <Text
        as="lead"
        color={ink[500]}
        style={{...rise(cue(frame, 66, 18), 18, 4), textAlign: "center"}}
      >
        Every install runs with{" "}
        <span style={{color: hue.green, fontFamily: mono, fontWeight: 600}}>--ignore-scripts</span>.
      </Text>
    </AbsoluteFill>
  );
};
