import { useState, useEffect } from 'react';
import { aiConfigsApi, AIProvider } from '../api/ai-config';
import { invoke } from '@tauri-apps/api/core';
import { Check, Plus, Trash2, Settings, Eye, EyeOff, Zap, Bot, ChevronDown, Pencil, X, Loader2, CheckCircle2, XCircle, FileText, Save, Globe, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Protocol metadata ───

const protocolMeta: Record<AIProvider, { label: string; color: string; gradient: string; desc: string }> = {
  openai_compatible: {
    label: 'OpenAI 兼容',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    desc: '端点: /chat/completions · 认证: Bearer Token',
  },
  anthropic_compatible: {
    label: 'Anthropic 兼容',
    color: '#c96442',
    gradient: 'linear-gradient(135deg, #c96442 0%, #a84f34 100%)',
    desc: '端点: /messages · 认证: x-api-key',
  },
};

// ─── Quick-fill endpoint presets ───

const endpointPresets: { label: string; url: string; protocol: AIProvider }[] = [
  { label: 'OpenAI', url: 'https://api.openai.com/v1', protocol: 'openai_compatible' },
  { label: 'Anthropic', url: 'https://api.anthropic.com/v1', protocol: 'anthropic_compatible' },
  { label: '火山引擎', url: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai_compatible' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', protocol: 'openai_compatible' },
  { label: '智谱 AI', url: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai_compatible' },
  { label: '月之暗面', url: 'https://api.moonshot.cn/v1', protocol: 'openai_compatible' },
  { label: '豆包', url: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai_compatible' },
  { label: 'MiniMax', url: 'https://api.minimax.chat/v1', protocol: 'openai_compatible' },
];

// ─── Types ───

interface EditFormData {
  id?: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  multimodalModel: string;
  isEdit: boolean;
}

interface MinerUSettings {
  apiKey: string;
  modelVersion: string;
}

export function AISettings() {
  const [tab, setTab] = useState<'llm' | 'ocr'>('llm');
  const [configs, setConfigs] = useState<Awaited<ReturnType<typeof aiConfigsApi.getAll>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<EditFormData>({
    name: '',
    provider: 'openai_compatible',
    apiKey: '',
    baseUrl: '',
    model: '',
    multimodalModel: '',
    isEdit: false,
  });

  // MinerU Settings
  const [mineruSettings, setMineruSettings] = useState<MinerUSettings>({
    apiKey: '',
    modelVersion: 'vlm',
  });
  const [mineruSaved, setMineruSaved] = useState(false);
  const [mineruTesting, setMineruTesting] = useState(false);
  const [mineruTestResult, setMineruTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showMineruKey, setShowMineruKey] = useState(false);

  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    aiConfigsApi.getAll().then(setConfigs).catch(console.error);
    loadMineruSettings();
  }, []);

  const loadMineruSettings = async () => {
    try {
      const saved = await invoke<string | null>('mineru_get_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setMineruSettings({
          apiKey: parsed.api_key || '',
          modelVersion: parsed.model_version || 'vlm',
        });
      }
    } catch (err) {
      console.error('Failed to load MinerU settings:', err);
    }
  };

  const saveMineruSettings = async () => {
    try {
      await invoke('mineru_save_settings', {
        settings: JSON.stringify({
          api_key: mineruSettings.apiKey,
          model_version: mineruSettings.modelVersion,
        }),
      });
      setMineruSaved(true);
      setTimeout(() => setMineruSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save MinerU settings:', err);
      alert('保存失败: ' + (err instanceof Error ? err.message : err));
    }
  };

  const testMineruConnection = async () => {
    if (!mineruSettings.apiKey) {
      setMineruTestResult({ success: false, message: '请先输入 API Key' });
      return;
    }
    setMineruTesting(true);
    setMineruTestResult(null);
    try {
      const result = await invoke<string>('mineru_test', { apiToken: mineruSettings.apiKey });
      setMineruTestResult({ success: true, message: result });
    } catch (err) {
      setMineruTestResult({ success: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setMineruTesting(false);
    }
  };

  // ─── Protocol selector options ───

  const protocolOptions = [
    { value: 'openai_compatible' as const, label: 'OpenAI 兼容协议', desc: '/chat/completions · Bearer Token' },
    { value: 'anthropic_compatible' as const, label: 'Anthropic 兼容协议', desc: '/messages · x-api-key' },
  ];

  const handleProtocolChange = (protocol: AIProvider) => {
    const filteredPresets = endpointPresets.filter(p => p.protocol === protocol);
    const defaultUrl = filteredPresets.length > 0 ? filteredPresets[0].url : '';
    setFormData({ ...formData, provider: protocol, baseUrl: formData.baseUrl || defaultUrl });
  };

  const handleEdit = (config: typeof configs[0]) => {
    setFormData({
      id: config.id,
      name: config.name,
      provider: config.provider as AIProvider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || '',
      model: config.model,
      multimodalModel: config.multimodalModel || '',
      isEdit: true,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      name: '',
      provider: 'openai_compatible',
      apiKey: '',
      baseUrl: '',
      model: '',
      multimodalModel: '',
      isEdit: false,
    });
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.isEdit && formData.id) {
        await aiConfigsApi.update(formData.id, {
          name: formData.name,
          provider: formData.provider,
          apiKey: formData.apiKey,
          baseUrl: formData.baseUrl || undefined,
          model: formData.model,
          multimodalModel: formData.multimodalModel || undefined,
        });
      } else {
        await aiConfigsApi.create({ ...formData, isActive: configs.length === 0 });
      }
      setConfigs(await aiConfigsApi.getAll());
      handleCancelEdit();
    } catch (err) {
      console.error('Save failed:', err);
      alert(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const result = await aiConfigsApi.test(id);
      setTestResult({ id, success: result.success, message: result.message });
    } catch (err) {
      setTestResult({ id, success: false, message: err instanceof Error ? err.message : '测试失败' });
    } finally {
      setTesting(null);
    }
  };

  const handleSetActive = async (id: string) => {
    await aiConfigsApi.activate(id);
    setConfigs(await aiConfigsApi.getAll());
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定删除此配置吗？')) {
      await aiConfigsApi.delete(id);
      setConfigs(await aiConfigsApi.getAll());
    }
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '•••••••••';
    return key.slice(0, 4) + '•••••••••' + key.slice(-4);
  };

  const maskMineruKey = (key: string) => {
    if (key.length <= 8) return '•••••••••';
    return key.slice(0, 6) + '•••••' + key.slice(-4);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[30px] font-semibold tracking-tight mb-1">AI 配置</h1>
        <p className="text-gray-500 text-[14px]">基于协议类型对接 AI 服务，支持任何兼容 OpenAI / Anthropic 协议的模型</p>
      </motion.div>

      {/* Tabs: 语言模型 / OCR 模型 */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          { key: 'llm', label: '语言模型', Icon: Bot },
          { key: 'ocr', label: 'OCR 模型', Icon: FileText },
        ] as const).map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                active ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
      {tab === 'llm' && (
        <motion.div key="llm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
      {/* Protocol Cards — Two protocol options */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {protocolOptions.map((p) => {
          const meta = protocolMeta[p.value];
          const hasConfig = configs.some(c => c.provider === p.value);
          const isActive = configs.some(c => c.provider === p.value && c.isActive);
          return (
            <div
              key={p.value}
              className={`relative p-4 rounded-2xl border transition-all cursor-default ${
                isActive
                  ? 'border-blue-300 bg-blue-50/50 shadow-sm'
                  : hasConfig
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: meta.gradient }}>
                  <Bot className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{p.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">{p.desc}</div>
                </div>
              </div>
              {isActive && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
              )}
              {hasConfig && !isActive && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400" />
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Config List */}
      <div className="space-y-3">
        <AnimatePresence>
          {configs.map((config, idx) => {
            const meta = protocolMeta[config.provider as AIProvider] || protocolMeta.openai_compatible;
            const currentTestResult = testResult?.id === config.id ? testResult : null;
            return (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className={`relative overflow-hidden bg-white rounded-2xl border transition-all ${
                  config.isActive
                    ? 'border-blue-300 shadow-lg shadow-blue-50'
                    : 'border-black/5 hover:border-black/10'
                }`}
              >
                {config.isActive && (
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: meta.gradient }} />
                )}
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: meta.gradient }}>
                      <Bot className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-2">
                        <h3 className="text-[16px] font-semibold">{config.name}</h3>
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium" style={{ background: `${meta.color}15`, color: meta.color }}>
                          {meta.label}
                        </span>
                        {config.isActive && (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium border border-blue-200">
                            <Check className="w-3 h-3" />
                            当前使用
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">模型</span>
                          <span className="text-gray-700 font-medium">{config.model}</span>
                        </div>
                        {config.multimodalModel && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">多模态</span>
                            <span className="text-gray-700 font-medium">{config.multimodalModel}</span>
                          </div>
                        )}
                        {config.baseUrl && (
                          <div className="flex items-center gap-2 col-span-2">
                            <span className="text-gray-400">端点</span>
                            <span className="text-gray-700 truncate max-w-xs">{config.baseUrl}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 col-span-2">
                          <span className="text-gray-400">API Key</span>
                          <code className="text-gray-700 font-mono text-[12px]">
                            {showApiKey[config.id] ? config.apiKey : maskApiKey(config.apiKey)}
                          </code>
                          <button onClick={() => toggleShowApiKey(config.id)} className="text-gray-300 hover:text-gray-500 transition-colors">
                            {showApiKey[config.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Test Result */}
                      {currentTestResult && (
                        <div className={`mt-3 p-3 rounded-xl text-[13px] ${currentTestResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                          <div className="flex items-center gap-2">
                            {currentTestResult.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span>{currentTestResult.message}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Test Button */}
                      <button
                        onClick={() => handleTest(config.id)}
                        disabled={testing === config.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium text-purple-600 hover:bg-purple-50 transition-all border border-purple-100 hover:border-purple-200"
                        title="测试连接"
                      >
                        {testing === config.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        测试
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => handleEdit(config)}
                        className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                        title="编辑配置"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {!config.isActive && (
                        <button
                          onClick={() => handleSetActive(config.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-medium text-blue-600 hover:bg-blue-50 transition-all border border-blue-100 hover:border-blue-200"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          启用
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence mode="wait">
        {!showForm ? (
          <motion.button
            key="add-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[14px] font-medium">添加新 AI 配置</span>
          </motion.button>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-white rounded-2xl border border-black/5 overflow-hidden"
          >
            <div className="px-6 pt-5 pb-4 border-b border-gray-50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}>
                <Settings className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-[16px] font-semibold">{formData.isEdit ? '编辑 AI 配置' : '新增 AI 配置'}</h2>
              <button onClick={handleCancelEdit} className="ml-auto text-gray-400 hover:text-gray-600 transition-colors text-[13px]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">配置名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：我的工作配置"
                  className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">协议类型</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {protocolOptions.map((option) => {
                    const isSelected = formData.provider === option.value;
                    const meta = protocolMeta[option.value];
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={formData.isEdit}
                        onClick={() => handleProtocolChange(option.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left disabled:opacity-50 ${
                          isSelected
                            ? 'border-blue-400 bg-blue-50/50 shadow-sm'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: meta.gradient }}
                        >
                          <Globe className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold">{option.label}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{option.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    模型名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="如：gpt-4o / deepseek-chat / claude-sonnet-4-6"
                    className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">多模态模型（可选）</label>
                  <input
                    type="text"
                    value={formData.multimodalModel}
                    onChange={(e) => setFormData({ ...formData, multimodalModel: e.target.value })}
                    placeholder="用于图片/PDF解析"
                    className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  API 端点 <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px]"
                  required
                />
                {/* Quick-fill presets */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-gray-400 mr-1 leading-7">快速填充:</span>
                  {endpointPresets
                    .filter(p => p.protocol === formData.provider)
                    .map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setFormData({ ...formData, baseUrl: p.url })}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all ${
                          formData.baseUrl === p.url
                            ? 'border-blue-300 bg-blue-50 text-blue-600'
                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-200 hover:text-gray-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                </div>
                <p className="mt-1 text-[12px] text-gray-400">协议类型切换后，快速填充选项会自动更新</p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  API Key <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-... 或 API Key"
                  className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px] font-mono"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-[14px] font-medium shadow-sm hover:shadow hover:-translate-y-0.5 transition-all"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}
                >
                  <Check className="w-4 h-4" />
                  保存配置
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-3 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all text-[14px]"
                >
                  取消
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
        </motion.div>
      )}
      {tab === 'ocr' && (
        <motion.div key="ocr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
      {/* MinerU Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-black/5 overflow-hidden"
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold">MinerU 文档解析</h2>
            <p className="text-[12px] text-gray-400">用于图片/PDF 中的 JD 文本提取</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">API Key</label>
              <div className="relative">
                <input
                  type={showMineruKey ? 'text' : 'password'}
                  value={mineruSettings.apiKey}
                  onChange={(e) => setMineruSettings({ ...mineruSettings, apiKey: e.target.value })}
                  placeholder="Bearer Token from MinerU dashboard"
                  className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px] font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowMineruKey(!showMineruKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showMineruKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[12px] text-gray-400">从 MinerU 官网申请 API Token</p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">模型版本</label>
              <div className="relative">
                <select
                  value={mineruSettings.modelVersion}
                  onChange={(e) => setMineruSettings({ ...mineruSettings, modelVersion: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px] appearance-none"
                >
                  <option value="vlm">vlm（推荐，更高精度）</option>
                  <option value="pipeline">pipeline（快速轻量）</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <p className="mt-1.5 text-[12px] text-gray-400">vlm 精度更高，pipeline 速度更快</p>
            </div>
          </div>

          {/* Test Result */}
          {mineruTestResult && (
            <div className={`p-3 rounded-xl text-[13px] ${mineruTestResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {mineruTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span>{mineruTestResult.message}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={testMineruConnection}
              disabled={mineruTesting || !mineruSettings.apiKey}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-purple-600 hover:bg-purple-50 transition-all border border-purple-100 hover:border-purple-200 disabled:opacity-50"
            >
              {mineruTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              测试连接
            </button>

            <button
              onClick={saveMineruSettings}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
              style={{ background: mineruSaved ? '#10b981' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}
            >
              {mineruSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存设置
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Notice */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(99,102,241,0.05) 100%)', border: '1px solid rgba(99,102,241,0.12)' }}
      >
        <h3 className="text-[13px] font-semibold text-gray-700 mb-3">安全说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: '🔒', text: 'API Key 仅本地存储，不上传服务器' },
            { icon: '⚡', text: '同时只能启用一个 AI 配置，切换立即生效' },
            { icon: '🌐', text: '支持任何兼容 OpenAI/Anthropic 协议的模型服务' },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-2.5">
              <span className="text-[15px]">{item.icon}</span>
              <span className="text-[12px] text-gray-600">{item.text}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
