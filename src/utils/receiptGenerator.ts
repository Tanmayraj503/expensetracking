/**
 * Receipt image utilities for camera capture, compression, and receipt generation.
 */

export interface ReceiptData {
  merchant: string;
  amount: number;
  date: string;
  time?: string;
  category?: string;
  paymentMethod?: string;
  items?: Array<{ name: string; price: number }>;
}

/**
 * Compresses an image file (e.g., from camera or file input) to a base64 JPEG data URL.
 */
export async function compressImageFileToBase64(
  file: File | Blob,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Slight contrast and sharpness enhancement for paper text
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Captures the current frame of an active video element and returns a base64 JPEG data URL.
 */
export function captureVideoFrameToBase64(
  video: HTMLVideoElement,
  quality = 0.85
): string | null {
  try {
    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('Failed to capture video frame to base64:', err);
    return null;
  }
}

/**
 * Generates an authentic thermal paper receipt base64 JPEG data URL.
 * Used for pre-populated sample expenses and simulated camera snapshots.
 */
export function generateReceiptBase64(data: ReceiptData, currencySymbol = '$'): string {
  if (typeof document === 'undefined') return '';
  const width = 480;
  const height = 640;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - realistic aged receipt paper
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, width, height);

  // Subtle paper grain
  ctx.fillStyle = 'rgba(0,0,0,0.015)';
  for (let i = 0; i < 200; i++) {
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    ctx.fillRect(rx, ry, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }

  // Jagged paper tear edges at top and bottom
  ctx.fillStyle = '#1e293b'; // dark border outside paper
  ctx.fillRect(0, 0, width, 8);
  ctx.fillRect(0, height - 8, width, 8);

  ctx.fillStyle = '#faf8f5';
  const zigzagCount = 24;
  const step = width / zigzagCount;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i < zigzagCount; i++) {
    ctx.lineTo((i + 0.5) * step, 10);
    ctx.lineTo((i + 1) * step, 0);
  }
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i < zigzagCount; i++) {
    ctx.lineTo((i + 0.5) * step, height - 10);
    ctx.lineTo((i + 1) * step, height);
  }
  ctx.fill();

  // Receipt Content
  ctx.fillStyle = '#1f2937';
  ctx.textAlign = 'center';

  // Store Logo / Merchant Header
  ctx.font = 'bold 22px monospace';
  ctx.fillText(data.merchant.toUpperCase(), width / 2, 55);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#4b5563';
  ctx.fillText('STORE #4092 • VERIFIED TRANSACTION', width / 2, 78);
  ctx.fillText(`${data.date} ${data.time || '12:45 PM'} • TERMINAL 03`, width / 2, 96);

  // Divider
  ctx.strokeStyle = '#9ca3af';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(35, 115);
  ctx.lineTo(width - 35, 115);
  ctx.stroke();

  // Line Items
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  ctx.font = '13px monospace';
  ctx.fillStyle = '#111827';

  const defaultItems = [
    { name: 'ITEM #1 ' + (data.category || 'EXPENSE'), price: data.amount * 0.65 },
    { name: 'SERVICE & PROCESSING', price: data.amount * 0.25 },
    { name: 'REGIONAL TAX / SURCHARGE', price: data.amount * 0.1 },
  ];
  const items = data.items || defaultItems;

  let y = 145;
  items.forEach((item) => {
    ctx.textAlign = 'left';
    ctx.fillText(item.name.slice(0, 24), 40, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${currencySymbol}${item.price.toFixed(2)}`, width - 40, y);
    y += 26;
  });

  // Subtotal Divider
  y += 10;
  ctx.strokeStyle = '#9ca3af';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(35, y);
  ctx.lineTo(width - 35, y);
  ctx.stroke();

  // Total Section
  y += 30;
  ctx.setLineDash([]);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL AMOUNT', 40, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${currencySymbol}${data.amount.toFixed(2)}`, width - 40, y);

  // Payment Method & Approval
  y += 35;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#4b5563';
  ctx.textAlign = 'left';
  ctx.fillText(`METHOD: ${data.paymentMethod || 'CREDIT CARD'}`, 40, y);
  ctx.textAlign = 'right';
  ctx.fillText('AUTH: #984210', width - 40, y);

  y += 20;
  ctx.textAlign = 'left';
  ctx.fillText('STATUS: APPROVED / SETTLED', 40, y);
  ctx.textAlign = 'right';
  ctx.fillText('REF: ' + Math.random().toString(36).substring(2, 9).toUpperCase(), width - 40, y);

  // Barcode representation
  y += 45;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111827';
  const barcodeWidth = 320;
  const barcodeStart = (width - barcodeWidth) / 2;
  const barCount = 42;
  const barStep = barcodeWidth / barCount;
  for (let b = 0; b < barCount; b++) {
    const isThick = (b * 7 + 3) % 4 === 0;
    const barW = isThick ? 4 : 2;
    ctx.fillRect(barcodeStart + b * barStep, y, barW, 40);
  }

  y += 56;
  ctx.font = '11px monospace';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('* THANK YOU FOR YOUR BUSINESS *', width / 2, y);

  return canvas.toDataURL('image/jpeg', 0.85);
}
