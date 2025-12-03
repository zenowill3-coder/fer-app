import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID;

// ============================================================
// 🆕 图片压缩工具
// ============================================================
async function compressImage(base64Str: string, maxWidth = 800, quality = 0.5): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    // 兼容带头和不带头的输入
    img.src = base64Str.startsWith('data:') ? base64Str : `data:image/jpeg;base64,${base64Str}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64Str); return; }
      ctx.drawImage(img, 0, 0, width, height);
      // 返回完整的 Data URL (包含 data:image/jpeg;base64,...)
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
}

// ============================================================
// 2. 核心工具 A: 对话 (Text)
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
// 3. 核心工具 B: 生图 (DataURI 修复)
// ============================================================
async function callDoubaoImageAPI(prompt: string, compressedBase64: string | null = null) {
  const url = "/api/doubao/v3/images/generations";
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  const requestBody: any = {
    model: IMAGE_MODEL_ID,
    prompt: prompt,
    size: "1024*1024",
    sequential_image_generation: "auto"
  };

  if (compressedBase64) {
    // 🛠️ 【关键修复】: 不要去掉头部！
    // 豆包报错 "invalid url" 说明它需要 Data URI 格式 (data:image/jpeg;base64,...)
    // 或者标准的 http 链接。compressedBase64 本身就是完整的 Data URL。
    requestBody.image = compressedBase64;
    
    //
