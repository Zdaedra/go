// Stone sounds: a clack when a stone lands, a double clack when stones
// are captured. A small pool of preloaded players lets rapid moves
// overlap, and a subtle random playback-rate change keeps the clack from
// sounding machine-identical. Sound is a nicety — every call swallows
// errors so audio problems can never break the game.

import { Audio } from 'expo-av';

const POOL = 3;
let placePool: Audio.Sound[] = [];
let captureSound: Audio.Sound | null = null;
let cursor = 0;
let ready = false;

export async function initStoneSounds() {
  if (ready) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    placePool = await Promise.all(
      Array.from({ length: POOL }, async () => {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/stone-place.wav'),
          { volume: 0.9 }
        );
        return sound;
      })
    );
    captureSound = (
      await Audio.Sound.createAsync(
        require('../../assets/sounds/stone-capture.wav'),
        { volume: 0.8 }
      )
    ).sound;
    ready = true;
  } catch {
    // no audio device / interrupted session — play silently ever after
  }
}

export function playStone(delayMs = 0) {
  if (!ready || !placePool.length) return;
  const s = placePool[cursor++ % placePool.length];
  const fire = () => {
    s.setRateAsync(0.94 + Math.random() * 0.12, false).catch(() => {});
    s.replayAsync().catch(() => {});
  };
  if (delayMs > 0) setTimeout(fire, delayMs);
  else fire();
}

export function playCapture(delayMs = 0) {
  if (!ready || !captureSound) return;
  const fire = () => captureSound!.replayAsync().catch(() => {});
  if (delayMs > 0) setTimeout(fire, delayMs);
  else fire();
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
