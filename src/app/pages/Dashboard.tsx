import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { jobsApi } from '../api/jobs';
import type { Job } from '../api/jobs';
import { Briefcase, CheckCircle, TrendingUp, Calendar, ChevronRight, ArrowUpRight, XCircle, Send, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { CompanyAvatar } from '../components/CompanyAvatar';

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE },
});

export function Dashboard() {
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof jobsApi.getAll>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let first = true;
    const load = () => jobsApi.getAll()
      .then(data => { setJobs(data); if (first) { setLoading(false); first = false; } })
      .catch(() => setLoading(false));
    load();
    // 窗口重新聚焦时重算，保证跨页编辑/多实例下也"实时"
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  const recentJobs = jobs.slice(0, 5);

  const stats = {
    total: jobs.length,
    notApplied: jobs.filter(j => j.applicationStatus === 'not_applied').length,
    applied: jobs.filter(j => j.applicationStatus === 'applied').length,
    interviewing: jobs.filter(j => j.applicationStatus === 'interviewing').length,
    offer: jobs.filter(j => j.applicationStatus === 'offer').length,
  };

  const upcomingInterviews = jobs
    .filter(j => j.interviewDate && new Date(j.interviewDate) > new Date())
    .sort((a, b) => new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime())
    .slice(0, 3);

  // ─── 求职转化漏斗 ───
  const roundsCount = (j: Job) => {
    try { const a = j.interviewRounds ? JSON.parse(j.interviewRounds) : []; return Array.isArray(a) ? a.length : 0; }
    catch { return 0; }
  };
  const isOffered = (j: Job) => j.applicationStatus === 'offer';
  const isInterviewed = (j: Job) => isOffered(j) || j.applicationStatus === 'interviewing' || roundsCount(j) > 0;
  const isApplied = (j: Job) => isInterviewed(j) || j.applicationStatus !== 'not_applied';
  const reachedRounds = (j: Job) => Math.max(roundsCount(j), isInterviewed(j) ? 1 : 0);

  const total = jobs.length;
  const appliedCount = jobs.filter(isApplied).length;
  const maxRound = jobs.reduce((m, j) => Math.max(m, reachedRounds(j)), 0);
  const roundColors = ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'];

  const funnelStages: { label: string; value: number; color: string }[] = [
    { label: '已收录', value: total, color: '#3b82f6' },
    { label: '已投递', value: appliedCount, color: '#6366f1' },
    ...Array.from({ length: maxRound }, (_, i) => ({
      label: `第 ${i + 1} 轮`,
      value: jobs.filter(j => reachedRounds(j) >= i + 1).length,
      color: roundColors[Math.min(i, roundColors.length - 1)],
    })),
  ];

  const offerCount = stats.offer;
  // 终态：已淘汰/撤回，或"任一轮未通过"且未拿 Offer（即使粗状态没及时更新也计入）
  const hasFailedRound = (j: Job) => {
    try { const a = j.interviewRounds ? JSON.parse(j.interviewRounds) : []; return Array.isArray(a) && a.some((r: { status?: string }) => r?.status === 'failed'); }
    catch { return false; }
  };
  const isEnded = (j: Job) => j.applicationStatus === 'eliminated' || j.applicationStatus === 'resume_rejected' || j.applicationStatus === 'withdrawn' || (hasFailedRound(j) && !isOffered(j));

  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

  // 终态：按"进入一面"（reachedRounds>=1）人群对账：Offer + 未通过 + 进行中 = 进入一面数
  const interviewed = jobs.filter(j => reachedRounds(j) >= 1).length;
  const outOffer = jobs.filter(j => reachedRounds(j) >= 1 && isOffered(j)).length;
  const outFailed = jobs.filter(j => reachedRounds(j) >= 1 && !isOffered(j) && isEnded(j)).length;
  const outActive = interviewed - outOffer - outFailed;

  // 投递岗位类型 / 分城市 分布（仅统计"已投递及以后"的岗位）
  const appliedJobs = jobs.filter(isApplied);
  // 城市 + 区/县 粒度："深圳市南山区"→"深圳·南山区"，无区则只到市
  const cityOf = (loc?: string | null) => {
    if (!loc) return '未知';
    const known = ['北京', '上海', '天津', '重庆', '深圳', '广州', '杭州', '成都', '南京', '武汉', '西安', '苏州', '厦门', '长沙', '郑州', '青岛', '福州', '合肥', '东莞', '宁波', '无锡', '大连', '沈阳', '哈尔滨', '济南', '佛山', '长春', '昆明', '南昌'];
    let city = '';
    let rest = loc;
    for (const k of known) {
      const idx = loc.indexOf(k);
      if (idx >= 0) { city = k; rest = loc.slice(idx + k.length); break; }
    }
    if (!city) {
      const i = loc.indexOf('市');
      if (i > 0) { city = loc.slice(0, i); rest = loc.slice(i + 1); }
    }
    const dm = rest.match(/[一-龥]{1,8}?[区县]/);
    const district = dm ? dm[0].replace(/^市/, '') : '';
    if (city && district) return `${city}·${district}`;
    if (city) return city;
    return (loc.split(/[\s·,，/、]/)[0] || '').slice(0, 6) || '未知';
  };
  const tally = (arr: string[]): [string, number][] => {
    const m = new Map<string, number>();
    arr.forEach(x => m.set(x, (m.get(x) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const typeStats = tally(appliedJobs.map(j => (j.title?.trim() || '未命名')));
  const cityStats = tally(appliedJobs.map(j => cityOf(j.location)));
  const typeMax = Math.max(1, ...typeStats.map(s => s[1]));
  const cityMax = Math.max(1, ...cityStats.map(s => s[1]));

  // ─── 顶部整体指标（与漏斗互补：状态 + 行动 + 结果质量）───
  const activeCount = stats.applied + stats.interviewing; // 还在 pipeline 里的活跃机会
  const upcomingCount = jobs.filter(j => j.interviewDate && new Date(j.interviewDate) > new Date()).length;
  const nextInterview = upcomingInterviews[0];
  const offerRate = rate(offerCount, appliedCount); // Offer / 已投递
  const activeShare = rate(activeCount, total);

  const statCards: { label: string; value: number | string; icon: typeof Briefcase; gradient: string; light: string; iconColor: string; sub: string }[] = [
    {
      label: '进行中机会',
      value: activeCount,
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
      light: 'rgba(59,130,246,0.08)',
      iconColor: '#3b82f6',
      sub: activeShare !== null ? `占 ${activeShare}%` : '',
    },
    {
      label: '待投递',
      value: stats.notApplied,
      icon: Send,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
      light: 'rgba(245,158,11,0.08)',
      iconColor: '#f59e0b',
      sub: stats.notApplied > 0 ? '待处理' : '已清空',
    },
    {
      label: '近期面试',
      value: upcomingCount,
      icon: Calendar,
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      light: 'rgba(139,92,246,0.08)',
      iconColor: '#8b5cf6',
      sub: nextInterview?.interviewDate ? `最近 ${new Date(nextInterview.interviewDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}` : '',
    },
    {
      label: 'Offer 率',
      value: offerRate === null ? '—' : `${offerRate}%`,
      icon: CheckCircle,
      gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
      light: 'rgba(16,185,129,0.08)',
      iconColor: '#10b981',
      sub: `${offerCount} 个 Offer`,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-20 rounded-2xl animate-pulse bg-gray-100" />
        <div className="h-72 rounded-2xl animate-pulse bg-gray-100" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2].map(i => <div key={i} className="h-48 rounded-2xl animate-pulse bg-gray-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 概览 + 整体指标（融合为一张横向卡片） */}
      <motion.div {...fadeUp(0)} className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-black/5 p-5">
        <div className="flex flex-wrap items-center gap-y-4">
          <div className="pr-6 mr-4 border-r border-gray-100">
            <h1 className="text-[20px] font-semibold tracking-tight leading-tight">求职进度总览</h1>
            <p className="text-gray-400 text-[12px] mt-0.5">共 {stats.total} 个跟踪岗位</p>
          </div>
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-y-4 min-w-[260px]">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: stat.light }}>
                    <Icon className="w-5 h-5" style={{ color: stat.iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[22px] font-semibold leading-none text-gray-900">{stat.value}</div>
                    <div className="text-[12px] text-gray-500 mt-1 truncate">{stat.label}{stat.sub ? ` · ${stat.sub}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* 求职转化漏斗 */}
      <motion.div {...fadeUp(0.25)} className="bg-gradient-to-br from-sky-50 to-white rounded-2xl p-6 border border-black/5">
        <h2 className="text-[16px] font-semibold mb-1">求职转化漏斗</h2>
        <p className="text-gray-400 text-[12px] mb-5">各阶段转化率，逐级落差即卡点</p>

        {total > 0 ? (
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            {/* 漏斗主干 */}
            <div className="lg:col-span-2 space-y-0.5">
              {funnelStages.map((stage, idx) => {
                const widthPct = total > 0 ? (stage.value / total) * 100 : 0;
                const conv = idx > 0 ? rate(stage.value, funnelStages[idx - 1].value) : null;
                const action = idx === 1 ? '去投了' : idx === 2 ? '拿到面试' : '过了这轮';
                const prev = idx > 0 ? funnelStages[idx - 1].value : 0;
                const lowFlag = idx >= 2 && conv !== null && prev >= 3 && conv < (idx === 2 ? 40 : 50);
                const tip = idx === 2 ? '简历/投递没打动' : '现场要复盘';
                return (
                  <div key={stage.label}>
                    {idx > 0 && (
                      <div className="flex items-center gap-2 py-1 pl-[3.75rem] text-[11px] text-gray-400">
                        <span className="font-semibold text-gray-500">↓ {conv === null ? '—' : `${conv}%`}</span>
                        <span>{action}</span>
                        {lowFlag && <span className="text-amber-500">偏少？{tip}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-500 w-12 flex-shrink-0">{stage.label}</span>
                      <div className="flex-1 h-6 rounded-lg bg-gray-50 overflow-hidden">
                        <div className="h-full rounded-lg transition-all" style={{ width: `${Math.max(widthPct, 5)}%`, background: stage.color }} />
                      </div>
                      <span className="text-[14px] font-semibold text-gray-800 w-6 text-right flex-shrink-0">{stage.value}</span>
                    </div>
                  </div>
                );
              })}
              {maxRound === 0 && (
                <p className="text-[12px] text-gray-400 pt-3 pl-1">尚无面试记录——在岗位「面试进度」记录轮次后，这里会展示各轮卡点</p>
              )}
            </div>

            {/* 终态：按"进入一面"对账 */}
            <div className="mt-5 pt-5 border-t border-gray-50 lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:border-gray-100 lg:pl-8">
              <div className="text-[11px] text-gray-400 mb-3"><span className="font-semibold text-gray-600">{interviewed}</span> 个岗位进入面试环节，最终结果分布：</div>
              <div className="space-y-2">
                {[
                  { Icon: CheckCircle, color: 'text-emerald-500', val: outOffer, label: '拿到 Offer' },
                  { Icon: XCircle, color: 'text-red-400', val: outFailed, label: '未通过' },
                  { Icon: Clock, color: 'text-amber-500', val: outActive, label: '进行中' },
                ].map(o => (
                  <div key={o.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50/70">
                    <o.Icon className={`w-4 h-4 flex-shrink-0 ${o.color}`} />
                    <span className="text-[16px] font-semibold text-gray-800 w-6">{o.val}</span>
                    <span className="text-[12px] text-gray-500">{o.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-36 flex items-center justify-center text-gray-400 text-[14px]">暂无数据</div>
        )}
      </motion.div>

      {/* 投递岗位类型 + 分城市 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <motion.div {...fadeUp(0.3)} className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-6 border border-black/5">
          <h2 className="text-[16px] font-semibold mb-1">投递岗位类型</h2>
          <p className="text-gray-500 text-[13px] mb-4">已投递岗位按岗位名称分布</p>
          {typeStats.length > 0 ? (
            <div className="space-y-2.5">
              {typeStats.map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-[13px] text-gray-600 w-28 truncate flex-shrink-0" title={name}>{name}</span>
                  <div className="flex-1 h-5 rounded-lg bg-gray-50 overflow-hidden">
                    <div className="h-full rounded-lg bg-blue-400" style={{ width: `${(count / typeMax) * 100}%` }} />
                  </div>
                  <span className="text-[13px] font-semibold text-gray-800 w-6 text-right flex-shrink-0">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-28 flex items-center justify-center text-gray-400 text-[13px]">暂无已投递岗位</div>
          )}
        </motion.div>

        <motion.div {...fadeUp(0.32)} className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-6 border border-black/5">
          <h2 className="text-[16px] font-semibold mb-1">分城市投递</h2>
          <p className="text-gray-500 text-[13px] mb-4">已投递岗位按城市·区分布</p>
          {cityStats.length > 0 ? (
            <div className="space-y-2.5">
              {cityStats.map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-[13px] text-gray-600 w-28 truncate flex-shrink-0" title={name}>{name}</span>
                  <div className="flex-1 h-5 rounded-lg bg-gray-50 overflow-hidden">
                    <div className="h-full rounded-lg bg-emerald-400" style={{ width: `${(count / cityMax) * 100}%` }} />
                  </div>
                  <span className="text-[13px] font-semibold text-gray-800 w-6 text-right flex-shrink-0">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-28 flex items-center justify-center text-gray-400 text-[13px]">暂无已投递岗位</div>
          )}
        </motion.div>
      </div>

      {/* 近期面试 + 最近添加 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Interviews */}
        <motion.div {...fadeUp(0.35)} className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-6 border border-black/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[16px] font-semibold">近期面试</h2>
              <p className="text-gray-500 text-[13px]">{upcomingInterviews.length} 场待面试</p>
            </div>
            <Link to="/jobs" className="flex items-center gap-1 text-blue-600 text-[13px] hover:text-blue-700">
              全部岗位 <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {upcomingInterviews.length > 0 ? (
            <div className="space-y-3">
              {upcomingInterviews.map((job, idx) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="group flex items-center gap-4 p-4 rounded-xl hover:bg-purple-50/60 transition-all border border-transparent hover:border-purple-100"
                >
                  <CompanyAvatar name={job.company} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[14px] truncate">{job.title}</div>
                    <div className="text-gray-500 text-[12px]">{job.company}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-purple-600 text-[12px] font-medium">
                      {new Date(job.interviewDate!).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-gray-500 text-[11px]">
                      {new Date(job.interviewDate!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-purple-300" />
              </div>
              <p className="text-gray-400 text-[14px]">暂无近期面试安排</p>
            </div>
          )}
        </motion.div>

        {/* Recent Jobs */}
        <motion.div {...fadeUp(0.4)} className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-[16px] font-semibold">最近添加</h2>
            <p className="text-gray-500 text-[13px]">最新收录的 {recentJobs.length} 个岗位</p>
          </div>
          <Link
            to="/jobs"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 text-[13px] transition-all"
          >
            查看全部 <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-gray-50">
          {recentJobs.map((job, idx) => {
            const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
              not_applied: { bg: 'bg-slate-100', text: 'text-slate-600', label: '待投递' },
              applied: { bg: 'bg-blue-50', text: 'text-blue-600', label: '已投递' },
              resume_rejected: { bg: 'bg-rose-50', text: 'text-rose-600', label: '简历未通过' },
              interviewing: { bg: 'bg-purple-50', text: 'text-purple-600', label: '面试中' },
              offer: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Offer' },
              withdrawn: { bg: 'bg-gray-100', text: 'text-gray-600', label: '已撤回' },
              eliminated: { bg: 'bg-gray-100', text: 'text-gray-500', label: '已淘汰' },
            };
            const s = statusConfig[job.applicationStatus];
            const preferenceColors: Record<string, string> = {
              high: 'text-red-500',
              medium: 'text-yellow-500',
              low: 'text-gray-400',
              none: 'text-gray-300',
            };

            return (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="group flex items-center gap-4 px-6 py-4 hover:bg-gray-50/80 transition-colors"
              >
                <CompanyAvatar name={job.company} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-[14px]">{job.title}</span>
                    {job.preferenceLevel === 'high' && <span className="text-[10px] text-red-500">●</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-gray-500">
                    <span>{job.company}</span>
                    {job.salary && <><span className="text-gray-300">·</span><span className="text-green-600 font-medium">{job.salary}</span></>}
                    {job.location && <><span className="text-gray-300">·</span><span>{job.location}</span></>}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[12px] font-medium ${s.bg} ${s.text}`}>
                  {s.label}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      </motion.div>
      </div>
    </div>
  );
}
