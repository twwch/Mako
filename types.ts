export enum AppState {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  PROCESSING = 'PROCESSING', // Slicing images
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface SlicedImage {
  id: string;
  blob: Blob;
  dataUrl: string;
  fileName: string;
}

export interface MarketingAsset {
  type: 'banner' | 'logo';
  blob: Blob;
  dataUrl: string;
  fileName: string;
}

export interface GenerationResult {
  originalImageBase64: string;
  slicedImages: SlicedImage[];
  banner?: MarketingAsset;
  logo?: MarketingAsset;
}

export interface MemePromptParams {
  userPrompt: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}