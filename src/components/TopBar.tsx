import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  MORE_NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
  isSecondaryTabActive,
} from '../lib/pillars.ts';

export type WorkspaceTab =
  | 'dashboard'
  | 'curriculum'
  | 'school'
  | 'entrance'
  | 'exams'
  | 'explore'
  | 'community'
  | 'daily-practice'
  | 'question-bank'
  | 'rbac'
  | 'institutions'
  | 'admin'
  | 'schema';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenAuth: () => void;
}

export function TopBar({ activeTab, onSelectTab, onOpenAuth }: TopBarProps) {
  const { user, loading } = useAuth();
  const displayName = user?.profile?.fullName || user?.email || 'Account';

  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const secondaryActive = isSecondaryTabActive(activeTab);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (tab: WorkspaceTab) => {
    setMoreOpen(false);
    setMobileMenuOpen(false);
    onSelectTab(tab);
  };

  const secondaryItems = MORE_NAV_ITEMS.filter((i) => i.group === 'secondary');
  const governanceItems = MORE_NAV_ITEMS.filter((i) => i.group === 'governance');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleSelect('curriculum');
            }}
            className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-700 text-xs font-extrabold text-white"
              aria-hidden="true"
            >
              HE
            </span>
            <span>Hamro Education</span>
          </a>

          {/* Zone 2: Primary Desktop Links (5 concise links + More menu) */}
          <nav
            aria-label="Primary workspace navigation"
            className="hidden lg:flex items-center gap-6"
          >
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 ${
                    isActive
                      ? 'text-slate-900 font-semibold after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[2px] after:bg-red-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <div className="relative" ref={moreRef}>
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((v) => !v)}
                className={`relative inline-flex items-center gap-1 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 ${
                  secondaryActive
                    ? 'text-slate-900 font-semibold after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[2px] after:bg-red-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>More</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  aria-label="Additional learning and governance sections"
                  className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                >
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Practice &amp; Syllabus
                  </div>
                  {secondaryItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleSelect(item.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? 'bg-red-50 text-red-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{item.label}</div>
                          <div className="text-[11px] text-slate-500">{item.description}</div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}

                  <div className="my-1.5 border-t border-slate-100" />
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Institutions &amp; Governance
                  </div>
                  {governanceItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleSelect(item.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? 'bg-red-50 text-red-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{item.label}</div>
                          <div className="text-[11px] text-slate-500">{item.description}</div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {user && <UserCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />}
              <span className="max-w-[110px] sm:max-w-[160px] truncate">
                {loading ? 'Loading...' : user ? displayName : 'Sign In'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="flex h-full w-full max-w-xs flex-col bg-white shadow-xl border-l border-slate-200">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-display text-base font-bold text-slate-900">
                Hamro Education
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Core Workspace
                </p>
                <div className="space-y-1">
                  {PRIMARY_NAV_ITEMS.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-red-50 text-red-800 font-semibold'
                            : 'text-slate-800 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <div>
                          <div>{item.label}</div>
                          <div className="text-[11px] font-normal text-slate-500">
                            {item.description}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-40 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Practice &amp; Syllabus
                </p>
                <div className="space-y-1">
                  {secondaryItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-red-50 text-red-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span>{item.label}</span>
                        <ArrowRight className="h-4 w-4 opacity-40 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Institutions &amp; Governance
                </p>
                <div className="space-y-1">
                  {governanceItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-red-50 text-red-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span>{item.label}</span>
                        <ArrowRight className="h-4 w-4 opacity-40 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {user ? `Account · ${displayName}` : 'Sign In or Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
