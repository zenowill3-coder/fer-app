import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const ENDPOINT_ID = import.meta.env.VITE_DOUBAO_ENDPOINT_ID;

// ============================================================
// 2. 核心工具：通过 Vercel 代理调用豆包
// ============================================================
async function callDoubaoAPI(messages: any[]) {
  // 注意：这里改成了 /api/doubao/ 开头，配合 vercel.json 解决跨域问题
  const url = "/api/doubao/v3/chat/completions";

  if (!API_KEY || !ENDPOINT_ID) {
    console.error("配置缺失: 请检查环境变量 VITE_DOUBAO_API_KEY 和 VITE_DOUBAO_ENDPOINT_ID");
    throw new Error("API Key 未配置");
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: ENDPOINT_ID,
        messages: messages,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      // 尝试读取错误信息
      const errorText = await response.text();
      console.error(`API请求失败 [${response.status}]:`, errorText);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error("调用豆包 API 出错:", error);
    throw error;
  }
}

// 辅助：清洗 JSON，防止 AI 返回 Markdown 格式
function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  // 去除 ```json ... ``` 包裹
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ============================================================
// 3. 业务功能 (保留你的 Prompt)
// ============================================================

export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
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
       - 标题 (title): 不超过10个字。
       - 说明 (description): 不超过20个字。
    3. 输出必须是纯 JSON 数组格式 (Array)。
  `;

  try {
    const resultText = await callDoubaoAPI([
      { role: "system", content: "你是一个只输出 JSON 数组的助手，不要包含任何解释文字。" },
      { role: "user", content: prompt }
    ]);

    const cleanJson = cleanJsonResult(resultText);
    
    // 增加一步检查，防止解析报错
    let data;
    try {
        data = JSON.parse(cleanJson);
    } catch (e) {
        console.error("JSON 解析失败，AI 返回了:", resultText);
        throw new Error("AI 返回格式错误");
    }

    // 确保返回的是数组
    if (!Array.isArray(data)) {
        // 如果 AI 返回了 { "configs": [...] } 这种包裹格式，尝试提取
        if (data.configs && Array.isArray(data.configs)) return data.configs.map(mapId);
        if (data.items && Array.isArray(data.items)) return data.items.map(mapId);
        throw new Error("AI 返回的不是数组格式");
    }

    return data.map(mapId);

  } catch (error) {
    console.error("Round 1 Error:", error);
    // 返回兜底数据，保证界面不白屏
    return Array(6).fill(0).map((_, i) => ({
      id: `err-${i}`,
      title: "生成服务繁忙",
      description: "请稍后重试或检查网络。"
    }));
  }
};

// 辅助 ID 生成
const mapId = (item: any, index: number) => ({
    ...item,
    id: `func-${Date.now()}-${index}`
});


export const generateInteractionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
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
    2. 输出必须是纯 JSON 数组格式。
    3. 包含 title 和 description。
  `;

  try {
    const resultText = await callDoubaoAPI([
      { role: "system", content: "你是一个只输出 JSON 数组的助手。" },
      { role: "user", content: prompt }
    ]);

    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    
    if (!Array.isArray(data)) throw new Error("Not an array");
    
    return data.map((item: any, index: number) => ({
        ...item,
        id: `inter-${Date.now()}-${index}`
    }));

  } catch (error) {
    console.error("Round 2 Error:", error);
    return Array(6).fill(0).map((_, i) => ({
      id: `err-${i}`,
      title: "生成服务繁忙",
      description: "请稍后重试。"
    }));
  }
};

// 生图功能：使用高质量占位图，避免卡死
export const generateInteriorConcepts = async (
  persona: Persona, r1: any, r2: any, style: string, img: any
): Promise<string[]> => {
  await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟思考
  return [
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
  ];
};

export const generateSessionSummary = async (session: Session): Promise<string> => {
    const prompt = `请为本次未来汽车体验研究 Session 撰写一份简短总结(300字以内)。用户画像: ${session.persona.familyStructure}`;
    try {
        const text = await callDoubaoAPI([{ role: "user", content: prompt }]);
        return text || "生成总结失败";
    } catch (e) {
        return "服务繁忙，无法生成总结。";
    }
}
