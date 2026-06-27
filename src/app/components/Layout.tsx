import { Link, Outlet, useLocation } from 'react-router';
import { Briefcase, LayoutDashboard, Settings, Plus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: '仪表盘' },
    { path: '/jobs', icon: Briefcase, label: '岗位' },
    { path: '/settings/ai-config', icon: Settings, label: 'AI 设置' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8faf9 0%, #f1f6f4 100%)' }}>
      {/* 单个极淡青绿光晕，轻盈不喧宾夺主 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-48 -right-32 w-[28rem] h-[28rem] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />
      </div>

      <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px) saturate(180%)', borderColor: 'rgba(0,0,0,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-10">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}>
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col -space-y-0.5">
                  <span className="font-semibold text-[16px] tracking-tight">JobPilot</span>
                  <span className="text-[10px] text-gray-400 tracking-widest uppercase">求职助手</span>
                </div>
              </Link>

              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path ||
                    (item.path === '/jobs' && location.pathname.startsWith('/jobs'));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'text-emerald-600'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-xl"
                          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.13) 0%, rgba(20,184,166,0.08) 100%)' }}
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                        />
                      )}
                      <Icon className="w-4 h-4 relative z-10" />
                      <span className="text-[14px] font-medium relative z-10">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="nav-dot"
                          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            <Link
              to="/jobs/new"
              className="flex items-center gap-2 px-5 py-2 rounded-full text-white text-[14px] font-medium shadow-lg hover:shadow-emerald-200 hover:-translate-y-0.5 transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }}
            >
              <Plus className="w-4 h-4" />
              <span>添加岗位</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
