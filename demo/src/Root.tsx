import React from "react";
import {Composition} from "remotion";
import {FPS, HEIGHT, TOTAL, WIDTH} from "./design";
import {Story} from "./Story";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DomainInstall"
      component={Story}
      durationInFrames={TOTAL}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
