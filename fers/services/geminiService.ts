import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;   // 用于对话 (Round 1 & 2)
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID; // 用于生图 (Round 3)

// ============================================================
// 2. 核心工具 A: 对话/文本推理 (Round 1 & 2)
// ============================================================
async function callDoubaoTextAPI(messages: any[]) {
  const url = "/api/doubao/v3/chat/completions";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
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
// 3. 核心工具 B: 图片生成 (支持图生图/垫图)
// ============================================================
async function callDoubaoImageAPI(prompt: string, imageBase64: string | null = null) {
  // 根据你的 curl 示例，豆包的多模态也是走 chat/completions 结构
  const url = "/api/doubao/v3/chat/completions"; 
  
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  // 1. 构造多模态内容数组 (Content Array)
  const contentParts: any[] = [
    { type: "text", text: prompt } // 放入提示词
  ];

  // 2. 如果有参考图，复刻 Gemini 的垫图逻辑
  if (imageBase64) {
    // 确保 Base64 格式正确 (Data URL)
    const formattedBase64 = imageBase64.startsWith("data:") 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;
      
    contentParts.push({
      type: "image_url",
      image_url: {
        url: formattedBase64 // 豆包接收 URL 或 Data URI
      }
    });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: IMAGE_MODEL_ID, // 使用生图模型 ID
        messages: [
          {
            role: "user",
            content: contentParts // 发送多模态内容
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("生图 API 报错:", err);
        return null;
    }
    
    const data = await response.json();
    
    // 解析返回结果：
    // 情况 A: 豆包返回的是文本 URL (Markdown 格式 ![image](url))
    // 情况 B: 豆包返回的是标准 image 对象
    // 这里做个兼容处理
    const content = data.choices?.[0]?.message?.content || "";
    
    // 尝试从文本中提取 URL (如果返回的是 Markdown)
    const urlMatch = content.match(/\((https?:\/\/.*?)\)/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    
    // 尝试直接获取 (如果模型直接返回 URL 字符串)
    if (content.startsWith("http")) return content;

    // 如果是标准 DALL-E 格式 (data[0].url)
    if (data.data?.[0]?.url) return data.data[0].url;

    // 如果都失败了，但在调试中
    console.log("原始返回内容:", content);
    return null;

  } catch (error) {
    console.error("生图网络请求失败:", error);
    return null;
  }
}

function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ============================================================
// 4. 业务功能：文字生成 (保持不变)
// ============================================================
export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const prompt = `
    你是一位资深的未来汽车用户体验研究专家。
    基于以下用户画像和感性需求，生成 6 个最具创新性的功能配置。
    【用户画像】家庭: ${persona.familyStructure}, 认知: ${persona.adKnowledge}
    【感性关键词】${selectedKeywords.join(', ')}
    【要求】输出纯 JSON 数组，包含 id, title, description。
  `;
  try {
    const resultText = await callDoubaoTextAPI([{ role: "system", content: "你是一个只输出 JSON 数组的助手。" }, { role: "user", content: prompt }]);
    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({ ...item, id: `func-${Date.now()}-${index}` })) : [];
  } catch (error) {
    return Array(6).fill(0).map((_, i) => ({ id: `err-${i}`, title: "生成失败", description: "请重试" }));
  }
};

export const generateInteractionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const prompt = `
    你是一位资深的未来汽车交互设计专家。
    基于关键词: ${selectedKeywords.join(', ')}，生成 6 个交互体验配置。
    【要求】输出纯 JSON 数组，包含 title 和 description。
  `;
  try {
    const resultText = await callDoubaoTextAPI([{ role: "system", content: "你是一个只输出 JSON 数组的助手。" }, { role: "user", content: prompt }]);
    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({ ...item, id: `inter-${Date.now()}-${index}` })) : [];
  } catch (error) { return []; }
};

// ============================================================
// 5. 业务功能：Round 3 生图 (中文Prompt + 垫图逻辑)
// ============================================================
export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  
  // 1. 数据准备
  const r1Selected = r1Data.generatedConfigs.filter(c => r1Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  const r2Selected = r2Data.generatedConfigs.filter(c => r2Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  
  // 2. 构建 Prompt (基于上一版效果很好的中文指令)
  const basePrompt = `
    设计一张未来自动驾驶汽车内饰的概念艺术图 (Concept Art)。
    
    【设计输入】
    - 目标用户: ${persona.familyStructure}
    - 风格描述: ${styleDesc} (请重点参考输入的参考图)
    - 情绪氛围: ${persona.emotionalNeeds.join(' ')}
    
    【重点可视化功能】
    ${r1Selected ? `- 智能座舱功能: ${r1Selected}` : ''}
    ${r2Selected ? `- 交互体验功能: ${r2Selected}` : ''}
    
    【关键构图设置 (必须严格执行)】
    1. 透视: 广角高角度镜头 / 顶视广角 (Wide-angle high-angle shot)。
    2. 角度: 从上方斜向下拍摄，提供内饰空间的宏观概览。
    3. 景深: 全景深（所有物体都清晰聚焦）。
    4. 内容限制: 仅展示内饰。不要渲染车身外壳。
    
    【视觉风格】
    - 2050年未来主义，科幻感，OC渲染。
    - 电影级布光，高对比度。
  `;

  console.log("正在请求豆包生成 3 张图片 (图生图模式)...");
  if (styleImageBase64) console.log(">> 已检测到参考图，将启用垫图逻辑");

  // 3. 并发生成 3 张
  const variations = [
      "变体A：强调温暖色调与舒适感",
      "变体B：强调冷色调与科技线条",
      "变体C：强调自然光感与通透性"
  ];

  try {
      // 这里的关键改变：将 styleImageBase64 传给 callDoubaoImageAPI
      const promises = variations.map(v => callDoubaoImageAPI(basePrompt + `\n(${v})`, styleImageBase64));
      
      const results = await Promise.all(promises);
      const validImages = results.filter(url => url !== null) as string[];

      // 4. 兜底逻辑
      const placeholders = [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
      ];

      let finalImages = [...validImages];
      let pIndex = 0;
      while (finalImages.length < 3) {
          finalImages.push(placeholders[pIndex % 3]);
          pIndex++;
      }
      return finalImages;

  } catch (error) {
    console.error("批量生图失败:", error);
    return [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
    ];
  }
};

export const generateSessionSummary = async (session: Session): Promise<string> => {
    // 保持原有逻辑
    const r1Choices = session.round1.generatedConfigs.filter(c => session.round1.selectedConfigIds.includes(c.id)).map(c => c.title).join('; ');
    const r2Choices = session.round2.generatedConfigs.filter(c => session.round2.selectedConfigIds.includes(c.id)).map(c => c.title).join('; ');
    const e = session.round3.evaluation;
    const evaluationText = `形态:${e.form.liked}, 比例:${e.proportion.liked}, 材质:${e.material.liked}, 色彩:${e.color.liked}`;
    
    const prompt = `请为本次未来汽车体验研究 Session 撰写一份300字总结。用户:${session.persona.familyStructure}, 需求:${session.persona.emotionalNeeds}。功能:${r1Choices}。交互:${r2Choices}。评价:${evaluationText}。`;
    try {
        const text = await callDoubaoTextAPI([{ role: "user", content: prompt }]);
        return text || "生成总结失败";
    } catch (e) { return "服务繁忙。"; }
}
