import { invoke } from '@tauri-apps/api/core';

export type PreferenceLevel = 'high' | 'medium' | 'low' | 'none';
export type ApplicationStatus =
  | 'not_applied'
  | 'applied'
  | 'resume_rejected'
  | 'interviewing'
  | 'offer'
  | 'withdrawn'
  | 'eliminated';
export type RecruitmentStatus = 'active' | 'paused' | 'closed';

export interface ParsedResponsibility {
  text: string;
  category: string;
  importance: string;
}

export interface ParsedRequirement {
  text: string;
  type: string;
  importance: number;
}

export interface ParsedKeyword {
  name: string;
  level?: string;
  importance: number;
}

export interface ParsedContent {
  responsibilities: ParsedResponsibility[];
  requirements: ParsedRequirement[];
}

export interface Keywords {
  tech: ParsedKeyword[];
  skills: ParsedKeyword[];
  softSkills: ParsedKeyword[];
}

export interface RoleAnalysis {
  roleType: string;
  seniority: string;
  focusAreas: string[];
  typicalInterviewRounds: string[];
}

export interface InterviewQuestion {
  question: string;
  type: string;
  difficulty: string;
  guidance: {
    考察点: string;
    回答策略: string;
    参考答案: string;
    应答重点: string;
  };
}

export interface InterviewInsights {
  highFrequencyTopics: string[];
  potentialQuestions: Array<{
    question: string;
    type: string;
    difficulty: string;
  }>;
}

export interface PreparationItem {
  topic: string;
  reason: string;
  action: string;
}

export interface PreparationGuide {
  priorityPreparation: PreparationItem[];
  projectPreparation: string[];
  resumeOptimization: string[];
}

export type RoundStatus = 'pending' | 'awaiting_result' | 'passed' | 'failed';

export interface RoundQuestion {
  question: string;
  answer?: string;
}

export interface InterviewRound {
  id: string;
  name: string;
  date?: string;
  status: RoundStatus;
  questions: RoundQuestion[];
  feedback?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  salary?: string;
  location?: string;
  companyAddress?: string;
  experience?: string;
  education?: string;
  companySize?: string;
  sourceUrl?: string;
  sourceText?: string;
  jdRawContent: string;
  jdParsedContent?: string;
  keywords?: string;
  preferenceLevel: PreferenceLevel;
  applicationStatus: ApplicationStatus;
  recruitmentStatus: RecruitmentStatus;
  interviewDate?: string;
  interviewFeedback?: string;
  interviewQuestions?: string;
  interviewRounds?: string;
  notes?: string;
  aiInterviewGuide?: string;
  roleAnalysis?: string;
  interviewInsights?: string;
  preparationGuide?: string;
  jdImages?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  title?: string;
  company?: string;
  salary?: string;
  location?: string;
  companyAddress?: string;
  experience?: string;
  education?: string;
  companySize?: string;
  sourceUrl?: string;
  sourceText?: string;
  jdRawContent: string;
  skipParsing?: boolean;
}

export interface UpdateJobInput {
  title?: string;
  company?: string;
  salary?: string;
  location?: string;
  companyAddress?: string;
  experience?: string;
  education?: string;
  companySize?: string;
  sourceUrl?: string;
  sourceText?: string;
  preferenceLevel?: PreferenceLevel;
  applicationStatus?: ApplicationStatus;
  recruitmentStatus?: RecruitmentStatus;
  interviewDate?: string;
  interviewFeedback?: string;
  notes?: string;
  jdParsedContent?: string;
  keywords?: string;
  interviewQuestions?: string;
  interviewRounds?: InterviewRound[];
  aiInterviewGuide?: string;
  roleAnalysis?: string;
  interviewInsights?: string;
  preparationGuide?: string;
  jdImages?: string[];
}

function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const jobsApi = {
  getAll: async (params?: {
    status?: ApplicationStatus;
    preference?: PreferenceLevel;
    search?: string;
    sort?: 'createdAt' | 'interviewDate' | 'preference';
    city?: string;
  }): Promise<Job[]> => {
    return invoke<Job[]>('jobs_list', { params: params || {} });
  },

  getById: async (id: string): Promise<Job> => {
    return invoke<Job>('job_get', { id });
  },

  create: async (input: CreateJobInput): Promise<Job> => {
    return invoke<Job>('job_create', { input });
  },

  reparse: async (id: string): Promise<Job> => {
    return invoke<Job>('job_reparse', { id });
  },

  generateInterviewQuestions: async (id: string): Promise<Job> => {
    return invoke<Job>('job_generate_interview_questions', { id });
  },

  update: async (id: string, input: UpdateJobInput): Promise<Job> => {
    return invoke<Job>('job_update', { id, input });
  },

  delete: async (id: string): Promise<void> => {
    return invoke<void>('job_delete', { id });
  },

  parseJd: {
    parsedContent: (job: Job): ParsedContent => parseJsonField(job.jdParsedContent, { responsibilities: [], requirements: [] }),
    keywords: (job: Job): Keywords => parseJsonField(job.keywords, { tech: [], skills: [], softSkills: [] }),
  },
};

export const scrapeApi = {
  scrape: async (url: string): Promise<{ content: string; source?: string }> => {
    return invoke<{ content: string; source?: string }>('scrape_url', { url });
  },

  scrapeImage: async (fileBase64: string, filename: string): Promise<string> => {
    return invoke<string>('scrape_image', { fileBase64, filename });
  },

  mineruParse: async (fileBase64: string, filename: string, apiToken?: string): Promise<string> => {
    return invoke<string>('mineru_parse', { fileBase64, filename, apiToken });
  },
};