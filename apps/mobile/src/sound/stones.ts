// Stone sounds: real recordings of stones on a goban (from the Sabaki
// project, MIT license) — five placement takes and five capture takes,
// picked at random so consecutive moves never sound machine-identical.
// Sound is a nicety: every call swallows errors so audio problems can
// never break the game.

import { Audio } from 'expo-av';

const PLACE_SOURCES = [
  require('../../assets/sounds/stone0.mp3'),
  require('../../assets/sounds/stone1.mp3'),
  require('../../assets/sounds/stone2.mp3'),
  require('../../assets/sounds/stone3.mp3'),
  require('../../assets/sounds/stone4.mp3'),
];
const CAPTURE_SOURCES = [
  require('../../assets/sounds/capture0.mp3'),
  require('../../assets/sounds/capture1.mp3'),
  require('../../assets/sounds/capture2.mp3'),
  require('../../assets/sounds/capture3.mp3'),
  require('../../assets/sounds/capture4.mp3'),
];

let placePool: Audio.Sound[] = [];
let capturePool: Audio.Sound[] = [];
let ready = false;

export async function initStoneSounds() {
  if (ready) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    placePool = await Promise.all(
      PLACE_SOURCES.map(async (src) => {
        const { sound } = await Audio.Sound.createAsync(src, { volume: 1.0 });
        return sound;
      })
    );
    capturePool = await Promise.all(
      CAPTURE_SOURCES.map(async (src) => {
        const { sound } = await Audio.Sound.createAsync(src, { volume: 0.9 });
        return sound;
      })
    );
    ready = true;
  } catch {
    // no audio device / interrupted session — play silently ever after
  }
}

function playFrom(pool: Audio.Sound[], delayMs: number) {
  if (!ready || !pool.length) return;
  const s = pool[Math.floor(Math.random() * pool.length)];
  const fire = () => s.replayAsync().catch(() => {});
  if (delayMs > 0) setTimeout(fire, delayMs);
  else fire();
}

export function playStone(delayMs = 0) {
  playFrom(placePool, delayMs);
}

export function playCapture(delayMs = 0) {
  playFrom(capturePool, delayMs);
}

/** Count stones on an 81/361-char board string. */
function stones(board: string) {
  let n = 0;
  for (let i = 0; i < board.length; i++) if (board[i] !== '.') n++;
  return n;
}

/**
 * Sounds for a move that turned board `before` into board `after` with
 * `placed` new stones (1 = user move, 2 = move + auto reply, ...).
 * Captures are detected by the stone count coming up short.
 */
export function soundForMove(before: string, after: string, placed = 1) {
  playStone();
  for (let i = 1; i < placed; i++) playStone(220 * i);
  if (stones(after) < stones(before) + placed) {
    playCapture(120);
  }
}
