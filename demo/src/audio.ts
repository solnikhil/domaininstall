/**
 * Every sound the film uses, in one place.
 *
 * These files are synthesised by `npm run audio` (scripts/generate-audio.mjs),
 * so the soundtrack is ours and matched to the cut. Run that once before the
 * first render; the files are not committed.
 *
 * SWAPPING IN A DIFFERENT BED
 * ---------------------------
 * The film is cut to a 100bpm grid (see `BEAT` in design.ts), so any track at
 * or near 100bpm will lock to the picture:
 *
 *   1. put the file in public/audio/
 *   2. point `bed` at it
 *   3. set `BED_OFFSET` to the frame of its first downbeat, so bar one of the
 *      music lands on frame 0 of the film
 *
 * Use a track you have the rights to: library music (Uppbeat, Epidemic,
 * Artlist) or your own. A commercial release will get the audio stripped or
 * the post blocked on X and LinkedIn, which is worse than any track choice.
 */
export const AUDIO = {
  /** 100bpm, 12.5 bars, 30.0s — the same grid the film is cut to. */
  bed: "audio/bed-groove-100.wav",
  settle: "audio/cue-settle.wav",
  flag: "audio/cue-flag.wav",
  glide: "audio/cue-glide.wav",
  write: "audio/cue-write.wav",
  flip: "audio/cue-flip.wav",
  resolve: "audio/cue-resolve.wav",
  lock: "audio/cue-lock.wav",
  fold: "audio/cue-fold.wav",
} as const;

/**
 * Frames trimmed off the front of the bed. The generated bed already starts on
 * its downbeat, so this is 0 — set it when swapping in a track with a lead-in.
 */
export const BED_OFFSET = 0;

/**
 * Bed level. The one number to touch if the music feels too quiet or too loud.
 *
 * The bed file peaks at 0.68, so this plays at roughly 0.37 peak and leaves
 * headroom for the cues on top. Do not take it much past 0.7: Remotion sums
 * audio and hard-clips over 1.0, and that clipping is what makes the mix sound
 * harsh rather than just loud.
 */
export const BED_VOLUME = 0.55;

/** Master trim on all cues, so one number fixes "the noises are too loud". */
export const CUE_TRIM = 0.75;
