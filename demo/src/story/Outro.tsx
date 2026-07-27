import React from "react";
import {AbsoluteFill} from "remotion";
import {mono, sans} from "../fonts";
import {SAFE, cue, hue, ink, push, radius, rise, shadow, type} from "../design";
import {Card, Text} from "../components/primitives";
import {Logo} from "../components/Logo";

const COMMANDS: Array<Array<{text: string; color: string; weight: number}>> = [
  [
    {text: "npm i -g ", color: ink[900], weight: 700},
    {text: "domaininstall", color: hue.blue, weight: 700},
  ],
  [
    {text: "di verify ", color: ink[900], weight: 700},
    {text: "example.com", color: hue.violet, weight: 700},
  ],
  [
    {text: "di ", color: ink[900], weight: 700},
    {text: "example.com", color: hue.violet, weight: 700},
  ],
];

/*
 * Panel vocabulary: THE PUSH.
 *
 * The end card comes toward the lens out of a soft focus and stops. No lifting,
 * no wiping — after four panels of lateral motion, arriving straight at the
 * viewer is what makes this read as the last frame.
 */
export const Outro: React.FC<{frame: number}> = ({frame}) => {
  /* On the beat grid: beat = 18 frames at 100bpm. */
  const head = cue(frame, 0, 22);
  const card = cue(frame, 18, 22);

  return (
    <AbsoluteFill style={{...SAFE, alignItems: "center", justifyContent: "center", gap: 54}}>
      <div style={{display: "flex", alignItems: "center", gap: 30, ...push(head, 0.66)}}>
        <div style={{filter: "drop-shadow(0 22px 46px rgba(47,102,255,0.34))", display: "flex"}}>
          <Logo size={112} />
        </div>
        <div
          style={{
            fontFamily: sans,
            fontSize: type.h1.size,
            fontWeight: type.h1.weight,
            letterSpacing: type.h1.tracking,
            color: ink[900],
          }}
        >
          Install by domain.
        </div>
      </div>

      <Card
        depth="hero"
        style={{
          width: 880,
          boxSizing: "border-box",
          padding: "34px 40px",
          boxShadow: shadow.hero,
          borderRadius: radius.xl,
          ...push(card, 0.9),
        }}
      >
        {COMMANDS.map((parts, index) => {
          const line = cue(frame, 27 + index * 6, 16);
          return (
            <div
              key={parts[0]!.text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: index === 0 ? 0 : 18,
                fontFamily: mono,
                fontSize: 30,
                letterSpacing: -0.6,
                whiteSpace: "pre",
                ...rise(line, 18, 4),
              }}
            >
              <span style={{color: ink[300], fontWeight: 700}}>$</span>
              <span>
                {parts.map((part) => (
                  <span key={part.text} style={{color: part.color, fontWeight: part.weight}}>
                    {part.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </Card>

      <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 16}}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 27,
            fontWeight: 600,
            letterSpacing: -0.4,
            color: hue.blue,
            ...push(cue(frame, 48, 20), 0.86),
          }}
        >
          github.com/solnikhil/domaininstall
        </div>
        <Text as="body" color={ink[400]} style={{...rise(cue(frame, 57, 20), 14, 3), fontSize: 22}}>
          Early release · Node.js 22.14+ · npm · macOS, Linux, Windows
        </Text>
      </div>
    </AbsoluteFill>
  );
};
