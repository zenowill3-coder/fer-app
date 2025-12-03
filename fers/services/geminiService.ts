import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域：获取豆包 (Doubao) 的 Key 和 Endpoint ID
// ============================================================
// 记得在 .env.local 中配置 VITE_DOUBAO_API_KEY 和 VITE_DOUBAO_ENDPOINT_ID
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const ENDPOINT_ID = import.meta.env.VITE_DOUBAO_ENDPOINT_ID;

// ============================================================
// 2. 核心工具：通用 API 调用函数 (适配火山引擎/豆包)
// ============================================================
async function callDoubaoAPI(messages: any[]) {
  // 豆包/火山引擎的标准兼容接口地址
  const url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  if (!API_KEY || !ENDPOINT_ID) {
    console.error("配置缺失: 请检查 .env.local 中是否填写了 VITE_DOUBAO_API_KEY 和 VITE_DOUBAO_ENDPOINT_ID");
    throw new Error("API Key 或 Endpoint ID 未配置");
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: ENDPOINT_ID, // 必须填入接入点 ID
        messages: messages,
        temperature: 0.7,   // 保持适度创意
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Doubao API Error Details:", errorText);
      throw new Error(`API 请求失败: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    // 返回 AI 的回复文本
    return data.choices[0].message.content;

  } catch (error) {
    console.error("调用豆包 API 发生错误:", error);
    throw error;
  }
}

// 辅助工具：清洗 JSON 字符串 (去除 markdown 标记，防止 AI 返回 ```json)
function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  // 移除 ```json, ``` 以及首尾空格
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ============================================================
// 3. 业务功能实现 (完全保留你原有的 Prompt 和逻辑)
// ============================================================

export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  // --- 这里的 Prompt 内容与你原文件完全一致 ---
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
    // 改为调用豆包 API
    const resultText = await callDoubaoAPI([
      { role: "system", content: "你是一个只输出 JSON 格式数据的助手，不要包含任何多余的解释文字。" },
      { role: "user", content: prompt }
    ]);

    // 解析 JSON
    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson || "[]");

    // 保留原有的 ID 生成逻辑
    return data.map((item: any, index: number) => ({
        ...item,
        id: `func-${Date.now()}-${index}`
    }));

  } catch (error) {
    console.error("Round 1 Generation Error:", error);
    // 保留原有的错误兜底数据
    return Array(6).fill(0).map((_, i) => ({
      id: `err-${i}`,
      title: "生成服务繁忙",
      description: "请稍后重试或检查网络连接。"
    }));
  }
};

export const generateInteractionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  // --- 这里的 Prompt 内容与你原文件完全一致 ---
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
    // 改为调用豆包 API
    const resultText = await callDoubaoAPI([
      { role: "system", content: "你是一个只输出 JSON 格式数据的助手。" },
      { role: "user", content: prompt }
    ]);

    // 解析 JSON
    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson || "[]");

    // 保留原有的 ID 生成逻辑
    return data.map((item: any, index: number) => ({
        ...item,
        id: `inter-${Date.now()}-${index}`
    }));

  } catch (error) {
    console.error("Round 2 Generation Error:", error);
    // 保留原有的错误兜底数据
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
  // ⚠️ 注意：此处已替换为“模拟生成”，为了确保国内访问不卡死。
  // 原有的 Google 生图代码已被移除，改为返回高质量占位图。
  
  console.log("正在请求图片生成 (Mock)...");
  
  // 模拟等待 1.5 秒，制造“正在思考”的体验
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 返回 3 张不同的科技感/汽车内饰风格图片 (Unsplash)
  return [
      "[https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80](https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80)",
      "[https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80](https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80)",
      "[https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80](https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80)"
  ];
};

export const generateSessionSummary = async (session: Session): Promise<string> => {
    
    // 构造上下文数据 (逻辑不变)
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

    // --- 这里的 Prompt 内容与你原文件完全一致 ---
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
        // 改为调用豆包 API
        const resultText = await callDoubaoAPI([
            { role: "user", content: prompt }
        ]);
        return resultText || "无法生成总结。";
    } catch (error) {
        console.error("Summary Error:", error);
        return "生成总结时发生错误，请稍后重试。";
    }
}
