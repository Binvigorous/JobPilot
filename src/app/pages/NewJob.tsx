import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { jobsApi, scrapeApi } from '../api/jobs';
import { aiConfigsApi } from '../api/ai-config';
import { ArrowLeft, Link as LinkIcon, FileText, Sparkles, Loader2, CheckCircle, Image, FileUp, X, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AIProviderConfig } from '../api/ai-config';

type InputMode = 'link' | 'text' | 'image';
type Step = 'input' | 'preview' | 'confirm' | 'parsing' | 'done';

export function NewJob() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<InputMode>('link');
  const [url, setUrl] = useState('');
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('input');

  // Scraped/editted content for preview
  const [scrapedContent, setScrapedContent] = useState('');

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Active AI config
  const [activeConfig, setActiveConfig] = useState<AIProviderConfig | null>(null);

  // Load active AI config when entering confirm step
  const loadActiveConfig = async () => {
    try {
      const config = await aiConfigsApi.getActive();
      setActiveConfig(config);
    } catch {
      setActiveConfig(null);
    }
  };

  // 处理文件：设置预览和文件状态
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('请上传图片或 PDF 文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.onloadend = () => {
      setImageFile(file);
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  // 处理粘贴事件
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (mode !== 'image') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            e.preventDefault();
            return;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [mode]);

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode === 'image') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当离开 drop zone 本身时才取消
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (mode !== 'image') return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNextFromInput = async () => {
    setError('');

    if (mode === 'link') {
      if (!url.trim()) {
        setError('请输入岗位链接');
        return;
      }
      setLoading(true);
      try {
        const result = await scrapeApi.scrape(url);
        setScrapedContent(result.content);
        await loadActiveConfig();
        setStep('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : '爬取失败，请检查链接或尝试其他方式');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'text') {
      if (!jdText.trim()) {
        setError('请输入职位描述');
        return;
      }
      setScrapedContent(jdText);
      await loadActiveConfig();
      setStep('preview');
    } else if (mode === 'image') {
      if (!imageFile) {
        setError('请上传图片');
        return;
      }
      setImageLoading(true);
      try {
        const base64 = await fileToBase64(imageFile);
        const text = await scrapeApi.mineruParse(base64, imageFile.name);
        setScrapedContent(text);
        await loadActiveConfig();
        setStep('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : '图片解析失败，请尝试更清晰的图片');
      } finally {
        setImageLoading(false);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  const handleConfirmAndParse = async () => {
    setError('');
    setLoading(true);
    setStep('parsing');

    try {
      const newJob = await jobsApi.create({
        jdRawContent: scrapedContent,
        sourceUrl: mode === 'link' ? url : undefined,
        sourceText: mode === 'text' ? jdText : (mode === 'image' ? '[图片解析]' : undefined),
      });

      // 图片模式：把上传的原始截图一并存进岗位（JD 原图）
      if (mode === 'image' && imageFile?.type.startsWith('image/') && imagePreview) {
        try { await jobsApi.update(newJob.id, { jdImages: [imagePreview] }); } catch (e) { console.error('保存 JD 原图失败', e); }
      }

      setStep('done');
      await new Promise(resolve => setTimeout(resolve, 600));
      navigate(`/jobs/${newJob.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败，请重试');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = (() => {
    if (mode === 'link') return url.trim();
    if (mode === 'text') return jdText.trim();
    if (mode === 'image') return !!imageFile;
    return false;
  })();

  const parseSteps = [
    { label: '获取岗位内容', done: step !== 'input' && step !== 'preview' },
    { label: '确认并解析', done: step === 'done' },
    { label: '生成面试建议', done: step === 'done' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <button
          onClick={() => navigate('/jobs')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-white/80 transition-all text-[14px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回列表</span>
        </button>
      </motion.div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h1 className="text-[30px] font-semibold tracking-tight mb-1">添加岗位</h1>
        <p className="text-gray-500 text-[14px]">通过链接、文本或图片，AI 自动解析岗位信息</p>
      </motion.div>

      {/* Step Indicator */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div className="flex items-center justify-center gap-2">
          {['输入', '预览', '确认', '解析'].map((label, idx) => {
            const stepIndex = ['input', 'preview', 'confirm', 'parsing'].indexOf(step);
            const isActive = idx === stepIndex;
            const isDone = idx < stepIndex || step === 'done';
            return (
              <div key={label} className="flex items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium transition-all ${
                  isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span className={`ml-1.5 text-[12px] ${isActive ? 'text-blue-600 font-medium' : isDone ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {label}
                </span>
                {idx < 3 && <ChevronRight className="w-3.5 h-3.5 mx-2 text-gray-300" />}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative bg-white rounded-3xl border border-black/5 overflow-hidden shadow-sm"
      >
        <AnimatePresence mode="wait">
          {/* INPUT STEP */}
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-5"
            >
              {/* Mode Switcher */}
              <div className="p-1 bg-gray-100 rounded-2xl inline-flex">
                {[
                  { mode: 'link' as const, icon: LinkIcon, label: '链接' },
                  { mode: 'text' as const, icon: FileText, label: '文本' },
                  { mode: 'image' as const, icon: Image, label: '图片' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = mode === item.mode;
                  return (
                    <button
                      key={item.mode}
                      onClick={() => setMode(item.mode)}
                      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
                        isActive ? 'text-gray-900 shadow-sm bg-white' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[14px] font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {mode === 'link' && (
                  <motion.div key="link" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <label className="block text-[13px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      招聘平台岗位链接
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="支持 BOSS直聘、智联、前程无忧、猎聘等平台"
                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 rounded-2xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px]"
                        required
                      />
                    </div>
                    <p className="mt-2 text-[12px] text-gray-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-500 text-[9px] flex items-center justify-center font-bold">i</span>
                      支持主流招聘平台，系统自动选择最优解析策略
                    </p>
                  </motion.div>
                )}

                {mode === 'text' && (
                  <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <label className="block text-[13px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      职位描述 (JD)
                    </label>
                    <textarea
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="粘贴完整的职位描述内容，包括岗位职责、任职要求等..."
                      className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all min-h-[260px] resize-none text-[14px] leading-relaxed"
                      required
                    />
                    <p className="mt-2 text-[12px] text-gray-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-500 text-[9px] flex items-center justify-center font-bold">i</span>
                      直接粘贴职位描述文本，AI 将自动提取关键信息
                    </p>
                  </motion.div>
                )}

                {mode === 'image' && (
                  <motion.div key="image" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <label className="block text-[13px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      JD 图片 / PDF 截图
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {!imagePreview ? (
                      <div
                        ref={dropZoneRef}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`
                          w-full py-12 border-2 border-dashed rounded-2xl
                          flex flex-col items-center justify-center gap-3
                          transition-all cursor-pointer
                          ${isDragging
                            ? 'border-blue-400 bg-blue-50 scale-[1.02]'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                          }
                        `}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-blue-100' : 'bg-gray-50'}`}>
                          {isDragging ? (
                            <FileUp className="w-6 h-6 text-blue-500" />
                          ) : (
                            <FileUp className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className={`text-[14px] ${isDragging ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                          {isDragging ? '松开以上传' : '点击上传 / 拖拽图片 / Cmd+V 粘贴'}
                        </div>
                        <div className="text-[12px] text-gray-400">
                          支持 PNG、JPG、WebP、PDF，截图后上传效果最佳
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="rounded-2xl overflow-hidden border border-gray-200">
                          {imageFile?.type === 'application/pdf' ? (
                            <div className="h-48 bg-gray-50 flex items-center justify-center">
                              <FileText className="w-12 h-12 text-gray-400" />
                              <span className="ml-2 text-gray-500">{imageFile.name}</span>
                            </div>
                          ) : (
                            <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto object-contain" />
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearImage(); }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white shadow-md hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <p className="mt-2 text-[12px] text-gray-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-500 text-[9px] flex items-center justify-center font-bold">i</span>
                      图片或 PDF 将通过 AI 多模态模型解析为文本
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] text-red-700">{error}</p>
                </motion.div>
              )}

              {/* AI Info Banner */}
              <div className="relative overflow-hidden p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}>
                    <Sparkles className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-gray-800 mb-1">AI 智能解析</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {['自动提取岗位信息', '识别技术关键词', '生成面试建议'].map((item) => (
                        <div key={item} className="flex items-center gap-1.5 text-[12px] text-gray-600">
                          <div className="w-1 h-1 rounded-full bg-blue-400" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={handleNextFromInput}
                disabled={!isFormValid || loading || imageLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-[15px] font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}
              >
                {imageLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>图片解析中...</span>
                  </>
                ) : (
                  <>
                    <span>下一步</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* PREVIEW STEP */}
          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-5"
            >
              <div>
                <h3 className="text-[15px] font-semibold text-gray-800 mb-1">预览 & 编辑</h3>
                <p className="text-[13px] text-gray-500">确认抓取的内容，如有需要可手动编辑</p>
              </div>

              <textarea
                value={scrapedContent}
                onChange={(e) => setScrapedContent(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all min-h-[320px] resize-none text-[14px] leading-relaxed"
              />

              {/* Error */}
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] text-red-700">{error}</p>
                </motion.div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('input')}
                  className="px-6 py-3.5 rounded-2xl text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all text-[14px]"
                >
                  上一步
                </button>
                <button
                  onClick={handleConfirmAndParse}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-[15px] font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>AI 解析中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>确认并开始解析</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* PARSING STEP */}
          {step === 'parsing' && (
            <motion.div
              key="parsing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center rounded-3xl z-10"
            >
              <div className="text-center px-8">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}>
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-[18px] font-semibold mb-2">AI 解析中</h3>
                <p className="text-gray-500 text-[14px] mb-6">正在自动提取岗位信息，请稍候...</p>
                <div className="space-y-3 text-left max-w-xs mx-auto">
                  {parseSteps.map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${s.done ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        {s.done ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
                        )}
                      </div>
                      <span className={`text-[13px] ${s.done ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* DONE STEP */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 py-16 text-center"
            >
              <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-emerald-50">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-[18px] font-semibold mb-2">岗位创建成功</h3>
              <p className="text-gray-500 text-[14px] mb-6">正在跳转到详情页...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tips */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-black/5">
        <h3 className="text-[13px] font-semibold text-gray-700 mb-3">使用技巧</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: '🔗', title: '链接输入', desc: '自动从招聘网站爬取，推荐首选' },
            { icon: '📋', title: '文本粘贴', desc: '当链接爬取失败时，手动复制 JD' },
            { icon: '🖼️', title: '图片上传', desc: '截图招聘页面，AI 多模态解析' },
          ].map((tip) => (
            <div key={tip.title} className="flex gap-3">
              <span className="text-[18px]">{tip.icon}</span>
              <div>
                <div className="text-[13px] font-medium text-gray-700">{tip.title}</div>
                <div className="text-[12px] text-gray-500 mt-0.5">{tip.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
