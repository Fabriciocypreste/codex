/* ============================================================
   SOUND EFFECTS SYSTEM FOR TV BOX / SMART TV
   Generates UI sounds using Web Audio API (no external files)
   - navigate: subtle tick when moving between items
   - select:   confirmation tone when pressing Enter
   - back:     soft descending tone on Escape/Back
   - error:    short buzz for invalid actions
   ============================================================ */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Subtle tick when navigating between items (D-Pad) */
export function playNavigateSound(): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Silently fail — audio not critical
  }
}

/** Confirmation tone when selecting/pressing Enter */
export function playSelectSound(): void {
  try {
    const ctx = getAudioContext();

    // Two-tone chime
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08); // G5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.18);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.18);
  } catch {
    // Silently fail
  }
}

/** Soft descending tone on Back/Escape */
export function playBackSound(): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Silently fail
  }
}

/** Short buzz for invalid/error actions */
export function playErrorSound(): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Silently fail
  }
}

/**
 * Initialize audio context on first user interaction.
 * Call this once on the first click/keydown to unlock audio on mobile/TV.
 */
export function initAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Create and immediately stop a silent oscillator to unlock
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.001);
  } catch {
    // Silently fail
  }
}
