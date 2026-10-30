const flashToastStorageKey = "openmonetis:flash-toast";

/** Keeps a success message across a full page reload, such as after resetting account data. */
export function queueFlashToast(message: string) {
  try {
    sessionStorage.setItem(flashToastStorageKey, message);
  } catch {
    // Storage can be unavailable in private contexts; the reload still completes the action.
  }
}

export function consumeFlashToast() {
  try {
    const message = sessionStorage.getItem(flashToastStorageKey);
    sessionStorage.removeItem(flashToastStorageKey);
    return message;
  } catch {
    return null;
  }
}
