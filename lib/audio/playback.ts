"use client";
// Keep a real audio control so users can recover from browser autoplay restrictions.
export async function playToCompletion(
  element: HTMLAudioElement,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let complete = false;
    const cleanup = () => {
      element.removeEventListener("ended", ended);
      element.removeEventListener("pause", ended);
      element.removeEventListener("error", failed);
    };
    const ended = () => {
      if (complete) return;
      complete = true;
      cleanup();
      resolve(true);
    };
    const failed = () => {
      if (complete) return;
      complete = true;
      cleanup();
      reject(new Error("Audio playback failed."));
    };
    element.addEventListener("ended", ended);
    element.addEventListener("pause", ended);
    element.addEventListener("error", failed);
    void element.play().catch((error) => {
      cleanup();
      if (error?.name === "NotAllowedError") resolve(false);
      else reject(error);
    });
  });
}
