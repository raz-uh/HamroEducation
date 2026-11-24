import {
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  Compass,
  GitCompare,
} from 'lucide-react';

export type ExploreSectionId =
  | 'courses'
  | 'compare'
  | 'colleges'
  | 'scholarships'
  | 'careers'
  | 'opportunities';

interface ExploreNavBarProps {
  active: ExploreSectionId;
  onNavigate: (path: string) => void;
}

const EXPLORE_TABS: Array<{
  id: ExploreSectionId;
  label: string;
  route: string;
}> = [
  { id: 'courses', label: 'Courses', route: '/explore/courses' },
  { id: 'compare', label: 'Compare Courses', route: '/explore/courses/compare' },
  { id: 'colleges', label: 'Colleges', route: '/explore/colleges' },
  { id: 'scholarships', label: 'Scholarships', route: '/explore/scholarships' },
  { id: 'careers', label: 'Career Roadmaps', route: '/explore/careers' },
  { id: 'opportunities', label: 'Opportunities & Calendar', route: '/explore/opportunities' },
];

export function ExploreNavBar({ active, onNavigate }: ExploreNavBarProps) {
  return (
    <nav
      aria-label="Higher education and career explorer sections"
      className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5"
    >
      {EXPLORE_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.route)}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.id === 'courses' && <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
            {tab.id === 'compare' && <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />}
            {tab.id === 'colleges' && <Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {tab.id === 'scholarships' && <Award className="h-3.5 w-3.5" aria-hidden="true" />}
            {tab.id === 'careers' && <Compass className="h-3.5 w-3.5" aria-hidden="true" />}
            {tab.id === 'opportunities' && (
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
