/** Keep uploads under Vercel’s ~4.5MB serverless body limit. */
export const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.82;

/**
 * Downscale + JPEG-compress an image for multipart uploads.
 * Non-images / SVG / failure → returns the original file.
 */
export async function compressImageForUpload(
  file: File,
  options?: { maxEdge?: number; maxBytes?: number; quality?: number },
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  const maxBytes = options?.maxBytes ?? MAX_UPLOAD_BYTES;
  if (file.size <= 800_000 && file.type === 'image/jpeg') {
    return file;
  }

  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  let quality = options?.quality ?? DEFAULT_QUALITY;

  const bitmap = await loadBitmap(file);
  if (!bitmap) return file;

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToJpeg(canvas, quality);
    while (blob && blob.size > maxBytes && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasToJpeg(canvas, quality);
    }

    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
}

/** User-facing Arabic message for 413 / oversized upload failures. */
export function uploadTooLargeMessage(status?: number): string | null {
  if (status === 413 || status === 503) {
    return 'حجم الصورة كبير جداً. اختر صورة أوضح بحجم أصغر وحاول مرة أخرى.';
  }
  return null;
}
