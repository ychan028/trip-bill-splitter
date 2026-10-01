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

export async function recognizeText(image: Blob, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const asset = (p: string) => new URL(`tesseract/${p}`, document.baseURI).href;
  const worker = await createWorker("eng", 1, {
    workerPath: asset("worker.min.js"),
    corePath: asset("core"),
    langPath: asset("lang"),
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
