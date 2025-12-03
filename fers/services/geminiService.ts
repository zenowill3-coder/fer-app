import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;   // 用于对话
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID; // 用于生图

// ============================================================
// 2. 核心工具 A: 对话/文本推理
// ============================================================
async function callDoubaoTextAPI(messages: any[]) {
  // 必须配合 vercel.json 使用
  const url = "/api/doubao/v3/chat/completions";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: TEXT_MODEL_ID,
        messages: messages,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Text API Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error("对话模型调用失败:", error);
    throw error;
  }
}

// ============================================================
// 3. 核心工具 B: 图片生成 (Image Generation)
// ============================================================
async function callDoubaoImageAPI(prompt: string) {
  // 使用 Vercel 代理转发到豆包生图接口
  const url = "/api/doubao/v3/images/generations";

  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: IMAGE_MODEL_ID,
        prompt: prompt,
        size: "1024x1024" // 豆包标准尺寸
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("生图 API 报错:", err);
        return null; // 失败返回 null
    }
    
    const data = await response.json();
    // 豆包/OpenAI 格式返回 data[0].url
    return data.data?.[0]?.url || null;

  } catch (error) {
    console.error("生图网络请求失败:", error);
    return null;
  }
}

// 辅助：清洗 JSON
function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}


// ============================================================
// 4. 业务功能：Round 1 & 2 (完全还原你的原始 Prompt)
// ============================================================

export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  // 还原原始 Prompt
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
    const resultText = await callDoubaoTextAPI([
      { role: "system", content: "你是一个只输出 JSON 数组的助手。" },
      { role: "user", content: prompt }
    ]);

    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({
        ...item,
        id: `func-${Date.now()}-${index}`
    })) : [];

  } catch (error) {
    console.error("Round 1 Error:", error);
    return Array(6).fill(0).map((_, i) => ({ id: `err-${i}`, title: "生成失败", description: "请重试" }));
  }
};

export const generateInteractionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  // 还原原始 Prompt
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
       - 标题 (title): 不超过10个字。
       - 说明 (description): 不超过20个字。
    3. 输出必须是 JSON 格式。
  `;

  try {
    const resultText = await callDoubaoTextAPI([
      { role: "system", content: "你是一个只输出 JSON 数组的助手。" },
      { role: "user", content: prompt }
    ]);

    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({
        ...item,
        id: `inter-${Date.now()}-${index}`
    })) : [];
  } catch (error) {
    console.error("Round 2 Error:", error);
    return [];
  }
};


// ============================================================
// 5. 业务功能：Round 3 生图 (还原你的并发3张逻辑)
// ============================================================

export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  
  // 1. 数据准备
  const r1Selected = r1Data.generatedConfigs
    .filter(c => r1Data.selectedConfigIds.includes(c.id))
    .map(c => c.title)
    .join(', ');

  const r2Selected = r2Data.generatedConfigs
    .filter(c => r2Data.selectedConfigIds.includes(c.id))
    .map(c => c.title)
    .join(', ');

  // 2. 还原原始的详细 Prompt (Critical Camera Settings 等)
  const basePrompt = `
    Design a futuristic autonomous car interior (Concept Art).
    
    Target User: ${persona.familyStructure}.
    Context: Frequent use (${persona.travelFrequency}), Acceptance: ${persona.adAcceptance}.
    Mood: ${persona.emotionalNeeds.join(', ')}.
    Style Description: ${styleDesc}.
    
    Key Features to Visualize:
    ${r1Selected ? `Functional Features: ${r1Selected}` : 'Smart Cabin features'}
    ${r2Selected ? `Interaction Features: ${r2Selected}` : 'Immersive Experience'}
    
    CRITICAL CAMERA & COMPOSITION SETTINGS (MUST FOLLOW EXACTLY):
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

  console.log("正在请求豆包生成 3 张图片...");

  // 3. 并发生成 3 张 (还原 Promise.all 逻辑)
  // 为了防止生成的图一模一样，我们给每个请求加一点微小的随机噪点词
  const variations = [
      "Variation 1: emphasize warm lighting",
      "Variation 2: emphasize clean lines",
      "Variation 3: emphasize spacious feeling"
  ];

  try {
      // 同时发起 3 个请求
      const promises = variations.map(v => callDoubaoImageAPI(basePrompt + `\n(${v})`));
      
      const results = await Promise.all(promises);
      
      // 过滤掉失败的 (null)
      const validImages = results.filter(url => url !== null) as string[];

      // 4. 兜底逻辑：如果生成的少于 3 张，用占位图补齐
      // 这样保证你的 UI 不会因为只有 1 张图而排版错乱
      const placeholders = [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
      ];

      // 补齐到 3 张
      let finalImages = [...validImages];
      let pIndex = 0;
      while (finalImages.length < 3) {
          finalImages.push(placeholders[pIndex % 3]);
          pIndex++;
      }

      return finalImages;

  } catch (error) {
    console.error("批量生图失败:", error);
    // 全部失败时的兜底
    return [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
    ];
  }
};

export const generateSessionSummary = async (session: Session): Promise<string> => {
    // 还原原始 Prompt
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
        const text = await callDoubaoTextAPI([{ role: "user", content: prompt }]);
        return text || "生成总结失败";
    } catch (e) {
        return "服务繁忙，无法生成总结。";
    }
}
