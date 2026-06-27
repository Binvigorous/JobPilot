import { useParams, useNavigate, Link } from 'react-router';
import { jobsApi, ApplicationStatus, PreferenceLevel } from '../api/jobs';
import type { RoleAnalysis, InterviewInsights, PreparationGuide, InterviewRound, RoundStatus } from '../api/jobs';
import {
  ArrowLeft, MapPin, GraduationCap, Clock, Building,
  Tag, Sparkles, Calendar, FileText, Trash2, RefreshCw,
  ExternalLink, DollarSign, CheckCircle2, ChevronDown, ChevronUp,
  MessageSquare, Brain, Zap, Pencil, X, Check, Lightbulb, ClipboardList,
  Plus, ListChecks, Image as ImageIcon, Upload
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { motion, AnimatePresence } from 'motion/react';
import { CompanyAvatar } from '../components/CompanyAvatar';

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: EASE },
});

const statusConfig: Record<ApplicationStatus, { bg: string; text: string; dot: string; label: string; border: string }> = {
  not_applied: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', label: '待投递', border: 'border-slate-200' },
  applied: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: '已投递', border: 'border-blue-200' },
  resume_rejected: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-400', label: '简历未通过', border: 'border-rose-200' },
  interviewing: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: '面试中', border: 'border-purple-200' },
  offer: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Offer', border: 'border-emerald-200' },
  withdrawn: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400', label: '已撤回', border: 'border-gray-200' },
  eliminated: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-300', label: '已淘汰', border: 'border-gray-200' },
};

const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
  '业务': { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  '技术': { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
  '管理': { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
};

const typeColors: Record<string, { bg: string; text: string }> = {
  'must': { bg: 'bg-red-50', text: 'text-red-600' },
  'plus': { bg: 'bg-blue-50', text: 'text-blue-600' },
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  '简单': { bg: 'bg-green-50', text: 'text-green-600' },
  '中等': { bg: 'bg-amber-50', text: 'text-amber-600' },
  '困难': { bg: 'bg-red-50', text: 'text-red-600' },
};

const questionTypeColors: Record<string, { bg: string; text: string }> = {
  '技术面': { bg: 'bg-purple-50', text: 'text-purple-600' },
  '行为面': { bg: 'bg-blue-50', text: 'text-blue-600' },
  '业务面': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
};

const roundStatusConfig: Record<RoundStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  pending: { label: '待进行', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' },
  awaiting_result: { label: '待结果', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  passed: { label: '已通过', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  failed: { label: '未通过', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400', border: 'border-red-200' },
};

const roundStatusOrder: RoundStatus[] = ['pending', 'awaiting_result', 'passed', 'failed'];

interface InterviewQuestion {
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

interface ParsedContent {
  responsibilities: Array<{ text: string; category: string; importance: string }>;
  requirements: Array<{ text: string; type: string; importance: number }>;
}

interface Keywords {
  tech: Array<{ name: string; level?: string; importance: number }>;
  skills: Array<{ name: string; importance: number }>;
  softSkills: Array<{ name: string; importance: number }>;
}

// 内联可编辑文本：平时看着像普通文本，点进去就能改，失焦自动提交。
// 自带 draft，保证打字流畅；外部 value 变化时（如保存后刷新）自动同步。
function EditableText({
  value,
  onCommit,
  multiline = false,
  fullWidth = false,
  placeholder,
  className = '',
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => { if (draft !== value) onCommit(draft); };
  const base = 'bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-indigo-400 focus:border-solid focus:outline-none transition-colors';

  if (multiline) {
    const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
    return (
      <textarea
        value={draft}
        rows={1}
        placeholder={placeholder}
        ref={grow}
        onChange={(e) => { setDraft(e.target.value); grow(e.target); }}
        onBlur={commit}
        className={`${base} resize-none overflow-hidden leading-relaxed ${className}`}
      />
    );
  }
  // 单行：按内容自适应宽度（中文按双宽计），空时按 placeholder 估宽
  const sizeText = draft || placeholder || '';
  const displayLen = Array.from(sizeText).reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      size={fullWidth ? undefined : Math.max(displayLen + 1, 2)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
      style={fullWidth ? undefined : { width: 'auto', minWidth: '2rem', maxWidth: '100%' }}
      className={`${base} ${fullWidth ? 'w-full' : ''} ${className}`}
    />
  );
}

// 轮次驱动粗状态：前向推进，不倒推、不覆盖用户显式终态（offer/withdrawn）
function deriveStatus(rounds: InterviewRound[], current: ApplicationStatus): ApplicationStatus {
  if (current === 'offer' || current === 'withdrawn') return current;
  if (rounds.some(r => r.status === 'failed')) return 'eliminated';            // 任一轮未通过 → 已淘汰
  if (rounds.length > 0 && (current === 'not_applied' || current === 'applied')) return 'interviewing'; // 有轮次 → 面试中
  return current;
}

export function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Awaited<ReturnType<typeof jobsApi.getById>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // Page-level tabs (岗位信息 / 面试指南 / 进度管理 / JD原图)
  const [page, setPage] = useState<'info' | 'guide' | 'progress' | 'images'>('info');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Interview prep sub-tabs + multi-round tracking
  const [prepTab, setPrepTab] = useState<'insights' | 'guide'>('insights');
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});
  const [genError, setGenError] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(false);
  const [confirmDeleteRoundId, setConfirmDeleteRoundId] = useState<string | null>(null);

  // Location & Company Address editing
  const [editingLocation, setEditingLocation] = useState(false);
  const [editingCompanyAddress, setEditingCompanyAddress] = useState(false);
  const [tempLocation, setTempLocation] = useState('');
  const [tempCompanyAddress, setTempCompanyAddress] = useState('');

  useEffect(() => {
    if (!id) return;
    jobsApi.getById(id).then(data => {
      setJob(data);
      setNotes(data?.notes || '');
      setTempLocation(data?.location || '');
      setTempCompanyAddress(data?.companyAddress || '');
      try {
        const parsed = data?.interviewRounds ? JSON.parse(data.interviewRounds) : [];
        // 兼容旧数据：questions 旧为 string[]，规整为 { question, answer } 结构
        const normalized = (Array.isArray(parsed) ? parsed : []).map((r: InterviewRound) => ({
          ...r,
          questions: (r.questions || []).map((q) => (typeof q === 'string' ? { question: q } : q)),
        }));
        setRounds(normalized);
      } catch {
        setRounds([]);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  // 在「JD 原图」页签时，支持直接粘贴截图（Cmd+Shift+4 后粘贴）
  useEffect(() => {
    if (page !== 'images') return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const it of items) if (it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) imgs.push(f); }
      if (!imgs.length) return;
      Promise.all(imgs.map(f => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })))
        .then(urls => {
          setJob(prev => {
            if (!prev) return prev;
            let cur: string[] = [];
            try { cur = prev.jdImages ? JSON.parse(prev.jdImages) : []; } catch { cur = []; }
            const next = [...cur, ...urls];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jobsApi.update(id!, { jdImages: next } as any).catch(err => console.error('保存失败', err));
            return { ...prev, jdImages: JSON.stringify(next) };
          });
        });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [page, id]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl">
        <div className="h-8 w-32 animate-pulse bg-gray-200 rounded" />
        <div className="h-48 animate-pulse bg-gray-100 rounded-3xl" />
        <div className="grid grid-cols-3 gap-6">
          <div className="h-64 animate-pulse bg-gray-100 rounded-2xl" />
          <div className="h-64 animate-pulse bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">岗位不存在</p>
        <Link to="/jobs" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">返回列表</Link>
      </div>
    );
  }

  const handleDelete = async () => {
    await jobsApi.delete(id!);
    navigate('/jobs');
  };

  const handleUpdateStatus = async (status: ApplicationStatus) => {
    await jobsApi.update(id!, { applicationStatus: status });
    const updated = await jobsApi.getById(id!);
    setJob(updated);
  };

  const handleUpdatePreference = async (level: PreferenceLevel) => {
    await jobsApi.update(id!, { preferenceLevel: level });
    const updated = await jobsApi.getById(id!);
    setJob(updated);
  };

  const handleSaveNotes = async () => {
    await jobsApi.update(id!, { notes });
    setEditing(false);
  };

  const handleSaveLocation = async () => {
    await jobsApi.update(id!, { location: tempLocation });
    const updated = await jobsApi.getById(id!);
    setJob(updated);
    setEditingLocation(false);
  };

  const handleSaveCompanyAddress = async () => {
    await jobsApi.update(id!, { companyAddress: tempCompanyAddress });
    const updated = await jobsApi.getById(id!);
    setJob(updated);
    setEditingCompanyAddress(false);
  };

  const handleReparse = async () => {
    setReparsing(true);
    try {
      const updated = await jobsApi.reparse(id!);
      setJob(updated);
    } catch (err) {
      console.error('Reparse failed:', err);
    } finally {
      setReparsing(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setGenError(null);
    setGeneratingQuestions(true);
    try {
      const updated = await jobsApi.generateInterviewQuestions(id!);
      setJob(updated);
    } catch (err) {
      console.error('Failed to generate questions:', err);
      setGenError(typeof err === 'string' ? err : err instanceof Error ? err.message : '生成失败，请检查 AI 配置');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const toggleQuestionExpand = (idx: number) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // ─── Interview rounds (multi-round tracking) ───
  // 轮次结构性变更时，顺带按规则派生并同步粗状态（加轮→面试中、某轮未通过→已淘汰）
  const persistRounds = async (next: InterviewRound[]) => {
    setRounds(next);
    const current = job?.applicationStatus;
    const derived = current ? deriveStatus(next, current) : undefined;
    const patch: { interviewRounds: InterviewRound[]; applicationStatus?: ApplicationStatus } = { interviewRounds: next };
    if (derived && derived !== current) {
      patch.applicationStatus = derived;
      setJob(prev => (prev ? { ...prev, applicationStatus: derived } : prev));
    }
    try {
      await jobsApi.update(id!, patch);
    } catch (err) {
      console.error('Failed to save interview rounds:', err);
    }
  };

  // Local-only edit (text fields); persisted on blur via flushRounds
  const setRoundField = (rid: string, patch: Partial<InterviewRound>) => {
    setRounds(prev => prev.map(r => (r.id === rid ? { ...r, ...patch } : r)));
  };
  const flushRounds = () => {
    jobsApi.update(id!, { interviewRounds: rounds }).catch(err => console.error('Failed to save interview rounds:', err));
  };

  const addRound = () => {
    const newRound: InterviewRound = {
      id: crypto.randomUUID(),
      name: `第 ${rounds.length + 1} 轮`,
      status: 'pending',
      questions: [],
    };
    persistRounds([...rounds, newRound]);
    setActiveRoundId(newRound.id);
  };
  const removeRound = (rid: string) => {
    const next = rounds.filter(r => r.id !== rid);
    persistRounds(next);
    if (activeRoundId === rid) setActiveRoundId(next[0]?.id ?? null);
    setConfirmDeleteRoundId(null);
  };
  const updateRoundStatus = (rid: string, status: RoundStatus) => {
    persistRounds(rounds.map(r => (r.id === rid ? { ...r, status } : r)));
  };
  const addQuestion = (rid: string) => {
    const text = (questionDrafts[rid] || '').trim();
    if (!text) return;
    persistRounds(rounds.map(r => (r.id === rid ? { ...r, questions: [...r.questions, { question: text }] } : r)));
    setQuestionDrafts(prev => ({ ...prev, [rid]: '' }));
  };
  const removeQuestion = (rid: string, qIdx: number) => {
    persistRounds(rounds.map(r => (r.id === rid ? { ...r, questions: r.questions.filter((_, i) => i !== qIdx) } : r)));
  };
  // 编辑某条问题/答案的文本（本地改，失焦 flushRounds 持久化）
  const setQuestionText = (rid: string, qIdx: number, text: string) => {
    setRounds(prev => prev.map(r => (r.id === rid ? { ...r, questions: r.questions.map((q, i) => (i === qIdx ? { ...q, question: text } : q)) } : r)));
  };
  const setQuestionAnswer = (rid: string, qIdx: number, text: string) => {
    setRounds(prev => prev.map(r => (r.id === rid ? { ...r, questions: r.questions.map((q, i) => (i === qIdx ? { ...q, answer: text } : q)) } : r)));
  };

  // ─── 通用：用户手动修正 AI 提取的内容（乐观更新 + 持久化）───
  // 简单文本列字段（title/company/salary/...）
  const commitField = (field: string, value: string) => {
    setJob(prev => (prev ? ({ ...prev, [field]: value }) : prev));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jobsApi.update(id!, { [field]: value } as any).catch(e => console.error('保存失败', e));
  };
  // JSON 结构字段（jdParsedContent/keywords/roleAnalysis/interviewInsights/preparationGuide/interviewQuestions）
  const commitJson = (field: string, obj: unknown) => {
    const str = JSON.stringify(obj);
    setJob(prev => (prev ? ({ ...prev, [field]: str }) : prev));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jobsApi.update(id!, { [field]: str } as any).catch(e => console.error('保存失败', e));
  };

  const s = statusConfig[job.applicationStatus];

  const parsedJd: ParsedContent = (() => {
    try {
      const raw = typeof job.jdParsedContent === 'string'
        ? JSON.parse(job.jdParsedContent || '{}')
        : (job.jdParsedContent || {});
      return { responsibilities: raw?.responsibilities ?? [], requirements: raw?.requirements ?? [] };
    } catch {
      return { responsibilities: [], requirements: [] };
    }
  })();

  const parsedKeywords: Keywords = (() => {
    try {
      const raw = typeof job.keywords === 'string'
        ? JSON.parse(job.keywords || '{}')
        : (job.keywords || {});
      return { tech: raw?.tech ?? [], skills: raw?.skills ?? [], softSkills: raw?.softSkills ?? [] };
    } catch {
      return { tech: [], skills: [], softSkills: [] };
    }
  })();

  const interviewQuestions: InterviewQuestion[] = (() => {
    try {
      return typeof job.interviewQuestions === 'string'
        ? JSON.parse(job.interviewQuestions || '[]')
        : (job.interviewQuestions || []);
    } catch {
      return [];
    }
  })();

  const parseJsonField = <T,>(raw: unknown, fallback: T): T => {
    try {
      if (typeof raw === 'string') return raw ? (JSON.parse(raw) as T) : fallback;
      return (raw as T) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const roleAnalysis = parseJsonField<RoleAnalysis | null>(job.roleAnalysis, null);
  // 规整为非空对象，保证可编辑/可增删且不会因缺字段崩溃
  const rawInsights = parseJsonField<Partial<InterviewInsights> | null>(job.interviewInsights, null);
  const interviewInsights: InterviewInsights = {
    highFrequencyTopics: rawInsights?.highFrequencyTopics ?? [],
    potentialQuestions: rawInsights?.potentialQuestions ?? [],
  };
  const rawPrep = parseJsonField<Partial<PreparationGuide> | null>(job.preparationGuide, null);
  const preparationGuide: PreparationGuide = {
    priorityPreparation: rawPrep?.priorityPreparation ?? [],
    projectPreparation: rawPrep?.projectPreparation ?? [],
    resumeOptimization: rawPrep?.resumeOptimization ?? [],
  };

  const activeRound = rounds.find(r => r.id === activeRoundId) ?? rounds[0] ?? null;

  // JD 原始截图
  const jdImages: string[] = (() => {
    try { const a = job.jdImages ? JSON.parse(job.jdImages) : []; return Array.isArray(a) ? a : []; }
    catch { return []; }
  })();
  const addImages = (dataUrls: string[]) => {
    const valid = dataUrls.filter(u => u.startsWith('data:image/'));
    if (valid.length) commitJson('jdImages', [...jdImages, ...valid]);
  };
  const removeImage = (idx: number) => commitJson('jdImages', jdImages.filter((_, i) => i !== idx));
  const filesToDataUrls = (files: File[]) => Promise.all(
    files.filter(f => f.type.startsWith('image/')).map(f => new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error('读取失败'));
      r.readAsDataURL(f);
    }))
  );

  const insightsHas = (interviewInsights.highFrequencyTopics.length > 0) || (interviewInsights.potentialQuestions.length > 0);

  const statusOptions: { value: ApplicationStatus; label: string }[] = [
    { value: 'not_applied', label: '待投递' },
    { value: 'applied', label: '已投递' },
    { value: 'resume_rejected', label: '简历未通过' },
    { value: 'interviewing', label: '面试中' },
    { value: 'offer', label: 'Offer' },
    { value: 'withdrawn', label: '已撤回' },
    { value: 'eliminated', label: '已淘汰' },
  ];

  const preferenceOptions: { value: PreferenceLevel; label: string }[] = [
    { value: 'high', label: '高意向' },
    { value: 'medium', label: '中意向' },
    { value: 'low', label: '低意向' },
    { value: 'none', label: '无意向' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Bar */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between">
        <button
          onClick={() => navigate('/jobs')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-white/80 transition-all text-[14px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回列表</span>
        </button>
        {confirmDeleteJob ? (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-gray-500">确定删除此岗位？</span>
            <button onClick={handleDelete} className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-all">确认删除</button>
            <button onClick={() => setConfirmDeleteJob(false)} className="px-3 py-1.5 rounded-xl text-gray-500 hover:bg-gray-100 text-[13px] transition-all">取消</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDeleteJob(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-red-500 hover:bg-red-50 transition-all text-[13px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除岗位</span>
          </button>
        )}
      </motion.div>

      {/* Hero Card */}
      <motion.div {...fadeUp(0.05)} className="relative overflow-hidden bg-white rounded-3xl border border-black/5 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5 pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

        <div className="flex items-start gap-5">
          <CompanyAvatar name={job.company} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <EditableText
                  value={job.title}
                  onCommit={(v) => commitField('title', v)}
                  placeholder="岗位名称"
                  fullWidth
                  className="text-[26px] font-semibold tracking-tight mb-1"
                />
                <div className="flex items-center gap-2 text-gray-500 text-[15px]">
                  <Building className="w-4 h-4 flex-shrink-0" />
                  <EditableText
                    value={job.company}
                    onCommit={(v) => commitField('company', v)}
                    placeholder="公司名称"
                    className="text-[15px] text-gray-600 min-w-0"
                  />
                  <EditableText
                    value={job.companySize || ''}
                    onCommit={(v) => commitField('companySize', v)}
                    placeholder="公司规模"
                    className="text-[12px] text-gray-500 w-24 flex-shrink-0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium ${s.bg} ${s.text} ${s.border}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </div>
                {job.sourceUrl && (
                  <button
                    onClick={() => open(job.sourceUrl!)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 text-[13px] transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    原链接
                  </button>
                )}
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <EditableText value={job.salary || ''} onCommit={(v) => commitField('salary', v)} placeholder="薪资" className="text-emerald-700 text-[14px] font-semibold w-28" />
              </div>
              {job.location && (
                <div className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  {editingLocation ? (
                    <input
                      type="text"
                      value={tempLocation}
                      onChange={(e) => setTempLocation(e.target.value)}
                      className="flex-1 px-2 py-0.5 bg-white rounded border border-blue-200 text-[14px] text-blue-700 outline-none"
                      placeholder="工作地点，如北京、上海市"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(); if (e.key === 'Escape') setEditingLocation(false); }}
                    />
                  ) : (
                    <span className="text-blue-700 text-[14px]">{job.location}</span>
                  )}
                  {!editingLocation && (
                    <button onClick={() => { setTempLocation(job.location || ''); setEditingLocation(true); }} className="p-1 hover:bg-blue-100 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                      <Pencil className="w-3 h-3 text-blue-400" />
                    </button>
                  )}
                  {editingLocation && (
                    <>
                      <button onClick={handleSaveLocation} className="p-1 hover:bg-blue-100 rounded">
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                      <button onClick={() => setEditingLocation(false)} className="p-1 hover:bg-blue-100 rounded">
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-100">
                <Clock className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <EditableText value={job.experience || ''} onCommit={(v) => commitField('experience', v)} placeholder="经验要求" className="text-purple-700 text-[14px] w-24" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-100">
                <GraduationCap className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <EditableText value={job.education || ''} onCommit={(v) => commitField('education', v)} placeholder="学历要求" className="text-orange-700 text-[14px] w-20" />
              </div>
              {/* Company Address - always show input, editable */}
              <div className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
                <Building className="w-4 h-4 text-gray-400" />
                {editingCompanyAddress ? (
                  <input
                    type="text"
                    value={tempCompanyAddress}
                    onChange={(e) => setTempCompanyAddress(e.target.value)}
                    className="flex-1 px-2 py-0.5 bg-white rounded border border-gray-300 text-[14px] text-gray-700 outline-none"
                    placeholder="公司详细地址（选填）"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCompanyAddress(); if (e.key === 'Escape') setEditingCompanyAddress(false); }}
                  />
                ) : (
                  <span className={`text-[14px] ${job.companyAddress ? 'text-gray-600' : 'text-gray-400'}`}>
                    {job.companyAddress || '公司详细地址（选填）'}
                  </span>
                )}
                {!editingCompanyAddress && (
                  <button onClick={() => { setTempCompanyAddress(job.companyAddress || ''); setEditingCompanyAddress(true); }} className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    <Pencil className="w-3 h-3 text-gray-400" />
                  </button>
                )}
                {editingCompanyAddress && (
                  <>
                    <button onClick={handleSaveCompanyAddress} className="p-1 hover:bg-gray-100 rounded">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </button>
                    <button onClick={() => setEditingCompanyAddress(false)} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Interview countdown */}
        {job.interviewDate && new Date(job.interviewDate) > new Date() && (
          <div className="mt-5 flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5 text-purple-600" />
            </div>
            <div>
              <div className="text-[13px] text-purple-500 font-medium">面试时间</div>
              <div className="text-[15px] text-purple-800 font-semibold">
                {new Date(job.interviewDate).toLocaleString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="ml-auto">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            </div>
          </div>
        )}
      </motion.div>

      {/* Page-level tabs */}
      <motion.div {...fadeUp(0.08)} className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          { key: 'info', label: '岗位信息', Icon: FileText },
          { key: 'guide', label: '面试指南', Icon: MessageSquare },
          { key: 'progress', label: '进度管理', Icon: ListChecks },
          { key: 'images', label: 'JD 原图', Icon: ImageIcon },
        ] as const).map(t => {
          const active = page === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setPage(t.key)}
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
      {page === 'info' && (
        <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
          {/* 岗位分析 + 状态管理（左右并列） */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Role Analysis */}
          {roleAnalysis && (
            <motion.div {...fadeUp(0.06)} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-indigo-600" />
                </div>
                <h2 className="text-[17px] font-semibold">岗位分析</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/60 rounded-xl p-3">
                  <div className="text-[11px] text-gray-500 mb-1">岗位类型</div>
                  <EditableText value={roleAnalysis.roleType || ''} onCommit={(v) => commitJson('roleAnalysis', { ...roleAnalysis, roleType: v })} placeholder="如 后端开发" fullWidth className="text-[13px] font-medium text-gray-800" />
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <div className="text-[11px] text-gray-500 mb-1">职级</div>
                  <EditableText value={roleAnalysis.seniority || ''} onCommit={(v) => commitJson('roleAnalysis', { ...roleAnalysis, seniority: v })} placeholder="初级/中级/高级" fullWidth className="text-[13px] font-medium text-gray-800" />
                </div>
                <div className="col-span-2 bg-white/60 rounded-xl p-3">
                  <div className="text-[11px] text-gray-500 mb-1">核心关注点</div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {(roleAnalysis.focusAreas || []).map((area: string, idx: number) => (
                      <span key={idx} className="group inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-600">
                        <EditableText value={area} onCommit={(v) => commitJson('roleAnalysis', { ...roleAnalysis, focusAreas: roleAnalysis.focusAreas.map((a, j) => (j === idx ? v : a)) })} className="text-[12px] text-indigo-600 w-20" />
                        <button onClick={() => commitJson('roleAnalysis', { ...roleAnalysis, focusAreas: roleAnalysis.focusAreas.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    <button onClick={() => commitJson('roleAnalysis', { ...roleAnalysis, focusAreas: [...(roleAnalysis.focusAreas || []), '新关注点'] })} className="text-[12px] px-2 py-0.5 rounded-md border border-dashed border-indigo-200 text-indigo-400 hover:bg-indigo-50">+ 添加</button>
                  </div>
                </div>
                <div className="col-span-2 bg-white/60 rounded-xl p-3">
                  <div className="text-[11px] text-gray-500 mb-1">面试轮次</div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {(roleAnalysis.typicalInterviewRounds || []).map((round: string, idx: number) => (
                      <span key={idx} className="group inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-600">
                        <EditableText value={round} onCommit={(v) => commitJson('roleAnalysis', { ...roleAnalysis, typicalInterviewRounds: roleAnalysis.typicalInterviewRounds.map((a, j) => (j === idx ? v : a)) })} className="text-[12px] text-purple-600 w-16" />
                        <button onClick={() => commitJson('roleAnalysis', { ...roleAnalysis, typicalInterviewRounds: roleAnalysis.typicalInterviewRounds.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-purple-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    <button onClick={() => commitJson('roleAnalysis', { ...roleAnalysis, typicalInterviewRounds: [...(roleAnalysis.typicalInterviewRounds || []), '新轮次'] })} className="text-[12px] px-2 py-0.5 rounded-md border border-dashed border-purple-200 text-purple-400 hover:bg-purple-50">+ 添加</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Management (状态管理) — 与岗位分析并列 */}
          <motion.div {...fadeUp(0.08)} className="bg-white rounded-2xl p-6 border border-black/5 space-y-4">
            <h2 className="text-[16px] font-semibold">状态管理</h2>

            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">投递状态</label>
              <select
                value={job.applicationStatus}
                onChange={(e) => handleUpdateStatus(e.target.value as ApplicationStatus)}
                className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 focus:border-blue-400 focus:bg-white focus:outline-none text-[14px] transition-all"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">意向度</label>
              <div className="grid grid-cols-4 gap-1.5">
                {preferenceOptions.map((option) => {
                  const colors: Record<string, string> = {
                    high: 'border-red-300 bg-red-50 text-red-600',
                    medium: 'border-yellow-300 bg-yellow-50 text-yellow-600',
                    low: 'border-gray-200 bg-gray-50 text-gray-500',
                    none: 'border-gray-100 bg-gray-50 text-gray-400',
                  };
                  const isActive = job.preferenceLevel === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleUpdatePreference(option.value)}
                      className={`py-2 rounded-xl text-[11px] font-medium border transition-all ${
                        isActive ? colors[option.value] : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      {option.label.replace('意向', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">备注</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onFocus={() => setEditing(true)}
                placeholder="添加个人备注..."
                className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 focus:border-blue-400 focus:bg-white focus:outline-none min-h-[80px] resize-none text-[13px] transition-all"
              />
            </div>

            {editing && (
              <motion.button
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleSaveNotes}
                className="w-full py-2.5 rounded-xl text-white text-[14px] font-medium shadow-sm hover:shadow transition-all"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}
              >
                保存更改
              </motion.button>
            )}
          </motion.div>
          </div>

          {/* JD */}
          <motion.div {...fadeUp(0.1)} className="bg-white rounded-2xl p-6 border border-black/5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-600" />
              </div>
              <h2 className="text-[17px] font-semibold">职位描述</h2>
            </div>

            <div className="space-y-5">
              {/* Responsibilities */}
              <div>
                <h3 className="text-[14px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold">职</span>
                  工作职责
                </h3>
                <ul className="space-y-2.5">
                  {parsedJd.responsibilities.map((item: { text: string; category: string; importance: string }, idx: number) => {
                    const catColor = categoryColors[item.category] || { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
                    return (
                      <li key={idx} className="group flex items-start gap-3 text-[13px] text-gray-600">
                        <div className={`w-1.5 h-1.5 rounded-full ${catColor.dot} flex-shrink-0 mt-2.5`} />
                        <EditableText multiline value={item.text} onCommit={(v) => commitJson('jdParsedContent', { ...parsedJd, responsibilities: parsedJd.responsibilities.map((it, j) => (j === idx ? { ...it, text: v } : it)) })} placeholder="职责描述" className="flex-1 text-[13px] text-gray-600 mt-0.5" />
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 mt-1 ${catColor.bg} ${catColor.text}`}>{item.category}</span>
                        <button onClick={() => commitJson('jdParsedContent', { ...parsedJd, responsibilities: parsedJd.responsibilities.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0 mt-1"><X className="w-3.5 h-3.5" /></button>
                      </li>
                    );
                  })}
                </ul>
                <button onClick={() => commitJson('jdParsedContent', { ...parsedJd, responsibilities: [...parsedJd.responsibilities, { text: '', category: '业务', importance: 'medium' }] })} className="mt-2 text-[12px] text-blue-500 hover:text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />添加职责</button>
              </div>

              {/* Requirements */}
              <div className="border-t border-gray-50 pt-4">
                <h3 className="text-[14px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-600 text-[10px] flex items-center justify-center font-bold">要</span>
                  任职要求
                </h3>
                <ul className="space-y-2.5">
                  {parsedJd.requirements.map((item: { text: string; type: string; importance: number }, idx: number) => {
                    const typeColor = typeColors[item.type] || { bg: 'bg-gray-50', text: 'text-gray-600' };
                    return (
                      <li key={idx} className="group flex items-start gap-3 text-[13px] text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-1" />
                        <EditableText multiline value={item.text} onCommit={(v) => commitJson('jdParsedContent', { ...parsedJd, requirements: parsedJd.requirements.map((it, j) => (j === idx ? { ...it, text: v } : it)) })} placeholder="要求描述" className="flex-1 text-[13px] text-gray-600 mt-0.5" />
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 mt-1 ${typeColor.bg} ${typeColor.text}`}>{item.type === 'must' ? '必备' : '加分'}</span>
                        <button onClick={() => commitJson('jdParsedContent', { ...parsedJd, requirements: parsedJd.requirements.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0 mt-1"><X className="w-3.5 h-3.5" /></button>
                      </li>
                    );
                  })}
                </ul>
                <button onClick={() => commitJson('jdParsedContent', { ...parsedJd, requirements: [...parsedJd.requirements, { text: '', type: 'must', importance: 3 }] })} className="mt-2 text-[12px] text-purple-500 hover:text-purple-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />添加要求</button>
              </div>
            </div>
          </motion.div>

          {/* Keywords */}
          {parsedKeywords && (
            <motion.div {...fadeUp(0.15)} className="bg-white rounded-2xl p-6 border border-black/5">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-gray-600" />
                </div>
                <h2 className="text-[17px] font-semibold">关键词</h2>
              </div>

              <div className="space-y-4">
                {/* Tech Keywords */}
                <div>
                  <div className="text-[12px] font-semibold text-blue-500 uppercase tracking-wider mb-2.5">技术栈</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {parsedKeywords.tech.map((keyword: { name: string; level?: string }, idx: number) => (
                      <div key={idx} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-[13px] font-medium border border-blue-100">
                        <EditableText value={keyword.name} onCommit={(v) => commitJson('keywords', { ...parsedKeywords, tech: parsedKeywords.tech.map((k, j) => (j === idx ? { ...k, name: v } : k)) })} className="text-[13px] text-blue-700 w-20" />
                        {keyword.level && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200/50 text-blue-600">{keyword.level}</span>}
                        <button onClick={() => commitJson('keywords', { ...parsedKeywords, tech: parsedKeywords.tech.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-blue-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    <button onClick={() => commitJson('keywords', { ...parsedKeywords, tech: [...parsedKeywords.tech, { name: '', importance: 3 }] })} className="px-3 py-1.5 rounded-xl border border-dashed border-blue-200 text-blue-400 text-[13px] hover:bg-blue-50">+ 添加</button>
                  </div>
                </div>

                {/* Core Skills */}
                <div>
                  <div className="text-[12px] font-semibold text-purple-500 uppercase tracking-wider mb-2.5">核心能力</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {parsedKeywords.skills.map((keyword: { name: string }, idx: number) => (
                      <div key={idx} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-[13px] font-medium border border-purple-100">
                        <EditableText value={keyword.name} onCommit={(v) => commitJson('keywords', { ...parsedKeywords, skills: parsedKeywords.skills.map((k, j) => (j === idx ? { ...k, name: v } : k)) })} className="text-[13px] text-purple-700 w-20" />
                        <button onClick={() => commitJson('keywords', { ...parsedKeywords, skills: parsedKeywords.skills.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-purple-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    <button onClick={() => commitJson('keywords', { ...parsedKeywords, skills: [...parsedKeywords.skills, { name: '', importance: 3 }] })} className="px-3 py-1.5 rounded-xl border border-dashed border-purple-200 text-purple-400 text-[13px] hover:bg-purple-50">+ 添加</button>
                  </div>
                </div>

                {/* Soft Skills */}
                <div>
                  <div className="text-[12px] font-semibold text-emerald-500 uppercase tracking-wider mb-2.5">软技能</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {parsedKeywords.softSkills.map((keyword: { name: string }, idx: number) => (
                      <div key={idx} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[13px] font-medium border border-emerald-100">
                        <EditableText value={keyword.name} onCommit={(v) => commitJson('keywords', { ...parsedKeywords, softSkills: parsedKeywords.softSkills.map((k, j) => (j === idx ? { ...k, name: v } : k)) })} className="text-[13px] text-emerald-700 w-20" />
                        <button onClick={() => commitJson('keywords', { ...parsedKeywords, softSkills: parsedKeywords.softSkills.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-emerald-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    <button onClick={() => commitJson('keywords', { ...parsedKeywords, softSkills: [...parsedKeywords.softSkills, { name: '', importance: 3 }] })} className="px-3 py-1.5 rounded-xl border border-dashed border-emerald-200 text-emerald-400 text-[13px] hover:bg-emerald-50">+ 添加</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
      {page === 'guide' && (
        <motion.div key="guide" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
          {/* Interview Prep - Tabbed (面试洞察 / 面试题库 / 准备指南) */}
          <motion.div {...fadeUp(0.14)} className="bg-white rounded-2xl p-6 border border-black/5">
            {/* Tab header */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
              {([
                { key: 'insights', label: '面试洞察', Icon: Lightbulb },
                { key: 'guide', label: '准备指南', Icon: ClipboardList },
              ] as const).map(t => {
                const active = prepTab === t.key;
                const count = t.key === 'insights' ? interviewQuestions.length : 0;
                return (
                  <button
                    key={t.key}
                    onClick={() => setPrepTab(t.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                      active ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <t.Icon className="w-4 h-4" />
                    <span>{t.label}</span>
                    {count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-medium">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {/* Insights tab (高频考点 + 潜在问题 + 作答指导) */}
              {prepTab === 'insights' && (
                <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  {(insightsHas || interviewQuestions.length > 0) ? (
                    <div className="space-y-5">
                      {/* 高频考点 */}
                      <div>
                        <h3 className="text-[14px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-600 text-[10px] flex items-center justify-center font-bold">频</span>
                          高频考点
                        </h3>
                        <div className="flex flex-wrap gap-2 items-center">
                          {interviewInsights.highFrequencyTopics.map((topic, idx) => (
                            <span key={idx} className="group inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-[13px] font-medium border border-amber-100">
                              <EditableText value={topic} onCommit={(v) => commitJson('interviewInsights', { ...interviewInsights, highFrequencyTopics: interviewInsights.highFrequencyTopics.map((t, j) => (j === idx ? v : t)) })} className="text-[13px] text-amber-700 w-24" />
                              <button onClick={() => commitJson('interviewInsights', { ...interviewInsights, highFrequencyTopics: interviewInsights.highFrequencyTopics.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-amber-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                          <button onClick={() => commitJson('interviewInsights', { ...interviewInsights, highFrequencyTopics: [...interviewInsights.highFrequencyTopics, '新考点'] })} className="px-3 py-1.5 rounded-xl border border-dashed border-amber-200 text-amber-400 text-[13px] hover:bg-amber-50">+ 添加</button>
                        </div>
                      </div>

                      {/* 潜在问题 + 作答指导 */}
                      {((interviewInsights?.potentialQuestions?.length ?? 0) > 0 || interviewQuestions.length > 0) && (
                        <div className="border-t border-gray-50 pt-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-600 text-[10px] flex items-center justify-center font-bold">问</span>
                              潜在问题
                              {interviewQuestions.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-medium">{interviewQuestions.length} 题含解析</span>
                              )}
                            </h3>
                            <button
                              onClick={handleGenerateQuestions}
                              disabled={generatingQuestions}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-[12px] font-medium shadow-sm hover:shadow transition-all disabled:opacity-50 flex-shrink-0"
                              style={{ background: generatingQuestions ? '#6366f1' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                            >
                              {generatingQuestions ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>生成中...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>{interviewQuestions.length > 0 ? '重新生成作答指导' : '生成作答指导'}</span>
                                </>
                              )}
                            </button>
                          </div>

                          {genError && (
                            <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-[12px] text-red-600">
                              ⚠️ {genError}
                            </div>
                          )}

                          {interviewQuestions.length > 0 ? (
                            <div className="space-y-3">
                              {interviewQuestions.map((q: InterviewQuestion, idx: number) => {
                                const isExpanded = expandedQuestions.has(idx);
                                const diffColor = difficultyColors[q.difficulty] || { bg: 'bg-gray-50', text: 'text-gray-500' };
                                const typeColor = questionTypeColors[q.type] || { bg: 'bg-gray-50', text: 'text-gray-500' };
                                const editQ = (patch: Partial<InterviewQuestion>) => commitJson('interviewQuestions', interviewQuestions.map((x, j) => (j === idx ? { ...x, ...patch } : x)));
                                const editGuidance = (key: keyof InterviewQuestion['guidance'], v: string) => commitJson('interviewQuestions', interviewQuestions.map((x, j) => (j === idx ? { ...x, guidance: { ...x.guidance, [key]: v } } : x)));
                                return (
                                  <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="group w-full flex items-center gap-3 p-4">
                                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-[12px] font-semibold flex items-center justify-center flex-shrink-0">
                                        {idx + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <EditableText multiline value={q.question} onCommit={(v) => editQ({ question: v })} placeholder="问题" className="text-[14px] font-medium text-gray-800 w-full mb-1.5" />
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${typeColor.bg} ${typeColor.text}`}>
                                            {q.type}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${diffColor.bg} ${diffColor.text}`}>
                                            {q.difficulty}
                                          </span>
                                        </div>
                                      </div>
                                      <button onClick={() => commitJson('interviewQuestions', interviewQuestions.filter((_, j) => j !== idx))} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0" title="删除此题"><X className="w-4 h-4" /></button>
                                      <button onClick={() => toggleQuestionExpand(idx)} className="flex-shrink-0">
                                        {isExpanded ? (
                                          <ChevronUp className="w-4 h-4 text-gray-400" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-gray-400" />
                                        )}
                                      </button>
                                    </div>

                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="px-4 pb-4 pt-2 border-t border-gray-50 space-y-3">
                                            <div className="bg-amber-50 rounded-xl p-3">
                                              <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1">考察点</div>
                                              <EditableText multiline value={q.guidance.考察点} onCommit={(v) => editGuidance('考察点', v)} className="text-[13px] text-amber-800 w-full" />
                                            </div>
                                            <div className="bg-blue-50 rounded-xl p-3">
                                              <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1">回答策略</div>
                                              <EditableText multiline value={q.guidance.回答策略} onCommit={(v) => editGuidance('回答策略', v)} className="text-[13px] text-blue-800 w-full" />
                                            </div>
                                            <div className="bg-emerald-50 rounded-xl p-3">
                                              <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">参考答案</div>
                                              <EditableText multiline value={q.guidance.参考答案} onCommit={(v) => editGuidance('参考答案', v)} className="text-[13px] text-emerald-800 w-full" />
                                            </div>
                                            <div className="bg-purple-50 rounded-xl p-3">
                                              <div className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider mb-1">应答重点</div>
                                              <EditableText multiline value={q.guidance.应答重点} onCommit={(v) => editGuidance('应答重点', v)} className="text-[13px] text-purple-800 w-full" />
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <>
                              <ul className="space-y-2.5">
                                {interviewInsights.potentialQuestions.map((q, idx) => {
                                  const typeColor = questionTypeColors[q.type] || { bg: 'bg-gray-50', text: 'text-gray-500' };
                                  const diffColor = difficultyColors[q.difficulty] || { bg: 'bg-gray-50', text: 'text-gray-500' };
                                  return (
                                    <li key={idx} className="group flex items-start gap-3 text-[13px] text-gray-600">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-2.5" />
                                      <EditableText multiline value={q.question} onCommit={(v) => commitJson('interviewInsights', { ...interviewInsights, potentialQuestions: interviewInsights.potentialQuestions.map((x, j) => (j === idx ? { ...x, question: v } : x)) })} className="flex-1 text-[13px] text-gray-600 mt-0.5" />
                                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                                        {q.type && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor.bg} ${typeColor.text}`}>{q.type}</span>}
                                        {q.difficulty && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${diffColor.bg} ${diffColor.text}`}>{q.difficulty}</span>}
                                      </div>
                                      <button onClick={() => commitJson('interviewInsights', { ...interviewInsights, potentialQuestions: interviewInsights.potentialQuestions.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0 mt-1"><X className="w-3.5 h-3.5" /></button>
                                    </li>
                                  );
                                })}
                              </ul>
                              <button onClick={() => commitJson('interviewInsights', { ...interviewInsights, potentialQuestions: [...interviewInsights.potentialQuestions, { question: '', type: '', difficulty: '' }] })} className="mt-2 text-[12px] text-indigo-500 hover:text-indigo-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />添加问题</button>
                              <p className="text-[12px] text-gray-400 mt-2 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                点「生成作答指导」获取每题的参考答案与回答策略
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-[13px]">暂无面试洞察，解析岗位后自动生成</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Guide tab */}
              {prepTab === 'guide' && (
                <motion.div key="guide" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  <div className="space-y-5">
                    {/* 重点准备 */}
                    <div>
                      <h3 className="text-[14px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-600 text-[10px] flex items-center justify-center font-bold">重</span>
                        重点准备
                      </h3>
                      <div className="space-y-3">
                        {preparationGuide.priorityPreparation.map((item, idx) => (
                          <div key={idx} className="group rounded-xl border border-gray-100 p-3.5">
                            <div className="flex items-start gap-2 mb-1.5">
                              <EditableText value={item.topic} onCommit={(v) => commitJson('preparationGuide', { ...preparationGuide, priorityPreparation: preparationGuide.priorityPreparation.map((it, j) => (j === idx ? { ...it, topic: v } : it)) })} placeholder="准备主题" className="text-[13px] font-semibold text-gray-800 flex-1" />
                              <button onClick={() => commitJson('preparationGuide', { ...preparationGuide, priorityPreparation: preparationGuide.priorityPreparation.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="flex items-start gap-1.5 text-[12px] text-gray-500 mb-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium flex-shrink-0 mt-0.5">为什么</span>
                              <EditableText multiline value={item.reason || ''} onCommit={(v) => commitJson('preparationGuide', { ...preparationGuide, priorityPreparation: preparationGuide.priorityPreparation.map((it, j) => (j === idx ? { ...it, reason: v } : it)) })} placeholder="为什么重要" className="flex-1 text-[12px] text-gray-500" />
                            </div>
                            <div className="flex items-start gap-1.5 text-[12px] text-emerald-700">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 font-medium flex-shrink-0 mt-0.5">怎么做</span>
                              <EditableText multiline value={item.action || ''} onCommit={(v) => commitJson('preparationGuide', { ...preparationGuide, priorityPreparation: preparationGuide.priorityPreparation.map((it, j) => (j === idx ? { ...it, action: v } : it)) })} placeholder="怎么准备" className="flex-1 text-[12px] text-emerald-700" />
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => commitJson('preparationGuide', { ...preparationGuide, priorityPreparation: [...preparationGuide.priorityPreparation, { topic: '', reason: '', action: '' }] })} className="mt-2 text-[12px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />添加重点</button>
                    </div>

                    {/* 项目准备 */}
                    <div className="border-t border-gray-50 pt-4">
                      <h3 className="text-[14px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold">项</span>
                        项目准备
                      </h3>
                      <ul className="space-y-2">
                        {preparationGuide.projectPreparation.map((item, idx) => (
                          <li key={idx} className="group flex items-start gap-2.5 text-[13px] text-gray-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-2.5" />
                            <EditableText multiline value={item} onCommit={(v) => commitJson('preparationGuide', { ...preparationGuide, projectPreparation: preparationGuide.projectPreparation.map((it, j) => (j === idx ? v : it)) })} placeholder="项目准备建议" className="flex-1 text-[13px] text-gray-600 mt-0.5" />
                            <button onClick={() => commitJson('preparationGuide', { ...preparationGuide, projectPreparation: preparationGuide.projectPreparation.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 flex-shrink-0 mt-1"><X className="w-3.5 h-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                      <button onClick={() => commitJson('preparationGuide', { ...preparationGuide, projectPreparation: [...preparationGuide.projectPreparation, ''] })} className="mt-2 text-[12px] text-blue-500 hover:text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />添加项目准备</button>
                    </div>

                    {/* 简历优化 */}
                    <div className="border-t border-gray-50 pt-4">
                      <h3 className="text-[14px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-600 text-[10px] flex items-center justify-center font-bold">简</span>
                        简历优化
                      </h3>
                      <ul className="space-y-2">
                        {preparationGuide.resumeOptimization.map((item, idx) => (
                          <li key={idx} className="group flex items-start gap-2.5 text-[13px] text-gray-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-2.5" />
                            <EditableText multiline value={item} onCommit={(v) => commitJson('preparationGuide', { ...preparationGuide, resumeOptimization: preparationGuide.resumeOptimization.map((it, j) => (j === idx ? v : it)) })} placeholder="简历优化建议" className="flex-1 text-[13px] text-gray-600 mt-0.5" />
                            <button onClick={() => commitJson('preparationGuide', { ...preparationGuide, resumeOptimization: preparationGuide.resumeOptimization.filter((_, j) => j !== idx) })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 flex-shrink-0 mt-1"><X className="w-3.5 h-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                      <button onClick={() => commitJson('preparationGuide', { ...preparationGuide, resumeOptimization: [...preparationGuide.resumeOptimization, ''] })} className="mt-2 text-[12px] text-purple-500 hover:text-purple-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />添加简历优化</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </motion.div>
      )}
      {page === 'progress' && (
        <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
          {/* Interview Progress - multi-round tracking */}
          <motion.div {...fadeUp(0.18)} className="bg-white rounded-2xl p-6 border border-black/5">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <ListChecks className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-[17px] font-semibold">面试进度</h2>
              {rounds.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[12px] font-medium">{rounds.length} 轮</span>
              )}
            </div>

            {rounds.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-[13px] mb-4">暂无面试记录，添加第一轮开始记录</p>
                <button
                  onClick={addRound}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium text-indigo-600 border border-indigo-100 hover:bg-indigo-50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  添加第一轮
                </button>
              </div>
            ) : (
              <>
                {/* Round tab strip */}
                <div className="flex items-center gap-1.5 flex-wrap mb-5 pb-4 border-b border-gray-50">
                  {rounds.map((round) => {
                    const rs = roundStatusConfig[round.status] || roundStatusConfig.pending;
                    const active = round.id === activeRound?.id;
                    return (
                      <button
                        key={round.id}
                        onClick={() => setActiveRoundId(round.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
                          active ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-50 text-gray-500 border-transparent hover:text-gray-700'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                        <span>{round.name}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={addRound}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-medium text-indigo-600 border border-dashed border-indigo-200 hover:bg-indigo-50 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加
                  </button>
                </div>

                {/* Active round panel */}
                {activeRound && (
                  <AnimatePresence mode="wait">
                    <motion.div key={activeRound.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-4">
                      {/* Name + status + date */}
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          value={activeRound.name}
                          onChange={(e) => setRoundField(activeRound.id, { name: e.target.value })}
                          onBlur={flushRounds}
                          className="text-[15px] font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none w-32"
                        />
                        <div className="flex items-center gap-1.5">
                          {roundStatusOrder.map((st) => {
                            const cfg = roundStatusConfig[st];
                            const isActive = activeRound.status === st;
                            return (
                              <button
                                key={st}
                                onClick={() => updateRoundStatus(activeRound.id, st)}
                                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-all ${
                                  isActive ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                                }`}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="datetime-local"
                            value={activeRound.date || ''}
                            onChange={(e) => setRoundField(activeRound.id, { date: e.target.value })}
                            onBlur={flushRounds}
                            className="text-[12px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 focus:border-indigo-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Asked questions */}
                      <div>
                        <div className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">被问问题</div>
                        {activeRound.questions.length > 0 && (
                          <ul className="space-y-3 mb-2">
                            {activeRound.questions.map((q, qIdx) => (
                              <li key={qIdx} className="group rounded-xl border border-gray-100 p-3">
                                <div className="flex items-start gap-2.5 text-[13px] text-gray-800">
                                  <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-500 text-[11px] flex items-center justify-center font-medium flex-shrink-0 mt-0.5">{qIdx + 1}</span>
                                  <textarea
                                    value={q.question}
                                    rows={1}
                                    placeholder="被问到的问题"
                                    onChange={(e) => {
                                      setQuestionText(activeRound.id, qIdx, e.target.value);
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    onBlur={flushRounds}
                                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                                    className="flex-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none text-[13px] font-medium text-gray-800 resize-none leading-relaxed py-0.5 overflow-hidden"
                                  />
                                  <button onClick={() => removeQuestion(activeRound.id, qIdx)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0 mt-0.5" title="删除此问题">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="ml-7 mt-2 flex items-start gap-2">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium flex-shrink-0 mt-1.5">答</span>
                                  <textarea
                                    value={q.answer || ''}
                                    rows={1}
                                    placeholder="填写你的回答 / 思路…"
                                    onChange={(e) => {
                                      setQuestionAnswer(activeRound.id, qIdx, e.target.value);
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    onBlur={flushRounds}
                                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                                    className="flex-1 bg-gray-50 rounded-lg border border-gray-100 focus:border-indigo-400 focus:bg-white focus:outline-none px-3 py-1.5 text-[13px] text-gray-600 resize-none leading-relaxed overflow-hidden transition-all"
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            value={questionDrafts[activeRound.id] || ''}
                            onChange={(e) => setQuestionDrafts(prev => ({ ...prev, [activeRound.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuestion(activeRound.id); } }}
                            placeholder="记录一道被问到的问题，回车添加"
                            className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 focus:border-indigo-400 focus:bg-white focus:outline-none text-[13px] transition-all"
                          />
                          <button onClick={() => addQuestion(activeRound.id)} className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors flex-shrink-0">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Feedback */}
                      <div>
                        <div className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">复盘反馈</div>
                        <textarea
                          value={activeRound.feedback || ''}
                          onChange={(e) => setRoundField(activeRound.id, { feedback: e.target.value })}
                          onBlur={flushRounds}
                          placeholder="这一轮的表现复盘、待改进点、对方关注的方向..."
                          className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 focus:border-indigo-400 focus:bg-white focus:outline-none min-h-[72px] resize-none text-[13px] transition-all"
                        />
                      </div>

                      {/* Delete round */}
                      <div className="flex justify-end">
                        {confirmDeleteRoundId === activeRound.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-gray-500">确定删除本轮？</span>
                            <button onClick={() => removeRound(activeRound.id)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-medium hover:bg-red-600 transition-all">确认</button>
                            <button onClick={() => setConfirmDeleteRoundId(null)} className="px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 text-[12px] transition-all">取消</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteRoundId(activeRound.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-red-500 hover:bg-red-50 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                            删除本轮
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </>
            )}
          </motion.div>
          {/* AI Interview Guide */}
          {job.aiInterviewGuide && (
            <motion.div {...fadeUp(0.1)} className="relative overflow-hidden rounded-2xl p-6 border" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)', borderColor: 'rgba(99,102,241,0.15)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-[16px] font-semibold">AI 面试建议</h2>
                <button onClick={handleReparse} disabled={reparsing} className="ml-auto w-7 h-7 rounded-lg bg-white/60 hover:bg-white flex items-center justify-center transition-colors disabled:opacity-50" title="重新解析">
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${reparsing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">
                {job.aiInterviewGuide}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
      {page === 'images' && (
        <motion.div key="images" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">
          <motion.div {...fadeUp(0.1)} className="bg-white rounded-2xl p-6 border border-black/5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-gray-600" />
                </div>
                <h2 className="text-[17px] font-semibold">JD 原图</h2>
                {jdImages.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[12px] font-medium">{jdImages.length} 张</span>
                )}
              </div>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium text-blue-600 border border-blue-100 hover:bg-blue-50 transition-all"
              >
                <Upload className="w-4 h-4" />
                上传图片
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  const urls = await filesToDataUrls(files);
                  addImages(urls);
                  e.target.value = '';
                }}
              />
            </div>

            {jdImages.length === 0 ? (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-12 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
              >
                <ImageIcon className="w-8 h-8 opacity-50" />
                <span className="text-[13px]">点击上传，或在本页直接粘贴截图（⌘V）</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {jdImages.map((src, idx) => (
                  <div key={idx} className="group relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                    <img src={src} alt={`JD 原图 ${idx + 1}`} onClick={() => setLightbox(src)} className="w-full h-40 object-cover cursor-zoom-in" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/90 shadow border border-gray-200 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:border-red-200"
                      title="删除此图"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[12px] text-gray-400 mt-3">支持点击上传、或在本页直接粘贴截图（⌘V）。图片随岗位本地保存，点击可放大。</p>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-zoom-out">
          <img src={lightbox} alt="JD 原图" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
