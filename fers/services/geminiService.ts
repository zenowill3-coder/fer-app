import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域：获取双模型 ID
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;   // 用于对话
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID; // 用于生图

// 检查配置
if (!API_KEY || !TEXT_MODEL_ID) {
  console.error("⚠️ 警告: 缺少 API Key 或 对话模型 ID");
}

// ============================================================
// 2. 核心工具 A: 对话/文本推理 (Chat Completion)
// ============================================================
async function callDoubaoTextAPI(messages: any[]) {
  const url = "/api/doubao/v3/chat/completions"; // 走 Vercel 代理

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: TEXT_MODEL_ID, // 使用对话模型 ID
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
  // 豆包/火山引擎兼容 OpenAI DALL-E 的生图接口
  const url = "/api/doubao/v3/images/generations"; // 走 Vercel 代理

  if (!IMAGE_MODEL_ID) {
    console.error("未配置生图模型 ID (VITE_DOUBAO_IMAGE_ID)");
    throw new Error("生图模型未配置");
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: IMAGE_MODEL_ID, // 使用生图模型 ID
        prompt: prompt,        // 绘画提示词
        size: "1024x1024"      // 图片尺寸
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("生图 API 报错:", err);
        throw new Error(`Image API Error: ${response.status}`);
    }
    
    const data = await response.json();
    // 豆包返回格式通常也是 data[0].url
    return data.data[0].url;

  } catch (error) {
    console.error("生图模型调用失败:", error);
    throw error; // 继续抛出，让外层处理
  }
}

// 辅助：清洗 JSON
function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}


// ============================================================
// 4. 业务功能：文字生成部分 (Round 1 & 2)
// ============================================================

export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const prompt = `
    你是一位资深的未来汽车用户体验研究专家。
    基于以下用户画像和感性需求，生成 6 个最具创新性的功能配置。
    【用户画像】家庭: ${persona.familyStructure}, 认知: ${persona.adKnowledge}
    【感性关键词】${selectedKeywords.join(', ')}
    【要求】输出纯 JSON 数组，每个包含 id, title (10字内), description (20字内)。
  `;

  try {
    // 调用文字模型
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
    return Array(6).fill(0).map((_, i) => ({ id: `err-${i}`, title: "生成繁忙", description: "请重试" }));
  }
};

export const generateInteractionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const prompt = `
    你是一位资深的未来汽车交互设计专家。
    基于关键词: ${selectedKeywords.join(', ')}，生成 6 个交互体验配置。
    【要求】输出纯 JSON 数组，包含 title 和 description。
  `;

  try {
    // 调用文字模型
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
// 5. 业务功能：生图部分 (Round 3) - 真正调用豆包生图
// ============================================================

export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  
  // 1. 构建生图提示词 (Prompt)
  // 我们需要把用户选的功能合并成一段英文 Prompt，因为生图模型对英文理解更好
  // 如果豆包生图支持中文，也可以用中文
  const r1Selected = r1Data.generatedConfigs.filter(c => r1Data.selectedConfigIds.includes(c.id)).map(c => c.title).join(',');
  const r2Selected = r2Data.generatedConfigs.filter(c => r2Data.selectedConfigIds.includes(c.id)).map(c => c.title).join(',');

  const imagePrompt = `
    Futuristic autonomous vehicle interior design, concept art.
    Target User: ${persona.familyStructure}. Style: ${styleDesc}.
    Key Features: ${r1Selected}, ${r2Selected}.
    View: Wide-angle interior shot, cinematic lighting, high detail, photorealistic, 8k.
    (No text, no humans, car interior only).
  `;

  console.log("正在调用豆包生图模型...");

  // 2. 并行生成 3 张图 (如果你想省钱，可以改成生成 1 张)
  // 注意：生图比较慢，可能会消耗较多 Token
  const generatedImages: string[] = [];

  try {
      // 为了演示稳定性，我们先尝试生成 1 张试试。
      // 如果要生成 3 张，需要循环调用 3 次 callDoubaoImageAPI
      const imgUrl1 = await callDoubaoImageAPI(imagePrompt);
      if (imgUrl1) generatedImages.push(imgUrl1);

      // 如果你想生成更多，可以取消下面的注释（注意额度消耗）
      // const imgUrl2 = await callDoubaoImageAPI(imagePrompt + " side view");
      // if (imgUrl2) generatedImages.push(imgUrl2);

  } catch (error) {
      console.error("生图失败，回退到占位图:", error);
  }

  // 3. 兜底逻辑：如果一张都没生成出来，还是返回占位图防止白屏
  if (generatedImages.length === 0) {
      return [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
      ];
  }

  // 豆包生成的图可能只有 1 小时有效期，建议在前端尽快展示
  // 如果生成的少于 3 张，用占位图补齐
  while (generatedImages.length < 3) {
      generatedImages.push("https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80");
  }

  return generatedImages;
};

export const generateSessionSummary = async (session: Session): Promise<string> => {
    const prompt = `请为本次研究写一份300字总结。用户: ${session.persona.familyStructure}`;
    try {
        const text = await callDoubaoTextAPI([{ role: "user", content: prompt }]);
        return text || "生成总结失败";
    } catch (e) {
        return "服务繁忙。";
    }
}
