import React from "react";
import {Audio} from "@remotion/media";
import {AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame} from "remotion";
import {CLAMP, SLOT, TOTAL, beat, ink} from "./design";
import {AUDIO, BED_OFFSET, BED_VOLUME, CUE_TRIM} from "./audio";
import {Backdrop, Deck, cameraAt} from "./components/Stage";
import {Hook} from "./story/Hook";
import {RecordScene} from "./story/Record";
import {Verify} from "./story/Verify";
import {Install} from "./story/Install";
import {Trust} from "./story/Trust";
import {Outro} from "./story/Outro";

/**
 * Six panels, one camera, one sound per beat.
 *
 * Each panel has its own motion vocabulary — deck, inscription, board, spine,
 * fold, push — and each vocabulary has its own cue in the soundtrack. The
 * camera glide is the only thing they all share.
 */

/**
 * Cue positions are given in beats from the start of their panel, so they read
 * like a score. `-0.5` is half a beat before the panel's downbeat, which is
 * where each camera move begins.
 */
const on = (panel: keyof typeof SLOT, beats: number) => SLOT[panel].start + beat(beats);

type Cue = {
  at: number;
  file: string;
  volume: number;
  hold: number;
  note: string;
  /** Frames to pull the bed down for, so this cue is heard without adding level. */
  duck?: number;
};

/**
 * Levels are deliberately small. Each cue file is already normalised to a peak
 * that matches its role (see the level budget in scripts/generate-audio.mjs),
 * so these are trims, not gains. `CUE_TRIM` scales all of them at once.
 */
const CUES: Cue[] = [
  // 01 · the deck — over the intro, before the kick comes in
  {at: on("hook", 1), file: AUDIO.settle, volume: 0.5, hold: 40, note: "cards dealt"},
  {at: on("hook", 3), file: AUDIO.flag, volume: 0.42, hold: 40, note: "typosquats flagged", duck: 26},

  // 02 · the inscription — the kick and sub enter on this downbeat
  {at: on("record", -0.5), file: AUDIO.glide, volume: 0.5, hold: 40, note: "transition"},
  {at: on("record", 1.5), file: AUDIO.write, volume: 0.4, hold: 52, note: "record written"},

  // 03 · the board
  {at: on("verify", -0.5), file: AUDIO.glide, volume: 0.5, hold: 40, note: "transition"},
  {at: on("verify", 1.5), file: AUDIO.flip, volume: 0.42, hold: 16, note: "dnssec"},
  {at: on("verify", 2), file: AUDIO.flip, volume: 0.38, hold: 16, note: "read-only"},
  {at: on("verify", 3), file: AUDIO.resolve, volume: 0.5, hold: 42, note: "verified", duck: 30},

  // 04 · the spine — beat 7 is the drop in the track: drums out, then impact
  {at: on("install", -0.5), file: AUDIO.glide, volume: 0.5, hold: 40, note: "transition"},
  {at: on("install", 1.5), file: AUDIO.write, volume: 0.3, hold: 40, note: "spine and rows"},
  {at: on("install", 3.5), file: AUDIO.settle, volume: 0.28, hold: 26, note: "command opens"},
  {at: on("install", 7), file: AUDIO.lock, volume: 0.55, hold: 48, note: "installed", duck: 40},

  // 05 · the fold — the track breaks down here, so the cues carry the section
  {at: on("trust", -0.5), file: AUDIO.glide, volume: 0.5, hold: 40, note: "transition"},
  {at: on("trust", 1), file: AUDIO.fold, volume: 0.45, hold: 28, note: "panels open"},
  {at: on("trust", 2.5), file: AUDIO.flag, volume: 0.34, hold: 38, note: "mapping changed"},

  // 06 · the push — everything returns for the last bar and a half
  {at: on("outro", -0.5), file: AUDIO.glide, volume: 0.5, hold: 40, note: "transition"},
  {at: on("outro", 0.5), file: AUDIO.resolve, volume: 0.4, hold: 40, note: "end card", duck: 30},
];

/** Triangular 0..1 envelope: fast in, slow out. Drives the ducking. */
const bump = (frame: number, at: number, length: number): number => {
  if (frame < at - 3 || frame > at + length) return 0;
  return Math.min(
    interpolate(frame, [at - 3, at + 3], [0, 1], CLAMP),
    interpolate(frame, [at + 8, at + length], [1, 0], CLAMP),
  );
};

/**
 * Sidechain duck: the bed steps back under the big cues instead of the cues
 * being pushed louder to compete with it. This is what stops the mix from
 * stacking up and clipping on the accents.
 */
const duckAt = (frame: number): number => {
  let gain = 1;
  for (const cue of CUES) {
    if (cue.duck) gain *= 1 - 0.4 * bump(frame, cue.at, cue.duck);
  }
  return gain;
};

export const Story: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = cameraAt(frame);

  return (
    <AbsoluteFill style={{background: ink.paper}}>
      {/*
        The bed carries the film now, so it sits high and mostly flat — its own
        arrangement handles the dynamics (intro, drop, breakdown, return) and
        it resolves musically on the last bar, so no long fade is needed here.
      */}
      <Audio
        src={staticFile(AUDIO.bed)}
        trimBefore={BED_OFFSET}
        volume={(f) =>
          interpolate(f, [0, 18, TOTAL - 12, TOTAL], [0, BED_VOLUME, BED_VOLUME, 0], CLAMP) *
          duckAt(f)
        }
      />
      {CUES.map((cue, index) => (
        <Sequence
          key={`${cue.file}-${index}`}
          from={cue.at}
          durationInFrames={cue.hold}
          layout="none"
          name={`${cue.note} @${cue.at}`}
        >
          <Audio
            src={staticFile(cue.file)}
            volume={(f) => {
              const level = cue.volume * CUE_TRIM;
              return interpolate(f, [0, 2, cue.hold - 10, cue.hold], [level, level, level, 0], CLAMP);
            }}
          />
        </Sequence>
      ))}

      <Backdrop frame={frame} travel={camera} />

      <Deck
        position={camera}
        panels={[
          <Hook frame={frame - SLOT.hook.start} />,
          <RecordScene frame={frame - SLOT.record.start} />,
          <Verify frame={frame - SLOT.verify.start} />,
          <Install frame={frame - SLOT.install.start} />,
          <Trust frame={frame - SLOT.trust.start} />,
          <Outro frame={frame - SLOT.outro.start} />,
        ]}
      />
    </AbsoluteFill>
  );
};
