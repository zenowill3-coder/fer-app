export const EMOTIONAL_NEEDS = ['兴奋', '欣喜', '快乐', '满足', '安心', '放松', '信任'];
export const SOCIAL_NEEDS = ['身份认同', '个性表达', '群体归属', '社会尊重', '自信', '天然无修饰', '手工匠心'];

export const R1_KEYWORDS = ['安全', '舒适', '稳定', '灵活', '趣味', '自由', '省心', '贴心'];

export interface R2Keyword {
  label: string;
  subtext: string;
}

export interface R2Category {
  title: string;
  keywords: R2Keyword[];
}

export const FAMILY_STRUCTURE_OPTIONS = [
  { label: '未婚人群（大致年龄20-30）', ageGroup: '20-30', structure: '未婚人群' },
  { label: '年轻小家庭2+1儿童（大致年龄30-40）', ageGroup: '30-40', structure: '年轻小家庭(2+1)' },
  { label: '扩展家庭3+2老人（大致年龄40-50）', ageGroup: '40-50', structure: '扩展家庭(3+2)' },
  { label: '新老年人（大致年龄50-60）', ageGroup: '50-60', structure: '新老年人' },
];

export const TRAVEL_FREQUENCY_OPTIONS = [
  '低（每周出行频率次数少）',
  '中（每周有一定次数的出行）',
  '高（几乎每天都有出行）'
];

// 界面文案配置
export const UI_TEXT = {
  personaTitle: "为了更精准地生成“未来感”体验，请先定义目标用户的基本属性与深层需求。",
  emotionalNeedsLabel: "在“未来感”SUV中，你希望获得哪些情绪体验？（多选）",
  socialNeedsLabel: "在“未来感”SUV中，在社会意义方面，你希望带来怎样的价值？"
};

// 兜底图片
export const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80";

export const R2_CATEGORIES: R2Category[] = [
  {
    title: '未来反馈体验',
    keywords: [
      { label: '即时', subtext: '操作后立即反馈' },
      { label: '温和', subtext: '反馈柔和不突兀' },
      { label: '多模态', subtext: '声光触协同提示' },
      { label: '细腻', subtext: '反馈精细更柔和' },
    ],
  },
  {
    title: '隐私与边界体验',
    keywords: [
      { label: '包裹', subtext: '空间围合提升安全感' },
      { label: '隔绝', subtext: '减少外界干扰刺激' },
      { label: '半开放', subtext: '隐私与开放的平衡' },
      { label: '柔性边界', subtext: '灯光结构构成可变边界' },
    ],
  },
  {
    title: '情境与模式体验',
    keywords: [
      { label: '沉浸', subtext: '空间完全沉入情境' },
      { label: '情境切换', subtext: '空间适应多生活场景' },
      { label: '模式转场', subtext: '休息办公观影自由切换' },
      { label: '环境联动', subtext: '光/香/座椅联动变化' },
    ],
  },
  {
    title: '预见与自适应体验',
    keywords: [
      { label: '预见性', subtext: '提前判断用户需求' },
      { label: '自适应', subtext: '交互自动调整方式' },
      { label: '主动引导', subtext: '主动提示下一步动作' },
      { label: '透明决策', subtext: '解释系统的决策逻辑' },
      { label: '不干扰', subtext: '只在必要时触达' },
      { label: '包容性', subtext: '适应不同用户能力' },
    ],
  },
];
