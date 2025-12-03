
export type Step = 'dashboard' | 'setup' | 'round1' | 'round2' | 'round3' | 'summary' | 'completion';

export interface Persona {
  ageGroup: string;
  familyStructure: string;
  travelFrequency: string; // New field
  adKnowledge: string;
  adAcceptance: string; // New field
  emotionalNeeds: string[];
  socialNeeds: string[];
}

export interface GeneratedConfig {
  id: string;
  title: string;
  description: string;
}

export interface Round1Data {
  selectedKeywords: string[];
  generatedConfigs: GeneratedConfig[];
  selectedConfigIds: string[];
  comment: string;
}

export interface Round2Data {
  selectedKeywords: string[];
  generatedConfigs: GeneratedConfig[];
  selectedConfigIds: string[];
  comment: string;
}

export interface EvaluationAspect {
  liked: string;
  disliked: string;
}

export interface Evaluation {
  form: EvaluationAspect;
  proportion: EvaluationAspect;
  material: EvaluationAspect;
  color: EvaluationAspect;
}

export interface Round3Data {
  styleDescription: string;
  styleImageBase64: string | null;
  generatedImages: string[];
  selectedImageIndex: number | null;
  evaluation: Evaluation;
}

export interface Session {
  id: string;
  name: string;
  status: 'in-progress' | 'completed';
  createdAt: number;
  updatedAt: number;
  persona: Persona;
  round1: Round1Data;
  round2: Round2Data;
  round3: Round3Data;
  aiSummary: string;
}

export const INITIAL_PERSONA: Persona = {
  ageGroup: '',
  familyStructure: '',
  travelFrequency: '',
  adKnowledge: '',
  adAcceptance: '',
  emotionalNeeds: [],
  socialNeeds: []
};

export const INITIAL_ROUND1: Round1Data = {
  selectedKeywords: [],
  generatedConfigs: [],
  selectedConfigIds: [],
  comment: ''
};

export const INITIAL_ROUND2: Round2Data = {
  selectedKeywords: [],
  generatedConfigs: [],
  selectedConfigIds: [],
  comment: ''
};

export const INITIAL_ROUND3: Round3Data = {
  styleDescription: '',
  styleImageBase64: null,
  generatedImages: [],
  selectedImageIndex: null,
  evaluation: {
    form: { liked: '', disliked: '' },
    proportion: { liked: '', disliked: '' },
    material: { liked: '', disliked: '' },
    color: { liked: '', disliked: '' },
  }
};
