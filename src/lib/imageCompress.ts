// Downscales and re-encodes a photo client-side before it's ever sent to
// the server. A phone camera photo can easily be 4-8MB — well past what a
// receipt actually needs to be legible, and past Vercel's ~4.5MB request
// body limit once base64's ~33% overhead is added on top. This trades
// resolution the model doesn't need for a payload that reliably fits.

export interface CompressedImage {
  /** Base64, WITHOUT the "data:image/...;base64," prefix — what the API
   *  expects directly as Anthropic's image source `data` field. */
  base64: string;
  /** Also kept WITH the prefix, ready to drop straight into an <img src>
   *  for the in-chat preview bubble. */
  dataUrl: string;
  mediaType: "image/jpeg";
}

const MAX_DIMENSION = 1600;
const MAX_BASE64_LENGTH = 3_500_000; // stays comfortably under the server's own cap
const MIN_QUALITY = 0.4;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  });
}

/**
 * Resizes `file` so its longest edge is at most MAX_DIMENSION, re-encodes it
 * as JPEG, and steps quality down until the result fits comfortably under
 * the server's size limit (or hits MIN_QUALITY, at which point it's sent as
 * the smallest version achieved rather than failing outright).
 */
export async function compressImageForUpload(file: File): Promise<CompressedImage> {
  // Created and revoked here, in a try/finally that wraps the object URL's
  // entire lifetime — not inside loadImage, whose `await` above used to sit
  // between creating the URL and entering any try/finally. A rejection from
  // loadImage (a corrupted file, a non-image the OS picker didn't block)
  // used to throw before that finally block was ever reached, leaking the
  // blob URL for the rest of the page session; repeated failed attempts
  // (plausible — the error message itself invites a retry) leaked more of
  // them unboundedly.
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > MAX_BASE64_LENGTH && quality > MIN_QUALITY) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return { base64, dataUrl, mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
