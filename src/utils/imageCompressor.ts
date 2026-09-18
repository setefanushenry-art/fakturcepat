/**
 * Utility to resize and compress invoice images on the client side before uploading to server.
 * Prevents PayloadTooLargeError and speeds up OCR processing significantly.
 */

export interface CompressionResult {
  dataUrl: string;
  base64Data: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function compressInvoiceImage(
  file: File,
  maxDimension = 1920,
  quality = 0.85
): Promise<CompressionResult> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Gagal membaca file gambar.'));
    };

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Format file gambar tidak didukung atau rusak.'));
      };

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale while preserving aspect ratio if dimensions exceed maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback if canvas 2d context fails
          const rawDataUrl = reader.result as string;
          const cleanBase64 = rawDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
          resolve({
            dataUrl: rawDataUrl,
            base64Data: cleanBase64,
            mimeType: file.type || 'image/jpeg',
            originalSize,
            compressedSize: originalSize,
            width: img.width,
            height: img.height,
          });
          return;
        }

        // Fill white background to handle transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with optimized quality
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const cleanBase64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

        // Estimate compressed size from base64 length
        const compressedSize = Math.round((cleanBase64.length * 3) / 4);

        resolve({
          dataUrl,
          base64Data: cleanBase64,
          mimeType,
          originalSize,
          compressedSize,
          width,
          height,
        });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
