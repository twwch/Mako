import JSZip from 'jszip';
import saveAs from 'file-saver';
import { SlicedImage, MarketingAsset } from '../types';

// The layout requested is 4x6 (Rows x Cols or Cols x Rows).
// Given 16:9 Aspect Ratio and the nature of "meme grids", a 6 column x 4 row layout 
// results in roughly square cells (which is typical for stickers/memes).
const COLS = 6;
const ROWS = 4;

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,") to get raw base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Resizes and compresses an image to specific dimensions.
 * Handles cropping to fill the target aspect ratio (cover).
 */
export const processImage = async (
  imageBase64: string, 
  targetWidth: number, 
  targetHeight: number,
  fileName: string
): Promise<MarketingAsset> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:image/png;base64,${imageBase64}`;
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Calculate "cover" dimensions
      const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
      const x = (targetWidth / 2) - (img.width / 2) * scale;
      const y = (targetHeight / 2) - (img.height / 2) * scale;

      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      // Determine mime type based on file extension
      const mimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      // Export
      const dataUrl = canvas.toDataURL(mimeType, 0.9);
      
      // Convert to Blob
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });

      resolve({
        type: fileName.includes('banner') ? 'banner' : 'logo',
        blob,
        dataUrl,
        fileName
      });
    };

    img.onerror = (e) => reject(new Error("Image processing failed"));
  });
};

export const sliceMemeGrid = async (imageBase64: string): Promise<SlicedImage[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:image/png;base64,${imageBase64}`;
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const slices: SlicedImage[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      const cellWidth = img.width / COLS;
      const cellHeight = img.height / ROWS;
      const borderRadius = Math.min(cellWidth, cellHeight) * 0.05; // Reduced to 5% radius to avoid corner clipping
      
      // NO CROP/ZOOM: We use exact coordinates to prevent text clipping.
      // const CROP_RATIO = 0; 

      // Iterate through grid
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          // Resize canvas for the cell
          canvas.width = cellWidth;
          canvas.height = cellHeight;
          
          // Clear canvas (ensures transparent background outside the rounded rect)
          ctx.clearRect(0, 0, cellWidth, cellHeight);

          // Create rounded rectangle path for aesthetic clipping (optional but good for stickers)
          ctx.beginPath();
          ctx.moveTo(borderRadius, 0);
          ctx.lineTo(cellWidth - borderRadius, 0);
          ctx.quadraticCurveTo(cellWidth, 0, cellWidth, borderRadius);
          ctx.lineTo(cellWidth, cellHeight - borderRadius);
          ctx.quadraticCurveTo(cellWidth, cellHeight, cellWidth - borderRadius, cellHeight);
          ctx.lineTo(borderRadius, cellHeight);
          ctx.quadraticCurveTo(0, cellHeight, 0, cellHeight - borderRadius);
          ctx.lineTo(0, borderRadius);
          ctx.quadraticCurveTo(0, 0, borderRadius, 0);
          ctx.closePath();
          
          // Clip to the rounded rectangle
          ctx.save();
          ctx.clip();

          // Standard 1:1 Drawing without zoom/cropping
          const sourceX = col * cellWidth;
          const sourceY = row * cellHeight;
          
          ctx.drawImage(
            img,
            sourceX,          // sx: Exact start x
            sourceY,          // sy: Exact start y
            cellWidth,        // sWidth: Exact width
            cellHeight,       // sHeight: Exact height
            0,                // dx
            0,                // dy
            cellWidth,        // dWidth 
            cellHeight        // dHeight
          );
          
          // Restore context
          ctx.restore();

          const dataUrl = canvas.toDataURL('image/png');
          
          // Convert DataURL to Blob for zip
          const byteString = atob(dataUrl.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: 'image/png' });
          const index = row * COLS + col + 1;

          slices.push({
            id: `meme-${index}`,
            blob: blob,
            dataUrl: dataUrl,
            fileName: `meme_${index.toString().padStart(2, '0')}.png`
          });
        }
      }
      resolve(slices);
    };

    img.onerror = (e) => reject(new Error("加载生成的图片失败，无法切片。"));
  });
};

export const downloadBatch = async (
  slices: SlicedImage[], 
  extraAssets: MarketingAsset[] = [],
  metaData?: { title: string; description: string }
) => {
  const zip = new JSZip();
  
  // Add meme slices
  const stickersFolder = zip.folder("stickers");
  slices.forEach((slice) => {
    stickersFolder?.file(slice.fileName, slice.blob);
  });

  // Add marketing assets (Banner, Logo)
  extraAssets.forEach((asset) => {
    zip.file(asset.fileName, asset.blob);
  });

  // Add info.txt if metadata exists
  if (metaData) {
    const infoContent = `Title: ${metaData.title}\n\nDescription:\n${metaData.description}\n\nGenerated by AI Creative Meme Studio`;
    zip.file("info.txt", infoContent);
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "meme_pack.zip");
};