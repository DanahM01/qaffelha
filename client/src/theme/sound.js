// Owner: Danah (theme). Game sounds, made in code with Web Audio: no sound files to download.
// It only listens to the shared socket (EVENTS.md) and never sends anything,
// so the host and phone screens do not need to change.
import { socket } from '../socket.js';

const MUTE_KEY = 'qaffelha-muted';
let ctx = null;
let master = null;
let muted = readMuted();
let introPlayed = false;
let timers = [];
let lastPlayers = 0;
let myScore = 0;
const listeners = new Set();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function myId() {
  try {
    return JSON.parse(sessionStorage.getItem('qaffelha'))?.playerId || null;
  } catch {
    return null;
  }
}

// Browsers only allow sound after the first tap, so the audio starts on that tap.
function audio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, length, { type = 'sine', volume = 0.3, slideTo } = {}) {
  const ac = audio();
  if (!ac || muted) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

// Radio static: white noise through a filter that sweeps, like tuning in.
function noise(start, length, { volume = 0.25, from = 3000, to = 800 } = {}) {
  const ac = audio();
  if (!ac || muted) return;
  const t = ac.currentTime + start;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + length);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export const sounds = {
  // First tap: static, then the lock "clunk" of the logo.
  intro() {
    noise(0, 0.7, { volume: 0.3, from: 4000, to: 600 });
    tone(140, 0.62, 0.12, { type: 'square', volume: 0.25 });
    tone(90, 0.7, 0.18, { type: 'square', volume: 0.3 });
    tone(880, 0.85, 0.25, { volume: 0.15 });
  },
  click() {
    tone(1200, 0, 0.05, { type: 'triangle', volume: 0.12 });
  },
  join() {
    tone(660, 0, 0.1, { type: 'triangle', volume: 0.2 });
    tone(990, 0.08, 0.14, { type: 'triangle', volume: 0.2 });
  },
  count() {
    tone(520, 0, 0.18, { type: 'square', volume: 0.15 });
  },
  go() {
    noise(0, 0.25, { volume: 0.15, from: 1500, to: 6000 });
    tone(784, 0, 0.35, { type: 'square', volume: 0.15 });
    tone(1046, 0, 0.35, { type: 'square', volume: 0.12 });
  },
  tick() {
    tone(1500, 0, 0.04, { type: 'square', volume: 0.1 });
  },
  // I locked a word.
  mine() {
    tone(880, 0, 0.1, { type: 'triangle', volume: 0.25 });
    tone(1320, 0.07, 0.18, { type: 'triangle', volume: 0.25 });
  },
  // Someone else locked a word.
  lock() {
    tone(180, 0, 0.08, { type: 'square', volume: 0.15 });
    tone(120, 0.05, 0.1, { type: 'square', volume: 0.15 });
  },
  minus() {
    tone(200, 0, 0.3, { type: 'sawtooth', volume: 0.18, slideTo: 110 });
  },
  timeUp() {
    noise(0, 0.5, { volume: 0.2, from: 2000, to: 300 });
    tone(330, 0, 0.5, { type: 'square', volume: 0.12, slideTo: 165 });
  },
  out() {
    [523, 440, 349, 262].forEach((f, i) => tone(f, i * 0.16, 0.22, { type: 'triangle', volume: 0.22 }));
  },
  safe() {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.16, { type: 'triangle', volume: 0.2 }));
  },
  win() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
      tone(f, i * 0.13, i === 5 ? 0.6 : 0.16, { type: 'square', volume: 0.14 }),
    );
  },
};

// Phone vibration (Android; iPhone ignores it). Follows the mute button.
function buzz(pattern) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* Not supported. */
  }
}

function later(ms, fn) {
  timers.push(setTimeout(fn, Math.max(0, ms)));
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

// Times are drawn from when the event arrives, so a wrong phone clock does not shift them.
socket.on('room:players', ({ players = [] }) => {
  if (players.length > lastPlayers && lastPlayers > 0) sounds.join();
  lastPlayers = players.length;
});
socket.on('round:countdown', () => {
  clearTimers();
  sounds.count();
  later(1000, sounds.count);
  later(2000, sounds.count);
});
socket.on('round:start', () => {
  clearTimers();
  myScore = 0;
  sounds.go();
  for (let left = 5; left >= 1; left--) later(20000 - left * 1000, sounds.tick);
});
socket.on('answer:locked', ({ by } = {}) => {
  if (by?.id && by.id === myId()) {
    sounds.mine();
    buzz(40);
  }
  else sounds.lock();
});
socket.on('score:update', ({ scores = [] } = {}) => {
  const me = scores.find((entry) => entry.id === myId());
  if (!me) return;
  if (me.score < myScore) {
    sounds.minus();
    buzz([70, 50, 70]);
  }
  myScore = me.score;
});
socket.on('round:end', ({ eliminated } = {}) => {
  clearTimers();
  sounds.timeUp();
  const id = myId();
  if (!id) later(600, sounds.out);
  else if (eliminated?.id === id) {
    later(600, sounds.out);
    buzz(300);
  }
  else later(600, sounds.safe);
});
socket.on('game:over', () => {
  clearTimers();
  sounds.win();
});
socket.on('disconnect', clearTimers);

// The first tap anywhere plays the intro; every button press after that clicks.
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!introPlayed) {
        introPlayed = true;
        audio();
        sounds.intro();
        return;
      }
      if (event.target.closest?.('button')) sounds.click();
    },
    true,
  );
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    /* Storage may be blocked; mute still works for this visit. */
  }
  if (master) master.gain.value = value ? 0 : 0.6;
  listeners.forEach((fn) => fn(value));
}

export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
