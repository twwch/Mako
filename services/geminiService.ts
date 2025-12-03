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
  // Prompt optimized: Strict Edge-to-Edge Layout to match slicing algorithm.
  const systemDirective = `
    任务：生成一张包含 24 个表情包的 4x6 网格图。
    
    关键布局要求 (非常重要)：
    1. **严格填满画布**：4x6 网格必须完全覆盖整张 16:9 图片，**绝对不要有任何外部边框、留白或边缘填充**。
    2. **平均分布**：必须是标准的 6 列 x 4 行，每个格子的宽高完全一致。
    3. **背景统一**：所有 24 个格子必须使用完全相同的纯色背景颜色 (例如淡黄色、淡粉色等)，不要使用多种颜色，不要渐变。
    4. **安全边距**：文字和主要图案必须居中，**远离格子的四条边缘**，至少保留 15% 的内部边距，防止切割时文字被截断。

    内容要求：
    1. 涵盖各种常用聊天语句或娱乐梗。
    2. 不要原图复制，需进行创意重绘，保持统一的角色形象和画风。
    3. 所有标注必须为手写简体中文。
    4. 分割线处理：尽量让分割线极细或与背景融合，确保在切割时不会留下明显的粗线条。

    技术参数：
    - 分辨率：4K
    - 比例：16:9
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
        imageSize: "2K",
        aspectRatio: "16:9"
      }
    }
  });

  return extractImage(response);
};

export const generateLogo = async (params: MemePromptParams): Promise<string> => {
  const ai = getClient();
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
        imageSize: "1K",
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