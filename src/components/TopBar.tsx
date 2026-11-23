import { useAuth } from '../context/AuthContext.tsx';

export type WorkspaceTab = 'curriculum' | 'rbac' | 'institutions' | 'schema';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenAuth: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'rbac', label: 'Access & Roles' },
  { id: 'institutions', label: 'Institutions' },
  { id: 'schema', label: 'Schema' },
];

export function TopBar({ activeTab, onSelectTab, onOpenAuth }: TopBarProps) {
  const { user, loading } = useAuth();
  const displayName = user?.profile?.fullName || user?.email || 'Account';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-8 px-6 py-3.5">
        <a
          href="#curriculum"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('curriculum');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          Hamro Education
        </a>

        <nav
          aria-label="Primary workspace navigation"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'text-slate-900 after:absolute after:inset-x-0 after:-bottom-[15px] after:h-[2px] after:bg-red-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {loading ? 'Loading...' : user ? displayName : 'Sign In'}
          </button>
        </div>
      </div>

      {/* Mobile secondary nav strip keeping sticky height compact */}
      <nav
        aria-label="Mobile workspace navigation"
        className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 px-2 py-1 rounded ${
                isActive
                  ? 'text-red-700 bg-red-50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
