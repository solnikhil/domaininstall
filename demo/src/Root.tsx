import React from "react";
import { Composition } from "remotion";
import { DomainInstall } from "./DomainInstall";
import { FPS, WIDTH, HEIGHT, TOTAL } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DomainInstall"
      component={DomainInstall}
      durationInFrames={TOTAL}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
