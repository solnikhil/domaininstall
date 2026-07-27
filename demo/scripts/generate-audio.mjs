/**
 * Generates the whole soundtrack for the film: one music bed and eight cues.
 *
 *   node scripts/generate-audio.mjs        (or: npm run audio)
 *
 * Everything is synthesised here, so the audio is ours, license-free, and
 * locked to the cut. No dependencies — plain Node writing 16-bit stereo WAV.
 *
 * The bed is a 100bpm groove in D minor: 25.2s = 10.5 bars, which is exactly
 * the length of the film. Panel boundaries land on bar lines by construction,
 * so the picture and the track cannot drift apart.
 *
 *   bar  0.0  hook      intro: pad, hats, finger snaps, no kick
 *   bar  1.5  record    kick and sub enter, first choir swell
 *   bar  3.5  verify    full groove
 *   bar  5.0  install   groove plus a counter-melody
 *   bar  6.75 landing   one beat of silence, then impact and choir
 *   bar  7.5  trust     breakdown: drums out, pad and snaps only
 *   bar  9.0  outro     everything returns, last choir swell, resolve
 */

import fs from "node:fs";
import path from "node:path";

const SR = 44100;
const CHANNELS = 2;
const OUT_DIR = path.resolve("public/audio");

/* ------------------------------------------------------------------ timing */

const BPM = 100;
const BEAT = 60 / BPM; // 0.6s
const BAR = BEAT * 4; // 2.4s
const STEP = BEAT / 4; // 0.15s, one 16th
const BARS = 10.5;
const LENGTH = BAR * BARS; // 25.2s

/** Section boundaries, in seconds. These mirror `SLOT` in src/design.ts. */
const SECTION = {
  record: BAR * 1.5, // 3.6
  verify: BAR * 3.5, // 8.4
  install: BAR * 5, // 12.0
  landing: BAR * 6.75, // 16.2
  trust: BAR * 7.5, // 18.0
  outro: BAR * 9, // 21.6
};

/* ------------------------------------------------------------------ helpers */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

/** Smooth 0..1 ramp, used for every envelope so nothing clicks. */
const smoothstep = (value) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

const SEMITONES = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};

/** "F#4" -> 369.99. A4 = 440. */
const noteFreq = (name) => {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`bad note: ${name}`);
  const [, letter, accidental, octave] = match;
  const semitone = SEMITONES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  const midi = semitone + (Number(octave) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

class Track {
  constructor(seconds) {
    this.length = Math.ceil(seconds * SR);
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
  }

  /** Add a sample with equal-power panning (-1 left .. +1 right). */
  add(index, value, pan = 0) {
    if (index < 0 || index >= this.length) return;
    const angle = ((pan + 1) / 2) * (Math.PI / 2);
    this.left[index] += value * Math.cos(angle);
    this.right[index] += value * Math.sin(angle);
  }
}

/**
 * Two-pole resonator. Used as a formant filter for the choir and as a tone
 * shaper for the drums. `r` near 1 is a narrow, ringing peak.
 */
const resonator = (frequency, r) => {
  const theta = (2 * Math.PI * frequency) / SR;
  const a1 = 2 * r * Math.cos(theta);
  const a2 = -(r * r);
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = x * (1 - r) + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y;
    return y;
  };
};

/* ------------------------------------------------------------------ voices */

/** Additive pad: a few sine partials, long attack, slow drift. */
const pad = (track, {note, start, duration, gain = 0.1, pan = 0, attack = 1.1, release = 1.6}) => {
  const base = noteFreq(note);
  const partials = [
    {ratio: 1, level: 1, detune: 0.06},
    {ratio: 2, level: 0.26, detune: -0.09},
    {ratio: 3, level: 0.1, detune: 0.13},
    {ratio: 4.01, level: 0.045, detune: 0},
  ];
  const from = Math.floor(start * SR);
  const total = Math.ceil((duration + release) * SR);

  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env =
      smoothstep(t / attack) * (t <= duration ? 1 : 1 - smoothstep((t - duration) / release));
    if (env <= 0) continue;
    const drift = 1 + Math.sin(t * 0.7 + base * 0.01) * 0.12;
    let sample = 0;
    for (const partial of partials) {
      sample += Math.sin(2 * Math.PI * (base * partial.ratio + partial.detune) * t) * partial.level;
    }
    track.add(from + i, sample * env * drift * gain * 0.34, pan);
  }
};

/** Soft plucked tone: sine plus a quiet octave, exponential decay. */
const pluck = (track, {note, start, gain = 0.1, decay = 0.5, pan = 0, attack = 0.005}) => {
  const base = noteFreq(note);
  const from = Math.floor(start * SR);
  const total = Math.ceil((decay * 3.2 + attack) * SR);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = smoothstep(t / attack) * Math.exp(-t / decay);
    if (env < 0.00015) break;
    const sample =
      Math.sin(2 * Math.PI * base * t) +
      Math.sin(2 * Math.PI * base * 2 * t) * 0.2 +
      Math.sin(2 * Math.PI * base * 3 * t) * 0.06;
    track.add(from + i, sample * env * gain * 0.5, pan);
  }
};

/** Electric-piano-ish stab: bell-like partials, medium decay. */
const key = (track, {note, start, gain = 0.08, decay = 0.42, pan = 0}) => {
  const base = noteFreq(note);
  const from = Math.floor(start * SR);
  const total = Math.ceil(decay * 3.4 * SR);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = smoothstep(t / 0.004) * Math.exp(-t / decay);
    if (env < 0.0002) break;
    const sample =
      Math.sin(2 * Math.PI * base * t) * 0.8 +
      Math.sin(2 * Math.PI * base * 2 * t) * 0.3 +
      Math.sin(2 * Math.PI * base * 4.02 * t) * 0.12 * Math.exp(-t / 0.09);
    track.add(from + i, sample * env * gain * 0.5, pan);
  }
};

/** 808-style sub: sine with a short pitch glide into the note, long tail. */
const sub = (track, {note, start, gain = 0.5, decay = 0.62}) => {
  const target = noteFreq(note);
  const from = Math.floor(start * SR);
  const total = Math.ceil(decay * 3.2 * SR);
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = smoothstep(t / 0.006) * Math.exp(-t / decay);
    if (env < 0.0002) break;
    // glide down into pitch over the first 40ms: the 808 "thump"
    const frequency = lerp(target * 1.9, target, smoothstep(t / 0.04));
    phase += (2 * Math.PI * frequency) / SR;
    const sample = Math.sin(phase) + Math.sin(phase * 2) * 0.08;
    track.add(from + i, sample * env * gain * 0.4, 0);
  }
};

/** Kick: pitch-dropping sine with a click on the front. */
const kick = (track, {start, gain = 0.9}) => {
  const from = Math.floor(start * SR);
  const total = Math.ceil(0.5 * SR);
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = smoothstep(t / 0.002) * Math.exp(-t / 0.115);
    if (env < 0.0002) break;
    const frequency = lerp(148, 47, smoothstep(t / 0.05));
    phase += (2 * Math.PI * frequency) / SR;
    const click = (Math.random() * 2 - 1) * Math.exp(-t / 0.0025) * 0.28;
    track.add(from + i, (Math.sin(phase) + click) * env * gain * 0.42, 0);
  }
};

/** Clap: three tight noise bursts, then a short bandpassed tail. */
const clap = (track, {start, gain = 0.5, pan = 0}) => {
  const bursts = [0, 0.009, 0.019];
  const band = resonator(1500, 0.965);
  const from = Math.floor(start * SR);
  const total = Math.ceil(0.3 * SR);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    let amplitude = Math.exp(-t / 0.11) * 0.5;
    for (const burst of bursts) {
      if (t >= burst) amplitude += Math.exp(-(t - burst) / 0.008);
    }
    const value = band((Math.random() * 2 - 1) * amplitude);
    track.add(from + i, value * gain * 1.6, pan);
  }
};

/** Hat: very short, bright, highpassed noise. */
const hat = (track, {start, gain = 0.12, decay = 0.028, pan = 0, open = false}) => {
  const from = Math.floor(start * SR);
  const length = open ? decay * 8 : decay * 6;
  const total = Math.ceil(length * SR);
  let low = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = Math.exp(-t / (open ? decay * 3 : decay));
    if (env < 0.0004) break;
    const noise = Math.random() * 2 - 1;
    low += 0.55 * (noise - low);
    track.add(from + i, (noise - low) * env * gain, pan);
  }
};

/** Finger snap: a dry, mid-forward tick. Carries the intro and the breakdown. */
const snap = (track, {start, gain = 0.34, pan = 0.12}) => {
  const band = resonator(2400, 0.94);
  const from = Math.floor(start * SR);
  const total = Math.ceil(0.14 * SR);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = Math.exp(-t / 0.016);
    if (env < 0.0004) break;
    track.add(from + i, band((Math.random() * 2 - 1) * env) * gain * 2.2, pan);
  }
};

/** Air swell: noise through a moving lowpass with a bell envelope. */
const swell = (track, {start, duration, gain = 0.3, from = 400, to = 2600, pan = 0, bell = 0.5}) => {
  const at = Math.floor(start * SR);
  const total = Math.ceil(duration * SR);
  let state = 0;
  for (let i = 0; i < total; i++) {
    const progress = i / total;
    const env =
      progress < bell
        ? smoothstep(progress / bell)
        : 1 - smoothstep((progress - bell) / (1 - bell));
    const cutoff = lerp(from, to, progress);
    const coefficient = clamp((2 * Math.PI * cutoff) / SR, 0, 1);
    state += coefficient * (Math.random() * 2 - 1 - state);
    track.add(at + i, state * env * gain * (1 + Math.sin(progress * Math.PI * 3) * 0.15), pan);
  }
};

/** Narrow noise blip, for riffles and nib ticks. */
const blip = (track, {start, frequency = 3200, gain = 0.3, decay = 0.012, pan = 0}) => {
  const at = Math.floor(start * SR);
  const total = Math.ceil(decay * 8 * SR);
  let low = 0;
  const coefficient = clamp((2 * Math.PI * frequency) / SR, 0, 1);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = Math.exp(-t / decay);
    if (env < 0.0004) break;
    const noise = Math.random() * 2 - 1;
    low += coefficient * (noise - low);
    track.add(at + i, (low * 0.3 + (noise - low) * 0.7) * env * gain * 0.5, pan);
  }
};

/** Wooden tap. */
const tap = (track, {start, frequency = 240, gain = 0.5, decay = 0.09, pan = 0}) => {
  const from = Math.floor(start * SR);
  const total = Math.ceil(decay * 6 * SR);
  let noiseState = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = Math.exp(-t / decay);
    if (env < 0.0002) break;
    noiseState = noiseState * 0.72 + (Math.random() * 2 - 1) * 0.28;
    const body =
      Math.sin(2 * Math.PI * frequency * t) * 0.9 +
      Math.sin(2 * Math.PI * frequency * 1.98 * t) * 0.22;
    track.add(from + i, (body + noiseState * Math.exp(-t / 0.006) * 0.8) * env * gain * 0.5, pan);
  }
};

/** Low body hit. */
const thunk = (track, {start, gain = 0.7, pan = 0}) => {
  const at = Math.floor(start * SR);
  const total = Math.ceil(0.6 * SR);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env = Math.exp(-t / 0.085) * smoothstep(t / 0.004);
    if (env < 0.0002) break;
    const frequency = lerp(132, 74, smoothstep(t / 0.14));
    const sample =
      Math.sin(2 * Math.PI * frequency * t) + Math.sin(2 * Math.PI * frequency * 0.5 * t) * 0.5;
    track.add(at + i, sample * env * gain * 0.4, pan);
  }
};

/* ------------------------------------------------------------------- choir */

/** Formant sets. Three resonances is enough to read as a sung vowel. */
const VOWELS = {
  ooh: [
    {frequency: 325, level: 1},
    {frequency: 700, level: 0.32},
    {frequency: 2530, level: 0.07},
  ],
  aah: [
    {frequency: 800, level: 1},
    {frequency: 1150, level: 0.55},
    {frequency: 2900, level: 0.14},
  ],
};

/**
 * One sung voice: a sawtooth glottal source through three formant resonators,
 * with vibrato and a breath layer. This is the "little bit of singing" — a
 * held vowel, not a melody, so it supports the picture instead of competing
 * with the text on screen.
 */
const voice = (track, {note, start, duration, gain = 0.1, pan = 0, vowel = "aah", vibrato = 5.1}) => {
  const base = noteFreq(note);
  const formants = VOWELS[vowel].map((f) => ({
    filter: resonator(f.frequency * (0.98 + Math.random() * 0.04), 0.978),
    level: f.level,
  }));
  const attack = Math.min(0.8, duration * 0.42);
  const release = Math.min(1.4, duration * 0.7);
  const from = Math.floor(start * SR);
  const total = Math.ceil((duration + release) * SR);
  let phase = 0;
  const drift = Math.random() * Math.PI * 2;

  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const env =
      smoothstep(t / attack) * (t <= duration ? 1 : 1 - smoothstep((t - duration) / release));
    if (env <= 0) continue;

    // a singer is never exactly on pitch, and never exactly steady
    const wobble =
      1 +
      Math.sin(2 * Math.PI * vibrato * t + drift) * 0.0055 * smoothstep(t / 0.5) +
      Math.sin(2 * Math.PI * 0.7 * t + drift) * 0.0018;
    phase += (2 * Math.PI * base * wobble) / SR;
    if (phase > Math.PI * 2) phase -= Math.PI * 2;

    // sawtooth glottal pulse plus a little breath
    const saw = phase / Math.PI - 1;
    const source = saw * 0.8 + (Math.random() * 2 - 1) * 0.035;

    let sample = 0;
    for (const formant of formants) sample += formant.filter(source) * formant.level;
    track.add(from + i, sample * env * gain * 2.6, pan);
  }
};

/** A chord of voices, spread across the stereo field. */
const choir = (track, {notes, start, duration, gain = 0.1, vowel = "aah"}) => {
  notes.forEach((note, index) => {
    const pan = notes.length === 1 ? 0 : ((index / (notes.length - 1)) * 2 - 1) * 0.5;
    // two singers per part, slightly apart, for width
    voice(track, {note, start: start + index * 0.05, duration, gain, pan, vowel, vibrato: 5.1});
    voice(track, {
      note,
      start: start + 0.09 + index * 0.05,
      duration: duration - 0.09,
      gain: gain * 0.6,
      pan: -pan,
      vowel,
      vibrato: 4.6,
    });
  });
};

/* ------------------------------------------------------------------- writer */

const writeWav = (name, track, peak = 0.86) => {
  const {left, right, length} = track;
  let max = 0;
  for (let i = 0; i < length; i++) {
    max = Math.max(max, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = max > 0 ? peak / max : 1;

  const dataSize = length * CHANNELS * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * CHANNELS * 2, 28);
  buffer.writeUInt16LE(CHANNELS * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < length; i++) {
    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.round(clamp(left[i] * gain, -1, 1) * 32767), offset);
    buffer.writeInt16LE(Math.round(clamp(right[i] * gain, -1, 1) * 32767), offset + 2);
  }

  fs.mkdirSync(OUT_DIR, {recursive: true});
  fs.writeFileSync(path.join(OUT_DIR, name), buffer);
  console.log(`  ${name.padEnd(22)} ${(length / SR).toFixed(2)}s`);
};

/* --------------------------------------------------------------- music bed */

/** Dm9 – Bbmaj7 – Fmaj9 – C6/9, one chord per bar, looping every four bars. */
const PROGRESSION = [
  {root: "D2", pad: "D3", voices: ["F4", "A4", "C5", "E5"], keys: ["F4", "A4", "C5"]},
  {root: "A1", pad: "B2", voices: ["D4", "F4", "A4", "C5"], keys: ["D4", "F4", "A4"]},
  {root: "F2", pad: "F3", voices: ["A3", "C4", "E4", "G4"], keys: ["A3", "C4", "E4"]},
  {root: "C2", pad: "C3", voices: ["E4", "G4", "A4", "D5"], keys: ["E4", "G4", "D5"]},
];

const buildBed = () => {
  const track = new Track(LENGTH);
  const chordAt = (bar) => PROGRESSION[Math.floor(bar) % PROGRESSION.length];

  /* --- harmony: one pad chord per bar, held across the bar line --- */
  for (let bar = 0; bar < BARS; bar++) {
    const chord = chordAt(bar);
    const start = bar * BAR;
    const duration = BAR * 0.94;
    const level = bar < 1.5 ? 0.5 : 1;

    // the pad sits back deliberately: the groove has to be the thing you hear
    pad(track, {note: chord.pad, start, duration, gain: 0.082 * level, attack: 0.5});
    chord.voices.forEach((note, index) => {
      const pan = ((index / (chord.voices.length - 1)) * 2 - 1) * 0.42;
      pad(track, {
        note,
        start: start + index * 0.05,
        duration,
        gain: 0.042 * level,
        pan,
        attack: 0.55 + index * 0.1,
        release: 1.2,
      });
    });
  }

  /* --- rhythm section on a 16th grid --- */
  const KICKS = [0, 6, 10];
  const KICKS_ALT = [0, 6, 10, 14];
  const CLAPS = [4, 12];

  for (let bar = 0; bar < BARS; bar++) {
    const chord = chordAt(bar);
    const barStart = bar * BAR;

    for (let step = 0; step < 16; step++) {
      const t = barStart + step * STEP;
      if (t >= LENGTH) break;

      const intro = t < SECTION.record;
      const breakdown = t >= SECTION.trust && t < SECTION.outro;
      // one beat of silence before the install lands: the drop
      const dropped = t >= SECTION.landing - BEAT && t < SECTION.landing;
      const tail = t > LENGTH - BEAT * 1.5;
      const groove = !intro && !breakdown && !dropped && !tail;

      const kicks = bar % 2 === 1 ? KICKS_ALT : KICKS;

      if (groove && kicks.includes(step)) {
        kick(track, {start: t, gain: step === 0 ? 0.95 : 0.72});
      }
      if (groove && CLAPS.includes(step)) {
        clap(track, {start: t, gain: 0.44, pan: 0.1});
      }
      // snaps carry the intro and the breakdown where the kick is absent
      if ((intro || breakdown) && CLAPS.includes(step)) {
        snap(track, {start: t, gain: 0.3, pan: step === 4 ? -0.14 : 0.14});
      }
      // hats: 8ths always, plus a couple of 16th fills once the groove is in
      if (!dropped && !tail && step % 2 === 0) {
        hat(track, {start: t, gain: step % 4 === 0 ? 0.16 : 0.105, pan: -0.18});
      }
      if (groove && (step === 7 || step === 15)) {
        hat(track, {start: t, gain: 0.06, pan: 0.22, open: step === 15});
      }
      // electric-piano stabs on the off-beats
      if (!intro && !dropped && !tail && (step === 3 || step === 11)) {
        chord.keys.forEach((note, index) => {
          key(track, {
            note,
            start: t + index * 0.004,
            gain: breakdown ? 0.062 : 0.088,
            decay: 0.38,
            pan: (index - 1) * 0.3,
          });
        });
      }
    }

    /* --- sub bass: root on the downbeat, a push on the 11th 16th --- */
    if (barStart >= SECTION.record - 0.01 && barStart < LENGTH - 0.2) {
      const dropped = barStart >= SECTION.landing - BEAT && barStart < SECTION.landing;
      if (!dropped) {
        sub(track, {note: chord.root, start: barStart, gain: 0.5, decay: 0.72});
        if (barStart + STEP * 10 < LENGTH) {
          sub(track, {note: chord.root, start: barStart + STEP * 10, gain: 0.3, decay: 0.4});
        }
      }
    }
  }

  /* --- counter-melody through the install section --- */
  const FIGURE = ["A4", "D5", "F5", "E5", "D5", "A4", "C5", "D5"];
  let step = 0;
  for (let t = SECTION.install; t < SECTION.trust; t += BEAT / 2) {
    const fade = smoothstep((t - SECTION.install) / 1.8) * (1 - smoothstep((t - (SECTION.trust - 1.6)) / 1.6));
    const dropped = t >= SECTION.landing - BEAT && t < SECTION.landing;
    if (!dropped && fade > 0.02) {
      pluck(track, {
        note: FIGURE[step % FIGURE.length],
        start: t,
        gain: 0.07 * fade,
        decay: 0.34,
        pan: step % 2 ? 0.4 : -0.4,
      });
    }
    step++;
  }

  /* --- air, and a lift into each new section --- */
  swell(track, {start: 0, duration: LENGTH, gain: 0.035, from: 900, to: 3000, bell: 0.55});
  [SECTION.record, SECTION.verify, SECTION.install, SECTION.outro].forEach((at) => {
    swell(track, {start: at - 0.9, duration: 1.5, gain: 0.16, from: 600, to: 4200, bell: 0.62});
  });
  // the landing: a reverse-ish rise into the impact, then weight
  swell(track, {start: SECTION.landing - BEAT, duration: BEAT, gain: 0.2, from: 800, to: 5200, bell: 0.95});
  thunk(track, {start: SECTION.landing, gain: 0.28});

  /* --- the singing: three held vowels, on the three biggest moments --- */
  choir(track, {
    notes: ["F4", "A4", "D5"],
    start: SECTION.record - 0.35,
    duration: 2.1,
    gain: 0.085,
    vowel: "ooh",
  });
  choir(track, {
    notes: ["A4", "D5", "F5"],
    start: SECTION.landing - 0.2,
    duration: 2.6,
    gain: 0.105,
    vowel: "aah",
  });
  choir(track, {
    notes: ["D4", "A4", "D5"],
    start: SECTION.outro - 0.3,
    duration: 3.2,
    gain: 0.095,
    vowel: "ooh",
  });

  /* --- final chord, and top/tail so the file is usable end to end --- */
  ["D3", "A3", "D4", "F4"].forEach((note, index) => {
    pluck(track, {note, start: LENGTH - BEAT * 1.5 + index * 0.03, gain: 0.1, decay: 1.1, pan: (index - 1.5) * 0.28});
  });
  sub(track, {note: "D2", start: LENGTH - BEAT * 1.5, gain: 0.42, decay: 1.1});

  /*
   * Top/tail, then a soft limiter.
   *
   * Without this the kick owns the peak, peak-normalising drags everything
   * else down, and the track ends up quiet even at a high mix level. tanh
   * rounds the transient peaks off instead of clipping them, which lifts the
   * average level by roughly 6dB and is what makes the bed audible.
   */
  const DRIVE = 1.5;
  const ceiling = Math.tanh(DRIVE);
  for (let i = 0; i < track.length; i++) {
    const t = i / SR;
    const env = smoothstep(t / 0.6) * (1 - smoothstep((t - (LENGTH - 0.7)) / 0.7));
    track.left[i] = (Math.tanh(track.left[i] * DRIVE) / ceiling) * env;
    track.right[i] = (Math.tanh(track.right[i] * DRIVE) / ceiling) * env;
  }

  // 0.68, not 0.95: the cues have to fit on top of this without the sum ever
  // reaching 1.0, because Remotion hard-clips anything that does.
  writeWav("bed-groove-100.wav", track, 0.68);
};

/* -------------------------------------------------------------------- cues */

/*
 * LEVEL BUDGET — read this before changing any number below.
 *
 * Remotion sums audio and hard-clips above 1.0, and clipping is what makes a
 * mix sound harsh rather than merely loud. So each file is normalised to a peak
 * that matches its ROLE, not to full scale:
 *
 *   bed        0.68    plays at ~0.55 -> ~0.37 peak
 *   impacts    0.48    lock
 *   accents    0.40    settle, flag, resolve
 *   texture    0.26    write, flip, fold, glide
 *
 * Worst case: bed + the loudest cue stays near 0.45, and the bed is ducked
 * under the big cues on top of that (see `duck` in Story.tsx). Normalising
 * every cue to ~0.8 like the old version did is what made a tiny tick as loud
 * as an impact.
 */

/** Three cards coming to rest. */
const cueSettle = () => {
  const track = new Track(1.1);
  [
    {at: 0, frequency: 300, note: "A5"},
    {at: 0.11, frequency: 262, note: "F5"},
    {at: 0.22, frequency: 232, note: "D5"},
  ].forEach((hit, index) => {
    const pan = (index - 1) * 0.3;
    tap(track, {start: hit.at, frequency: hit.frequency, gain: 0.6, decay: 0.1, pan});
    pluck(track, {note: hit.note, start: hit.at + 0.01, gain: 0.05, decay: 0.5, pan});
  });
  writeWav("cue-settle.wav", track, 0.4);
};

/** Something is wrong, said politely. */
const cueFlag = () => {
  const track = new Track(1.4);
  pluck(track, {note: "F5", start: 0, gain: 0.42, decay: 0.34, pan: -0.15});
  pluck(track, {note: "C#5", start: 0.14, gain: 0.4, decay: 0.55, pan: 0.15});
  pluck(track, {note: "F4", start: 0.16, gain: 0.16, decay: 0.7, pan: 0});
  swell(track, {start: 0, duration: 0.9, gain: 0.1, from: 1800, to: 500, bell: 0.25});
  writeWav("cue-flag.wav", track, 0.4);
};

/** The camera move. Airy, wide, no transient. */
const cueGlide = () => {
  const track = new Track(1.5);
  swell(track, {start: 0, duration: 1.35, gain: 0.5, from: 500, to: 3400, pan: -0.5, bell: 0.42});
  swell(track, {start: 0.05, duration: 1.35, gain: 0.5, from: 700, to: 2600, pan: 0.5, bell: 0.5});
  pad(track, {note: "D4", start: 0, duration: 0.5, gain: 0.05, attack: 0.3, release: 0.6});
  writeWav("cue-glide.wav", track, 0.26);
};

/** The record writing itself: a nib on paper. */
const cueWrite = () => {
  const track = new Track(2.0);
  let at = 0.02;
  while (at < 1.72) {
    const level = 0.24 * (0.6 + Math.random() * 0.4) * (1 - smoothstep((at - 1.3) / 0.5));
    blip(track, {
      start: at,
      frequency: 2400 + Math.random() * 2200,
      gain: level,
      decay: 0.01 + Math.random() * 0.008,
      pan: (Math.random() * 2 - 1) * 0.3,
    });
    at += 0.052 + Math.random() * 0.03;
  }
  swell(track, {start: 0, duration: 1.8, gain: 0.06, from: 2200, to: 900, bell: 0.3});
  writeWav("cue-write.wav", track, 0.24);
};

/** The flip board turning over. */
const cueFlip = () => {
  const track = new Track(0.7);
  for (let i = 0; i < 6; i++) {
    const at = 0.02 + i * 0.032 * (1 - i * 0.06);
    blip(track, {start: at, frequency: 1600 + i * 420, gain: 0.3 - i * 0.03, decay: 0.014, pan: -0.25 + i * 0.1});
  }
  tap(track, {start: 0.2, frequency: 420, gain: 0.32, decay: 0.05});
  writeWav("cue-flip.wav", track, 0.26);
};

/** A fact confirmed: rising three-note bell. */
const cueResolve = () => {
  const track = new Track(1.8);
  pluck(track, {note: "A5", start: 0, gain: 0.3, decay: 0.5, pan: -0.2});
  pluck(track, {note: "D6", start: 0.09, gain: 0.28, decay: 0.6, pan: 0.1});
  pluck(track, {note: "F6", start: 0.18, gain: 0.24, decay: 0.85, pan: 0.25});
  pad(track, {note: "A4", start: 0.05, duration: 0.6, gain: 0.05, attack: 0.2, release: 0.9});
  writeWav("cue-resolve.wav", track, 0.4);
};

/** The install landing: weight, then shimmer. */
const cueLock = () => {
  const track = new Track(2.2);
  thunk(track, {start: 0, gain: 0.45});
  ["D5", "A5", "D6"].forEach((note, index) => {
    pluck(track, {note, start: 0.06 + index * 0.05, gain: 0.2 - index * 0.03, decay: 0.9 + index * 0.3, pan: (index - 1) * 0.35});
  });
  pad(track, {note: "D3", start: 0.02, duration: 0.9, gain: 0.07, attack: 0.15, release: 1.1});
  writeWav("cue-lock.wav", track, 0.48);
};

/** Two panels folding in: paper, not machinery. */
const cueFold = () => {
  const track = new Track(1.0);
  swell(track, {start: 0, duration: 0.34, gain: 0.4, from: 900, to: 3000, pan: -0.6, bell: 0.4});
  swell(track, {start: 0.1, duration: 0.36, gain: 0.4, from: 900, to: 2700, pan: 0.6, bell: 0.4});
  tap(track, {start: 0.3, frequency: 260, gain: 0.3, decay: 0.07, pan: -0.2});
  tap(track, {start: 0.36, frequency: 232, gain: 0.3, decay: 0.07, pan: 0.2});
  writeWav("cue-fold.wav", track, 0.28);
};

/* -------------------------------------------------------------------- main */

console.log(`generating soundtrack into public/audio (${BPM}bpm, ${LENGTH.toFixed(1)}s) ...`);
buildBed();
cueSettle();
cueFlag();
cueGlide();
cueWrite();
cueFlip();
cueResolve();
cueLock();
cueFold();
console.log("done.");
