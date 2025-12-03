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
        size: "1024x1024"
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("生图 API 报错:", err);
        return null;
    }
    
    const data = await response.json();
    // 兼容豆包/OpenAI 返回格式
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
// 4. 业务功能：Round 1 & 2 (文字生成)
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
// 5. 业务功能：Round 3 生图 (已深度适配中文/豆包逻辑)
// ============================================================

export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  
  // 1. 数据准备 (将用户选的配置合并为字符串)
  const r1Selected = r1Data.generatedConfigs
    .filter(c => r1Data.selectedConfigIds.includes(c.id))
    .map(c => c.title)
    .join('、'); // 改为中文顿号连接

  const r2Selected = r2Data.generatedConfigs
    .filter(c => r2Data.selectedConfigIds.includes(c.id))
    .map(c => c.title)
    .join('、');

  // 2. 构建中文 Prompt (专为豆包优化)
  // 我们将之前的英文技术参数翻译成了更符合国内生图模型理解的中文术语
  const basePrompt = `
    设计一张未来自动驾驶汽车的内饰概念图 (Concept Art)。
    
    【核心参数】
    - 目标用户: ${persona.familyStructure}
    - 用户接受度: ${persona.adAcceptance}
    - 整体氛围: ${persona.emotionalNeeds.join(' ')}
    - 风格描述: ${styleDesc}
    
    【重点展示功能】
    - 智能座舱功能: ${r1Selected}
    - 交互体验亮点: ${r2Selected}
    
    【画面构图要求 (必须严格执行)】
    1. 视角: 广角俯视镜头 (Wide-angle high-angle shot)。
    2. 机位: 从车内右后方上方俯拍，能够看清前排仪表台、座椅布局以及整个内饰空间关系。
    3. 景深: 全景深，前后景都清晰 (Full depth of field)。
    4. 构图内容: 仅展示汽车内饰，不要出现车身外观、轮子或街道背景。窗外使用抽象的柔和光影或渐变色，不要具体的城市建筑。
    
    【视觉风格】
    - 极高画质，8k分辨率，真实感渲染 (Photorealistic)。
    - 未来感，科技感，电影级布光 (Cinematic lighting)。
    - 16:9 画幅。
  `;

  console.log("正在请求豆包生成 3 张图片 (中文Prompt模式)...");

  // 3. 并发生成 3 张 (使用中文描述差异化)
  const variations = [
      "变体1：强调温暖舒适的居家氛围灯光",
      "变体2：强调极简干净的科技感线条",
      "变体3：强调通透宽敞的自然光感"
  ];

  try {
      // 同时发起 3 个请求
      const promises = variations.map(v => callDoubaoImageAPI(basePrompt + `\n(${v})`));
      
      const results = await Promise.all(promises);
      
      // 过滤掉失败的
      const validImages = results.filter(url => url !== null) as string[];

      // 4. 兜底补齐逻辑
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
    // 数据处理保持不变
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
