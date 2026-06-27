import { invoke } from '@tauri-apps/api/core';

export type AIProvider = 'openai_compatible' | 'anthropic_compatible';

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  multimodalModel?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateConfigInput {
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  multimodalModel?: string;
  isActive?: boolean;
}

export interface UpdateConfigInput {
  name?: string;
  provider?: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  multimodalModel?: string;
  isActive?: boolean;
}

export const aiConfigsApi = {
  getAll: async (): Promise<AIProviderConfig[]> => {
    return invoke<AIProviderConfig[]>('ai_config_list');
  },

  getActive: async (): Promise<AIProviderConfig | null> => {
    return invoke<AIProviderConfig | null>('ai_config_get_active');
  },

  create: async (input: CreateConfigInput): Promise<AIProviderConfig> => {
    return invoke<AIProviderConfig>('ai_config_create', { input });
  },

  update: async (id: string, input: UpdateConfigInput): Promise<AIProviderConfig> => {
    return invoke<AIProviderConfig>('ai_config_update', { id, input });
  },

  activate: async (id: string): Promise<AIProviderConfig> => {
    return invoke<AIProviderConfig>('ai_config_activate', { id });
  },

  delete: async (id: string): Promise<void> => {
    return invoke<void>('ai_config_delete', { id });
  },

  test: async (id: string): Promise<{ success: boolean; message: string }> => {
    return invoke<{ success: boolean; message: string }>('ai_config_test', { id });
  },
};