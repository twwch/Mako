import { GoogleGenAI } from "@google/genai";
import { MemePromptParams } from "../types";

export const ensureApiKey = async (): Promise<boolean> => {
  // Use type assertion to avoid conflicts with global window types
  const win = window as any;
  if (win.aistudio) {
    const hasKey = await win.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await win.aistudio.openSelectKey();
      // We assume success after the dialog closes/promise resolves as per instructions
      return true;
    }
    return true;
  }
  // Fallback: If not in aistudio, just return true.
  return true;
};

const getClient = () => {
  let apiKey = '';

  // 1. Try process.env (Node/Webpack/Polyfilled environments)
  try {
    // Check type explicitly to prevent ReferenceError if process is undefined
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
    }
  } catch (e) {
    // Ignore errors accessing process
  }

  // 2. Try import.meta.env (Vite environments)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const env = import.meta.env;
      apiKey = apiKey || env.VITE_API_KEY || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    }
  } catch (e) {
    // Ignore errors accessing import.meta
  }

  if (!apiKey) {
    console.warn("Gemini API Key is missing. Please check your .env configuration. For Vite, verify variable starts with VITE_");
  }

  return new GoogleGenAI({ apiKey });
};

const extractImage = (response: any): string => {
    let base64Image: string | null = null;
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }
    if (!base64Image) {
      throw new Error("No image data found in response.");
    }
    return base64Image;
}

export const generateMemeImage = async (params: MemePromptParams): Promise<string> => {
  const ai = getClient();
  const systemDirective = `
    使用 4×6 布局；涵盖各种常用聊天语句或相关娱乐 meme。
    其他需求：
    1. 不要原图复制，需进行创意重绘或风格迁移。
    2. 所有标注必须为手写简体中文。
    3. 生成的图片需为 4K 分辨率 16:9。
    4. 网格线应隐约或不可见，便于裁剪。
  `;

  const finalPrompt = `${params.userPrompt}. ${systemDirective}`;

  const parts: any[] = [];
  if (params.referenceImageBase64 && params.referenceImageMimeType) {
    parts.push({
      inlineData: {
        data: params.referenceImageBase64,
        mimeType: params.referenceImageMimeType
      }
    });
  }
  parts.push({ text: finalPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: parts },
    config: {
      imageConfig: {
        imageSize: "4K",
        aspectRatio: "16:9"
      }
    }
  });

  return extractImage(response);
};

export const generateBanner = async (params: MemePromptParams): Promise<string> => {
  const ai = getClient();
  // Banner specific prompt
  const bannerPrompt = `
    创建一个网站横幅图 (Banner)。
    内容：${params.userPrompt}。
    风格：必须与参考图(如果有)或描述的主题一致。
    重要要求：背景不能是白色的，要色彩丰富，有吸引力。适合作为社交媒体或网站的封面。
  `;

  const parts: any[] = [];
  if (params.referenceImageBase64 && params.referenceImageMimeType) {
    parts.push({
      inlineData: {
        data: params.referenceImageBase64,
        mimeType: params.referenceImageMimeType
      }
    });
  }
  parts.push({ text: bannerPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: parts },
    config: {
      imageConfig: {
        imageSize: "2K", // Enough for 750px width
        aspectRatio: "16:9"
      }
    }
  });

  return extractImage(response);
};

export const generateLogo = async (params: MemePromptParams): Promise<string> => {
  const ai = getClient();
  // Logo specific prompt
  const logoPrompt = `
    设计一个 App 图标 (Logo)。
    内容：${params.userPrompt}。
    风格：简洁，图标化，矢量风格。
    比例：1:1 正方形。
  `;

  const parts: any[] = [];
  if (params.referenceImageBase64 && params.referenceImageMimeType) {
    parts.push({
      inlineData: {
        data: params.referenceImageBase64,
        mimeType: params.referenceImageMimeType
      }
    });
  }
  parts.push({ text: logoPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: parts },
    config: {
      imageConfig: {
        imageSize: "1K", // Enough for logo
        aspectRatio: "1:1"
      }
    }
  });

  return extractImage(response);
};

export const generateMemeMetadata = async (params: MemePromptParams): Promise<{title: string, description: string}> => {
  const ai = getClient();
  const prompt = `
    你是一个表情包素材专家。请根据用户的描述，为这套表情包生成一个吸引人的标题和一段简介。
    
    用户描述：${params.userPrompt}
    
    要求：
    1. 标题 (title)：中文，简短有力，20字以内。
    2. 简介 (description)：中文，适合用于提交到表情商店或社交媒体的介绍，100字以内。
    
    请直接返回 JSON 格式，包含 "title" 和 "description" 两个字段。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  try {
    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse metadata JSON", e);
    return { 
      title: '创意表情包', 
      description: params.userPrompt.substring(0, 100) 
    };
  }
};