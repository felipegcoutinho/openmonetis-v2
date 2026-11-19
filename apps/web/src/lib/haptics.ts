/**
 * Short tactile tick for gestures that cross a threshold (pull to refresh, swipe to close, long
 * press). Android only: iOS Safari exposes no vibration API, so it is a silent no-op there.
 */
export function hapticTick() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(8);
  } catch {
    // Some browsers throw without a prior user gesture; the feedback is optional.
  }
}
