import { useEffect, useRef } from 'react';
import {
  Award,
  BookMarked,
  CalendarCheck,
  Flame,
  Layers,
  LayoutDashboard,
} from 'lucide-react';

export type StudentSectionId =
  | 'overview'
  | 'mistakes'
  | 'daily'
  | 'flashcards'
  | 'planner'
  | 'leaderboard';

interface StudentSubNavProps {
  active: StudentSectionId;
  onNavigate: (path: string) => void;
  unresolvedMistakes?: number;
  dueFlashcards?: number;
}

const ITEMS: Array<{
  id: StudentSectionId;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'mistakes', label: 'Mistake Book', path: '/dashboard/mistakes', icon: BookMarked },
  { id: 'daily', label: 'Daily Challenge', path: '/practice/daily', icon: Flame },
  { id: 'flashcards', label: 'Flashcards', path: '/dashboard/flashcards', icon: Layers },
  { id: 'planner', label: 'Study Planner', path: '/dashboard/planner', icon: CalendarCheck },
  { id: 'leaderboard', label: 'Badges & Leaderboard', path: '/dashboard/leaderboard', icon: Award },
];

export function StudentSubNav({
  active,
  onNavigate,
  unresolvedMistakes,
  dueFlashcards,
}: StudentSubNavProps) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = activeButtonRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
    }
  }, [active]);

  return (
    <nav
      aria-label="Student learning workspace sections"
      className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        const count =
          item.id === 'mistakes' && typeof unresolvedMistakes === 'number' && unresolvedMistakes > 0
            ? unresolvedMistakes
            : item.id === 'flashcards' && typeof dueFlashcards === 'number' && dueFlashcards > 0
              ? dueFlashcards
              : null;

        return (
          <button
            key={item.id}
            ref={isActive ? activeButtonRef : undefined}
            type="button"
            onClick={() => onNavigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-red-400' : 'text-slate-500'}`} aria-hidden="true" />
            <span>{item.label}</span>
            {count !== null && (
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  isActive ? 'text-red-300' : 'text-red-700'
                }`}
              >
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
