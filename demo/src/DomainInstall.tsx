import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { colors, scenes } from "./theme";
import { Hero } from "./scenes/Hero";
import { Problem } from "./scenes/Problem";
import { Solution } from "./scenes/Solution";
import { TerminalDemo } from "./scenes/TerminalDemo";
import { HowItWorks } from "./scenes/HowItWorks";
import { Security } from "./scenes/Security";
import { Outro } from "./scenes/Outro";

export const DomainInstall: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <Sequence from={scenes.hero.from} durationInFrames={scenes.hero.duration}>
        <Hero duration={scenes.hero.duration} />
      </Sequence>
      <Sequence from={scenes.problem.from} durationInFrames={scenes.problem.duration}>
        <Problem duration={scenes.problem.duration} />
      </Sequence>
      <Sequence from={scenes.solution.from} durationInFrames={scenes.solution.duration}>
        <Solution duration={scenes.solution.duration} />
      </Sequence>
      <Sequence from={scenes.terminal.from} durationInFrames={scenes.terminal.duration}>
        <TerminalDemo duration={scenes.terminal.duration} />
      </Sequence>
      <Sequence from={scenes.how.from} durationInFrames={scenes.how.duration}>
        <HowItWorks duration={scenes.how.duration} />
      </Sequence>
      <Sequence from={scenes.security.from} durationInFrames={scenes.security.duration}>
        <Security duration={scenes.security.duration} />
      </Sequence>
      <Sequence from={scenes.outro.from} durationInFrames={scenes.outro.duration}>
        <Outro duration={scenes.outro.duration} />
      </Sequence>
    </AbsoluteFill>
  );
};
