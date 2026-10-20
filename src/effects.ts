// Small "juice" helpers: confetti, sounds and haptics. All optional and fail-safe.

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let frame = 0;

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rot: number; vr: number; life: number;
}

/** Confetti uses shades of the current theme color, plus white and gold sparkle. */
function confettiColors(): string[] {
  const css = getComputedStyle(document.documentElement);
  const shades = ['--accent', '--accent-2', '--accent-deep'].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
  return [...shades, ...shades, '#ffffff', '#ffd166'];
}

export function confetti(x: number, y: number, amount = 40) {
  if (reducedMotion()) return;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const colors = confettiColors();
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 4 + Math.random() * 5,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      life: 1,
    });
  }
  if (!frame) frame = requestAnimationFrame(tick);
}

function tick() {
  const ctx = canvas!.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < innerHeight + 20);
  for (const p of particles) {
    p.vy += 0.25;
    p.vx *= 0.98;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.012;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  frame = particles.length ? requestAnimationFrame(tick) : 0;
}

let audio: AudioContext | null = null;

/** A short rising chime; `notes` pitches climb for bigger rewards. */
export function chime(notes: number[] = [660, 880]) {
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    notes.forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + i * 0.08;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // Audio not available.
  }
}

export function haptic(pattern: number | number[] = 12) {
  navigator.vibrate?.(pattern);
}
