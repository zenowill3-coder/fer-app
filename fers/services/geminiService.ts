
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// Helper to init AI
const getAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const ai = getAI();
  const prompt = `
    你是一位资深的未来汽车用户体验研究专家。
    基于以下用户画像和感性需求，生成 6 个最具创新性的功能配置。

    【用户画像】
    - 年龄段/家庭: ${persona.familyStructure}
    - 出行频率: ${persona.travelFrequency}
    - 自动驾驶认知: ${persona.adKnowledge}
    - 自动驾驶接受度: ${persona.adAcceptance}
    - 核心情绪需求: ${persona.emotionalNeeds.join(', ')}
    - 社会意涵: ${persona.socialNeeds.join(', ')}

    【功能感性关键词】
    ${selectedKeywords.join(', ')}

    【要求】
    1. 生成 6 个配置。
    2. 每个配置包含：
       - 标题 (title): 不超过10个字，言简意赅。
       - 说明 (description): 不超过20个字，描述核心价值。
    3. 输出必须是 JSON 格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['title', 'description']
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    return data.map((item: any, index: number) => ({
        ...item,
        id: `func-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error("Round 1 Generation Error:", error);
    // Fallback data in case of error
    return Array(6).fill(0).map((_, i) => ({
      id: `err-${i}`,
      title: "生成服务繁忙",
      description: "请稍后重试或检查网络连接。"
    }));
  }
};

export const generateInteractionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const ai = getAI();
  const prompt = `
    你是一位资深的未来汽车交互设计专家。
    基于以下用户画像和交互感性词，生成 6 个创新的交互体验配置。

    【用户画像】
    - 家庭结构: ${persona.familyStructure}
    - 出行频率: ${persona.travelFrequency}
    - 认知: ${persona.adKnowledge}
    - 接受度: ${persona.adAcceptance}
    - 情绪需求: ${persona.emotionalNeeds.join(', ')}

    【交互感性关键词】
    ${selectedKeywords.join(', ')}

    【要求】
    1. 生成 6 个配置。
    2. 每个配置包含：
       - 标题 (title): 不超过10个字 (例如: "沉浸式光场", "透明驾驶解释")。
       - 说明 (description): 不超过20个字。
    3. 输出必须是 JSON 格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['title', 'description']
            }
          }
      }
    });

    const data = JSON.parse(response.text || "[]");
    return data.map((item: any, index: number) => ({
        ...item,
        id: `inter-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error("Round 2 Generation Error:", error);
    return Array(6).fill(0).map((_, i) => ({
      id: `err-${i}`,
      title: "生成服务繁忙",
      description: "请稍后重试或检查网络连接。"
    }));
  }
};

export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  const ai = getAI();

  // Handle multi-select inputs
  const r1Selected = r1Data.generatedConfigs
    .filter(c => r1Data.selectedConfigIds.includes(c.id))
    .map(c => c.title)
    .join(', ');

  const r2Selected = r2Data.generatedConfigs
    .filter(c => r2Data.selectedConfigIds.includes(c.id))
    .map(c => c.title)
    .join(', ');
  
  // Construct a detailed prompt
  const textPrompt = `
    Design a futuristic autonomous car interior (Concept Art).
    
    Target User: ${persona.familyStructure}.
    Context: Frequent use (${persona.travelFrequency}), Acceptance: ${persona.adAcceptance}.
    Mood: ${persona.emotionalNeeds.join(', ')}.
    Style Description: ${styleDesc}.
    
    Key Features to Visualize:
    ${r1Selected ? `Functional Features: ${r1Selected}` : 'Smart Cabin features'}
    ${r2Selected ? `Interaction Features: ${r2Selected}` : 'Immersive Experience'}
    
    CRITICAL CAMERA & COMPOSITION SETTINGS (MUST FOLLOW EXACTLY, IGNORE REFERENCE IMAGE ANGLE):
    1. PERSPECTIVE: Wide-angle high-angle shot / Overhead wide-angle lens.
    2. ANGLE: Shot from above diagonally downwards to provide a macro overview of the interior space.
    3. CAMERA POSITION: Located above the rear right side. The viewpoint is slightly higher than the rear right seat, looking forward through the front seats towards the dashboard/driving area.
    4. DEPTH OF FIELD: Full depth of field (everything in focus).
    5. CONTENT CONSTRAINT: INTERIOR ONLY. DO NOT render the car's exterior body shell, outlines, wheels, or street. The frame must be filled with the interior cabin.
    6. WINDOWS: Abstract soft light or gradients only outside. No buildings or landscapes.
    
    Visual Style:
    - High quality, photorealistic, futuristic rendering.
    - 16:9 Aspect Ratio.
    - Cinematic lighting.
  `;

  const parts: any[] = [{ text: textPrompt }];
  
  if (styleImageBase64) {
    // Remove header if present (e.g., data:image/png;base64,)
    const base64Data = styleImageBase64.split(',')[1] || styleImageBase64;
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg', // Assuming jpeg/png, standardizing request
        data: base64Data
      }
    });
  }

  const generatedImages: string[] = [];

  // Helper function to generate single image
  const generateSingleImage = async () => {
    return ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
           imageConfig: {
               aspectRatio: "16:9"
           }
        }
    });
  };
  
  try {
      // Generating 3 distinct variations by calling in parallel
      const promises = [1, 2, 3].map(async () => {
         try {
             const response = await generateSingleImage();
             // Extract image
             for (const part of response.candidates?.[0]?.content?.parts || []) {
                 if (part.inlineData) {
                     return `data:image/png;base64,${part.inlineData.data}`;
                 }
             }
             return null;
         } catch (e) {
             console.error("Single image generation failed", e);
             return null;
         }
      });

      const results = await Promise.all(promises);
      results.forEach(res => {
          if (res) generatedImages.push(res);
      });
      
      // Fallback if images failed
      if (generatedImages.length === 0) {
          throw new Error("No images generated");
      }
      
      return generatedImages;

  } catch (error) {
    console.error("Image Generation Error:", error);
    // Return placeholders if failed to avoid breaking the UI flow
    return [
        "https://picsum.photos/1920/1080?random=1",
        "https://picsum.photos/1920/1080?random=2",
        "https://picsum.photos/1920/1080?random=3"
    ];
  }
};

export const generateSessionSummary = async (session: Session): Promise<string> => {
    const ai = getAI();
    
    const r1Choices = session.round1.generatedConfigs
        .filter(c => session.round1.selectedConfigIds.includes(c.id))
        .map(c => `${c.title} (${c.description})`)
        .join('; ');
        
    const r2Choices = session.round2.generatedConfigs
        .filter(c => session.round2.selectedConfigIds.includes(c.id))
        .map(c => `${c.title} (${c.description})`)
        .join('; ');

    const e = session.round3.evaluation;
    const evaluationText = `
      - 形态感知:
        - 喜欢的点: ${e.form.liked || '未填写'}
        - 不喜欢的点: ${e.form.disliked || '未填写'}
      - 比例分量:
        - 喜欢的点: ${e.proportion.liked || '未填写'}
        - 不喜欢的点: ${e.proportion.disliked || '未填写'}
      - 材质触感:
        - 喜欢的点: ${e.material.liked || '未填写'}
        - 不喜欢的点: ${e.material.disliked || '未填写'}
      - 色彩:
        - 喜欢的点: ${e.color.liked || '未填写'}
        - 不喜欢的点: ${e.color.disliked || '未填写'}
    `;

    const prompt = `
      请为本次未来汽车体验研究 Session 撰写一份专业的总结报告。
      
      【用户数据】
      家庭结构: ${session.persona.familyStructure}
      出行频率: ${session.persona.travelFrequency}
      自动驾驶认知: ${session.persona.adKnowledge}
      自动驾驶接受度: ${session.persona.adAcceptance}
      核心需求: ${session.persona.emotionalNeeds.join(', ')}, ${session.persona.socialNeeds.join(', ')}
      
      【Round 1: 功能需求】
      选择配置: ${r1Choices || '无'}
      用户备注: ${session.round1.comment}
      
      【Round 2: 交互体验】
      选择配置: ${r2Choices || '无'}
      用户备注: ${session.round2.comment}
      
      【Round 3: 设计偏好】
      风格描述: ${session.round3.styleDescription}
      评价: ${evaluationText}

      【任务】
      请输出一段约 300-400 字的总结，包含：
      1. 用户画像与核心痛点分析
      2. 功能偏好与场景亮点总结
      3. 交互体验模式洞察
      4. 视觉设计风格与改进建议
      
      语气专业、客观、有洞察力。仅输出纯文本，不要 markdown 格式。
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text || "无法生成总结。";
    } catch (error) {
        console.error("Summary Error:", error);
        return "生成总结时发生错误，请稍后重试。";
    }
}
