import type { WorkspaceTab } from '../components/TopBar.tsx';

export type PillarId = 'learn' | 'practice' | 'test' | 'improve' | 'discover';

export interface LearningPillarMeta {
  id: PillarId;
  label: string;
  headline: string;
  description: string;
  route: string;
  ctaLabel: string;
  iconBgClass: string;
  iconTextClass: string;
  accentTextClass: string;
  borderHoverClass: string;
}

export const LEARNING_PILLARS: LearningPillarMeta[] = [
  {
    id: 'learn',
    label: 'Learn',
    headline: 'Class 10–12 Notes & Formulas',
    description:
      'CDC & NEB chapter notes, bilingual English/Nepali concepts, formula sheets, and solved board examples.',
    route: '/school/class-10',
    ctaLabel: 'Open School Notes',
    iconBgClass: 'bg-red-50',
    iconTextClass: 'text-red-700',
    accentTextClass: 'text-red-700',
    borderHoverClass: 'hover:border-red-300',
  },
  {
    id: 'practice',
    label: 'Practice',
    headline: 'Daily Challenge & Q-Bank',
    description:
      'Build daily streaks with 5-question drills, Question of the Day, and topic-filtered practice sets.',
    route: '/practice/daily',
    ctaLabel: 'Start Daily Drill',
    iconBgClass: 'bg-amber-50',
    iconTextClass: 'text-amber-700',
    accentTextClass: 'text-amber-800',
    borderHoverClass: 'hover:border-amber-300',
  },
  {
    id: 'test',
    label: 'Test',
    headline: 'Timed Mock Examinations',
    description:
      'Simulate SEE, NEB +2, IOE, MECEE-BL, CMAT, and BSc CSIT with countdowns and negative marking.',
    route: '/exams',
    ctaLabel: 'Enter Exam Hall',
    iconBgClass: 'bg-blue-50',
    iconTextClass: 'text-blue-700',
    accentTextClass: 'text-blue-700',
    borderHoverClass: 'hover:border-blue-300',
  },
  {
    id: 'improve',
    label: 'Improve',
    headline: 'Mistake Book & Weak Topics',
    description:
      'Auto-track missed answers, reattempt mistakes until resolved, and drill weak topics under 60%.',
    route: '/dashboard',
    ctaLabel: 'Open Mastery Hub',
    iconBgClass: 'bg-emerald-50',
    iconTextClass: 'text-emerald-700',
    accentTextClass: 'text-emerald-700',
    borderHoverClass: 'hover:border-emerald-300',
  },
  {
    id: 'discover',
    label: 'Discover',
    headline: 'Entrances, Colleges & Aid',
    description:
      'Compare TU, KU, PU & Purbanchal bachelor programs, fees, entrance dates, and verified scholarships.',
    route: '/explore/courses',
    ctaLabel: 'Explore Pathways',
    iconBgClass: 'bg-teal-50',
    iconTextClass: 'text-teal-700',
    accentTextClass: 'text-teal-800',
    borderHoverClass: 'hover:border-teal-300',
  },
];

export interface QuickTrackItem {
  id: string;
  label: string;
  subtitle: string;
  route: string;
  pillar: PillarId;
}

export const NEPAL_QUICK_TRACKS: QuickTrackItem[] = [
  {
    id: 'see-10',
    label: 'Class 10 / SEE',
    subtitle: 'Compulsory & Opt Math, Science, CS',
    route: '/school/class-10',
    pillar: 'learn',
  },
  {
    id: 'neb-11',
    label: 'Class 11 NEB',
    subtitle: 'Science, Management, Humanities',
    route: '/school/class-11',
    pillar: 'learn',
  },
  {
    id: 'neb-12',
    label: 'Class 12 NEB',
    subtitle: 'Board Prep & Bachelor Bridge',
    route: '/school/class-12',
    pillar: 'learn',
  },
  {
    id: 'entrance-prep',
    label: 'Bachelor Entrances',
    subtitle: 'IOE · MECEE-BL · CMAT · BSc CSIT',
    route: '/entrance',
    pillar: 'discover',
  },
];

export interface NavDestination {
  id: WorkspaceTab;
  label: string;
  group: 'primary' | 'secondary' | 'governance';
  description: string;
}

export const PRIMARY_NAV_ITEMS: NavDestination[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'primary', description: 'Next action & weak topics' },
  { id: 'school', label: 'School', group: 'primary', description: 'Class 10–12 notes & formulas' },
  { id: 'entrance', label: 'Entrance', group: 'primary', description: 'IOE, MECEE-BL, CMAT, CSIT' },
  { id: 'exams', label: 'Exams', group: 'primary', description: 'Timed mock examinations' },
  { id: 'explore', label: 'Explore', group: 'primary', description: 'Courses, colleges & scholarships' },
];

export const MORE_NAV_ITEMS: NavDestination[] = [
  { id: 'daily-practice', label: 'Daily Challenge', group: 'secondary', description: 'Streaks, QOTD & leaderboards' },
  { id: 'community', label: 'Community', group: 'secondary', description: 'Student Q&A and teacher tips' },
  { id: 'question-bank', label: 'Question Bank', group: 'secondary', description: 'Practice & review item bank' },
  { id: 'curriculum', label: 'Curriculum Tree', group: 'secondary', description: '9-tier CDC/NEB syllabus map' },
  { id: 'institutions', label: 'Institutions', group: 'governance', description: 'Partner schools & campuses' },
  { id: 'rbac', label: 'Roles & Access', group: 'governance', description: 'Role permissions overview' },
  { id: 'admin', label: 'Admin Console', group: 'governance', description: 'Platform governance & review' },
  { id: 'schema', label: 'Schema', group: 'governance', description: 'Relational data architecture' },
];

export function isSecondaryTabActive(activeTab: WorkspaceTab): boolean {
  return MORE_NAV_ITEMS.some((item) => item.id === activeTab);
}
