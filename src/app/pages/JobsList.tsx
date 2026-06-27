import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { jobsApi, ApplicationStatus, PreferenceLevel } from '../api/jobs';
import { Search, MapPin, Briefcase, ChevronRight, SlidersHorizontal, Plus, Trash2, X, LayoutGrid, List } from 'lucide-react';
import { motion } from 'motion/react';
import { CompanyAvatar } from '../components/CompanyAvatar';

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: EASE },
});

const statusConfig: Record<ApplicationStatus, { bg: string; text: string; dot: string; label: string }> = {
  not_applied: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: '待投递' },
  applied: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', label: '已投递' },
  resume_rejected: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-400', label: '简历未通过' },
  interviewing: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500', label: '面试中' },
  offer: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Offer' },
  withdrawn: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: '已撤回' },
  eliminated: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-300', label: '已淘汰' },
};

const preferenceConfig: Record<PreferenceLevel, { label: string; bg: string; text: string }> = {
  high: { label: '高意向', bg: 'bg-red-50', text: 'text-red-600' },
  medium: { label: '中意向', bg: 'bg-amber-50', text: 'text-amber-600' },
  low: { label: '低意向', bg: 'bg-gray-100', text: 'text-gray-500' },
  none: { label: '无意向', bg: 'bg-gray-50', text: 'text-gray-400' },
};

type ViewMode = 'card' | 'list';

export function JobsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [preferenceFilter, setPreferenceFilter] = useState<PreferenceLevel | 'all'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof jobsApi.getAll>>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('jobpilot.viewMode') as ViewMode) || 'card'
  );

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('jobpilot.viewMode', mode);
  };

  useEffect(() => {
    jobsApi.getAll().then(setJobs).catch(console.error);
  }, []);

  // Extract unique cities from jobs
  const cities = Array.from(new Set(
    jobs.map(j => j.location).filter(Boolean) as string[]
  )).sort();

  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.applicationStatus === statusFilter;
    const matchesPreference = preferenceFilter === 'all' || job.preferenceLevel === preferenceFilter;
    const matchesCity = cityFilter === 'all' || (job.location && job.location.includes(cityFilter));
    return matchesSearch && matchesStatus && matchesPreference && matchesCity;
  });

  const isDead = (s: string) => s === 'eliminated' || s === 'resume_rejected';
  const activeJobs = filteredJobs.filter(j => !isDead(j.applicationStatus));
  const eliminatedJobs = filteredJobs.filter(j => isDead(j.applicationStatus));

  const statusOptions: { value: ApplicationStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'not_applied', label: '待投递' },
    { value: 'applied', label: '已投递' },
    { value: 'resume_rejected', label: '简历未通过' },
    { value: 'interviewing', label: '面试中' },
    { value: 'offer', label: 'Offer' },
    { value: 'eliminated', label: '已淘汰' },
  ];

  const preferenceOptions: { value: PreferenceLevel | 'all'; label: string }[] = [
    { value: 'all', label: '全部意向' },
    { value: 'high', label: '高意向' },
    { value: 'medium', label: '中意向' },
    { value: 'low', label: '低意向' },
    { value: 'none', label: '无意向' },
  ];

  const handleDelete = async (jobId: string) => {
    try {
      await jobsApi.delete(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete job failed:', err);
    }
  };

  const JobCard = ({ job, isEliminated = false }: { job: any; isEliminated?: boolean }) => {
    const s = statusConfig[job.applicationStatus as ApplicationStatus];
    const pref = preferenceConfig[job.preferenceLevel as PreferenceLevel];
    const parsedKeywords = typeof job.keywords === 'string' ? JSON.parse(job.keywords) : (job.keywords || { tech: [], skills: [], softSkills: [] });

    return (
      <div className={`group relative block bg-white rounded-2xl border border-black/5 hover:border-black/10 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 overflow-hidden ${
        isEliminated ? 'opacity-45 hover:opacity-60' : ''
      }`}>
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{
          background: 'linear-gradient(90deg, #3b82f6, #6366f1)'
        }} />

        {/* Delete confirmation overlay */}
        {deleteConfirm === job.id && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
            <div className="text-center px-6">
              <p className="text-[14px] font-medium text-gray-800 mb-4">确定删除此岗位吗？</p>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(job.id); }}
                  className="px-5 py-2 rounded-xl bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm(null); }}
                  className="px-5 py-2 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        <Link
          to={`/jobs/${job.id}`}
          className="block p-5"
        >
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <CompanyAvatar name={job.company} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[15px] leading-tight truncate">{job.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-gray-500 text-[13px] truncate">{job.company}</p>
                      {job.companySize && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 flex-shrink-0">
                          {job.companySize}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Enhanced preference badge */}
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0 ${pref.bg} ${pref.text}`}>
                    {pref.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1.5 mb-4">
              {job.salary && (
                <div className="text-[14px] font-semibold text-emerald-600">{job.salary}</div>
              )}
              <div className="flex items-center gap-3 text-[12px] text-gray-500 flex-wrap">
                {job.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{job.location}</span>
                  </div>
                )}
                {job.experience && <span>{job.experience}</span>}
                {job.education && <span>{job.education}</span>}
              </div>
            </div>

            {/* Tech tags */}
            {parsedKeywords.tech && parsedKeywords.tech.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {parsedKeywords.tech.slice(0, 3).map((tag: string | { name: string }) => (
                  <span key={typeof tag === 'string' ? tag : tag.name} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[11px] font-medium">
                    {typeof tag === 'string' ? tag : tag.name}
                  </span>
                ))}
                {parsedKeywords.tech.length > 3 && (
                  <span className="px-2 py-0.5 rounded-md bg-gray-50 text-gray-500 text-[11px]">
                    +{parsedKeywords.tech.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">
                  {new Date(job.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>

            {/* Interview badge */}
            {job.interviewDate && new Date(job.interviewDate) > new Date() && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.08) 100%)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[12px] text-purple-600 font-medium">
                  面试：{new Date(job.interviewDate).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </Link>

        {/* Delete button - appears on hover */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm(job.id); }}
          className="absolute bottom-4 right-4 p-2 rounded-xl bg-white shadow-lg border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200 hover:text-red-500 group/btn"
          title="删除岗位"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const JobRow = ({ job, isEliminated = false }: { job: any; isEliminated?: boolean }) => {
    const s = statusConfig[job.applicationStatus as ApplicationStatus];
    const pref = preferenceConfig[job.preferenceLevel as PreferenceLevel];

    return (
      <div className={`group relative bg-white rounded-xl border border-black/5 hover:border-black/10 hover:shadow-md hover:shadow-black/5 transition-all duration-200 overflow-hidden ${
        isEliminated ? 'opacity-45 hover:opacity-60' : ''
      }`}>
        {/* Delete confirmation overlay */}
        {deleteConfirm === job.id && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-gray-800">确定删除此岗位吗？</span>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(job.id); }}
                className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-medium hover:bg-red-600 transition-colors"
              >
                删除
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm(null); }}
                className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[12px] font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <Link to={`/jobs/${job.id}`} className="flex items-center gap-4 px-4 py-3">
          <CompanyAvatar name={job.company} size="sm" />

          {/* Title + company */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[14px] leading-tight truncate">{job.title}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${pref.bg} ${pref.text}`}>
                {pref.label}
              </span>
            </div>
            <p className="text-gray-500 text-[12px] truncate mt-0.5">{job.company}</p>
          </div>

          {/* Salary */}
          <div className="hidden sm:block w-28 flex-shrink-0 text-[13px] font-semibold text-emerald-600 truncate">
            {job.salary || '—'}
          </div>

          {/* Location */}
          <div className="hidden md:flex items-center gap-1 w-28 flex-shrink-0 text-[12px] text-gray-500 truncate">
            {job.location && (
              <>
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{job.location}</span>
              </>
            )}
          </div>

          {/* Experience · Education · Company size */}
          <div className="hidden lg:block w-40 flex-shrink-0 text-[12px] text-gray-400 truncate">
            {[job.experience, job.education, job.companySize].filter(Boolean).join(' · ') || '—'}
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            <span className={`text-[12px] font-medium ${s.text} truncate`}>{s.label}</span>
          </div>

          {/* Date */}
          <span className="hidden lg:block w-14 flex-shrink-0 text-[11px] text-gray-400 text-right">
            {new Date(job.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
          </span>

          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </Link>

        {/* Delete button - appears on hover */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm(job.id); }}
          className="absolute top-1/2 -translate-y-1/2 right-12 p-1.5 rounded-lg bg-white shadow border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200 hover:text-red-500"
          title="删除岗位"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-end justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight mb-1">岗位管理</h1>
          <p className="text-gray-500 text-[14px]">共 {jobs.length} 个岗位，{activeJobs.length} 个进行中</p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => changeViewMode('card')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              viewMode === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="卡片视图"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">卡片</span>
          </button>
          <button
            onClick={() => changeViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="列表视图"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">列表</span>
          </button>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div {...fadeUp(0.05)} className="bg-white rounded-2xl p-4 border border-black/5 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索公司或岗位名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 rounded-xl border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none transition-all text-[14px] placeholder:text-gray-400"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center text-[11px]">×</button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-gray-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="text-[12px]">筛选</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                  statusFilter === option.value
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={statusFilter === option.value ? { background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' } : {}}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200 hidden md:block" />

          <div className="flex items-center gap-1.5 flex-wrap">
            {preferenceOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPreferenceFilter(option.value)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                  preferenceFilter === option.value
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={preferenceFilter === option.value ? { background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' } : {}}
              >
                {option.label}
              </button>
            ))}
          </div>

          {cities.length > 0 && (
            <>
              <div className="w-px h-5 bg-gray-200 hidden md:block" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="px-3 py-1 rounded-full text-[12px] font-medium bg-gray-100 text-gray-600 border-none outline-none cursor-pointer hover:bg-gray-200 transition-all"
                >
                  <option value="all">全部城市</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <motion.div {...fadeUp(0.1)}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[13px] text-gray-600 font-medium">进行中 · {activeJobs.length} 个</span>
          </div>
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeJobs.map((job, idx) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: idx * 0.04 }}>
                  <JobCard job={job} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {activeJobs.map((job, idx) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: idx * 0.02 }}>
                  <JobRow job={job} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Eliminated Jobs */}
      {eliminatedJobs.length > 0 && (
        <motion.div {...fadeUp(0.15)}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span className="text-[13px] text-gray-500 font-medium">已结束（淘汰/简历未通过）· {eliminatedJobs.length} 个</span>
          </div>
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {eliminatedJobs.map((job) => (
                <JobCard key={job.id} job={job} isEliminated />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {eliminatedJobs.map((job) => (
                <JobRow key={job.id} job={job} isEliminated />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Empty State */}
      {filteredJobs.length === 0 && (
        <motion.div {...fadeUp(0.1)} className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <Briefcase className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-[17px] font-semibold text-gray-700 mb-2">暂无匹配岗位</h3>
          <p className="text-gray-400 text-[14px] mb-6">试试调整筛选条件，或添加新的岗位</p>
          <Link
            to="/jobs/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-[14px] font-medium"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}
          >
            <Plus className="w-4 h-4" />
            添加岗位
          </Link>
        </motion.div>
      )}
    </div>
  );
}