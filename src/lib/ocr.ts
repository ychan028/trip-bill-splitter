// On-device OCR with Tesseract. All assets are served from our own origin
// (copied into public/tesseract at build time) and precached by the service
// worker, so this works with no connection.

/** Downscale a photo so OCR and uploads stay fast. Returns a JPEG blob. */
export async function prepareImage(file: Blob, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85),
  );
}

/**
 * Compress a photo for storage in a Firestore document (1 MiB limit, shared
 * with the base64 overhead). Steps down size and quality until it fits.
 */
export async function compressForStorage(file: Blob, maxBytes = 250_000): Promise<string> {
  const bmp = await createImageBitmap(file);
  try {
    for (const [side, quality] of [[1200, 0.6], [1000, 0.5], [800, 0.45], [640, 0.4]] as const) {
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= maxBytes) return url;
    }
    throw new Error("Photo is too large to store");
  } finally {
    bmp.close();
  }
}

// Keep in sync with OCR_CACHE in vite.config.ts.
const OCR_CACHE = "ocr-assets-v1";

/** True when the language data and a core are cached, so scanning works offline. */
export async function isOcrReady(): Promise<boolean> {
  try {
    if (!("caches" in window) || !(await caches.has(OCR_CACHE))) return false;
    const keys = (await (await caches.open(OCR_CACHE)).keys()).map((r) => r.url);
    return keys.some((u) => u.includes("eng.traineddata")) && keys.some((u) => u.includes("tesseract-core"));
  } catch {
    return false;
  }
}

/** Download exactly the OCR files this device needs (~7 MB) by starting and stopping a worker. */
export async function prepareOcr(): Promise<void> {
  const worker = await makeWorker();
  await worker.terminate();
}

async function makeWorker(onProgress?: (pct: number) => void) {
  const { createWorker } = await import("tesseract.js");
  const asset = (p: string) => new URL(`tesseract/${p}`, document.baseURI).href;
  return createWorker("eng", 1, {
    workerPath: asset("worker.min.js"),
    corePath: asset("core"),
    langPath: asset("lang"),
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100));
    },
  });
}

export async function recognizeText(image: Blob, onProgress?: (pct: number) => void): Promise<string> {
  let worker;
  try {
    worker = await makeWorker(onProgress);
  } catch (e) {
    if (!(await isOcrReady())) {
      throw new Error("the scanner isn't downloaded on this phone yet. When online, tap Trip → Prepare offline scanning, or scan once with a connection");
    }
    throw e instanceof Error ? e : new Error(String(e ?? "unknown error"));
  }
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
