/**
 * "Gentle chime" for meeting alarms (4a, 4e): two soft sine notes (A5 then E6) that fade out.
 * Synthesised with Web Audio, so there is no sound file and nothing loads from the network.
 */
const NOTES = [
  { frequency: 880, delay: 0 },
  { frequency: 1318.5, delay: 0.18 },
] as const;
const PEAK = 0.18;
const RING_SECONDS = 1.2;
/** Ignore a second request this soon (e.g. React mounting twice in development). */
const MIN_GAP_MS = 1500;
let lastPlayed = 0;

export function playChime(): void {
  if (Date.now() - lastPlayed < MIN_GAP_MS) return;
  lastPlayed = Date.now();
  try {
    const context = new AudioContext();
    void context.resume();
    const start = context.currentTime;
    for (const note of NOTES) {
      const at = start + note.delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(PEAK, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + RING_SECONDS);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + RING_SECONDS + 0.05);
    }
    window.setTimeout(() => {
      void context.close();
    }, 2000);
  } catch (error) {
    // No sound is better than no alarm
    console.error("[chime] failed", error);
  }
}
