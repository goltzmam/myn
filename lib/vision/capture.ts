export async function frame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight)
    throw new Error("Screen preview is not ready.");
  const ratio = Math.min(1, 1280 / video.videoWidth),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * ratio);
  canvas.height = Math.round(video.videoHeight * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Screen capture unavailable");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.65);
}
export function changed(
  previous: Uint8ClampedArray,
  current: Uint8ClampedArray,
  threshold = 8,
) {
  if (previous.length !== current.length) return true;
  let delta = 0;
  for (let i = 0; i < current.length; i += 16)
    delta += Math.abs(previous[i] - current[i]);
  return delta / (current.length / 16) > threshold;
}
