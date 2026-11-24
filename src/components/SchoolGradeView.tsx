import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  GraduationCap,
  ListChecks,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { canStudentViewResourceStatus } from '../lib/router.ts';
import type {
  BachelorBridgeResponse,
  BookmarkItem,
  SchoolGradeOverviewResponse,
  SchoolResourceItem,
  SchoolStreamSummary,
  SchoolSubjectSummary,
} from '../types/api.ts';

interface SchoolGradeViewProps {
  gradeSlug: 'class-10' | 'see' | 'class-11' | 'class-12';
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

type ResourceModeId =
  | 'all'
  | 'notes'
  | 'mcqs'
  | 'short'
  | 'long'
  | 'numericals'
  | 'model_question'
  | 'past_paper'
  | 'chapter_test'
  | 'mock_test'
  | 'revision'
  | 'planner';

const RESOURCE_MODES: Array<{
  id: ResourceModeId;
  label: string;
  readerTab?: string;
}> = [
  { id: 'all', label: 'Overview & Subjects' },
  { id: 'notes', label: 'Chapter Notes', readerTab: 'notes' },
  { id: 'mcqs', label: 'MCQs', readerTab: 'practice' },
  { id: 'short', label: 'Short Questions', readerTab: 'practice' },
  { id: 'long', label: 'Long Questions', readerTab: 'practice' },
  { id: 'numericals', label: 'Numericals', readerTab: 'practice' },
  { id: 'model_question', label: 'Model Questions' },
  { id: 'past_paper', label: 'Past Papers' },
  { id: 'chapter_test', label: 'Chapter Tests', readerTab: 'test' },
  { id: 'mock_test', label: 'Full Mock Tests' },
  { id: 'revision', label: 'Revision Materials', readerTab: 'revision' },
  { id: 'planner', label: 'Study Planner' },
];

type OptionalComboId = 'all' | 'stem' | 'commerce' | 'math_eco';

const OPTIONAL_COMBOS: Array<{
  id: OptionalComboId;
  label: string;
  codes: string[];
  description: string;
}> = [
  {
    id: 'all',
    label: 'All Optional Subjects',
    codes: ['OPT-MATH-10', 'OPT-CSC-10', 'OPT-ACC-10', 'OPT-ECO-10'],
    description: 'Browse every CDC Optional Group I & II subject.',
  },
  {
    id: 'stem',
    label: 'Opt Math + Computer Science',
    codes: ['OPT-MATH-10', 'OPT-CSC-10'],
    description: 'Recommended combination for +2 Science & Engineering pathways.',
  },
  {
    id: 'commerce',
    label: 'Accountancy + Economics',
    codes: ['OPT-ACC-10', 'OPT-ECO-10'],
    description: 'Recommended combination for +2 Management, CA & Finance.',
  },
  {
    id: 'math_eco',
    label: 'Opt Math + Economics',
    codes: ['OPT-MATH-10', 'OPT-ECO-10'],
    description: 'Quantitative economics and analytical mathematics track.',
  },
];

type BachelorTabId = 'entrance' | 'programs' | 'colleges' | 'scholarships' | 'careers';

const BACHELOR_BRIDGE_TABS: Array<{
  id: BachelorTabId;
  label: string;
  summary: string;
  items: Array<{
    title: string;
    subtitle: string;
    detail: string;
    metric: string;
    route?: string;
    source?: string;
    lastVerifiedDate?: string;
  }>;
}> = [
  {
    id: 'entrance',
    label: 'Entrance Exams',
    summary:
      'National entrance examinations administered immediately after Class 12 NEB board results across engineering, medicine, management, and IT.',
    items: [
      {
        title: 'IOE Entrance (BE / B.Arch)',
        subtitle: 'Tribhuvan University · Institute of Engineering',
        detail: '140 marks CBT covering Physics, Chemistry, Mathematics, and Engineering Aptitude.',
        metric: '100 Qs · 2 hrs',
      },
      {
        title: 'MECEE-BL (MBBS / BDS / B.Sc. Nursing)',
        subtitle: 'Medical Education Commission (MEC) Nepal',
        detail: 'Single national common entrance for all medical, dental, and paramedical seats.',
        metric: '200 MCQs · 3 hrs',
      },
      {
        title: 'CMAT & KUUMAT',
        subtitle: 'TU Faculty of Management · Kathmandu University',
        detail: 'Verbal Ability, Quantitative Reasoning, Logical Reasoning, and General Awareness.',
        metric: '100 Qs · 90 mins',
      },
      {
        title: 'B.Sc. CSIT & BIT Entrance',
        subtitle: 'TU Institute of Science & Technology (IOST)',
        detail: 'Mathematics, Physics, Chemistry, English, and Computer fundamentals.',
        metric: '100 MCQs · 2 hrs',
      },
    ],
  },
  {
    id: 'programs',
    label: 'Bachelor Degrees',
    summary:
      '4-year undergraduate programs in Nepal mapped directly to your Class 12 stream background.',
    items: [
      {
        title: 'BE Computer / Civil / Electronics',
        subtitle: '4 Years · 8 Semesters · Science (+2 Physical/Bio)',
        detail: 'Requires minimum C+ / 50% aggregate in Physics, Chemistry, and Mathematics.',
        metric: 'TU / KU / PU',
      },
      {
        title: 'B.Sc. CSIT / BCA / BIT',
        subtitle: '4 Years · Computing & Software Engineering',
        detail: 'Software architecture, AI, databases, and full-stack engineering tracks.',
        metric: 'IOST / FOST',
      },
      {
        title: 'BBA / BIM / BBM / BBS',
        subtitle: '4 Years · Management, Finance & Information Systems',
        detail: 'Open to Management and Science +2 graduates via CMAT or university entrance.',
        metric: 'FOM / KUSOM',
      },
      {
        title: 'BA LLB / B.Ed. / BSW',
        subtitle: '4–5 Years · Law, Education & Social Sciences',
        detail: 'Integrated five-year law or specialized humanities and education leadership degrees.',
        metric: 'TU / KU / Pokhara',
      },
    ],
  },
  {
    id: 'colleges',
    label: 'Colleges & Universities',
    summary:
      'Leading constituent and affiliated Nepali public & private universities accepting NEB Class 12 graduates.',
    items: [
      {
        title: 'Pulchowk Campus (IOE TU)',
        subtitle: 'Lalitpur · Engineering Flagship',
        detail: 'Premier constituent engineering campus with subsidized regular and full-fee quotas.',
        metric: 'Constituent',
      },
      {
        title: 'Kathmandu University (KU)',
        subtitle: 'Dhulikhel · Engineering, Science, Management & Arts',
        detail: 'Semester-based autonomous university with School of Engineering, Science, and KUSOM.',
        metric: 'Autonomous',
      },
      {
        title: 'IOM Maharajgunj & BPKIHS',
        subtitle: 'Kathmandu & Dharan · Health Sciences',
        detail: 'Top public medical institutions admitting strictly through MECEE merit lists.',
        metric: 'Public Medical',
      },
      {
        title: 'Shanker Dev & Nepal Commerce Campus',
        subtitle: 'Kathmandu · Management & Finance',
        detail: 'Constituent TU campuses offering BBA, BBM, BIM, and MBS tracks.',
        metric: 'FOM TU',
      },
    ],
  },
  {
    id: 'scholarships',
    label: 'Scholarships',
    summary:
      'Merit, reservation, and institutional tuition waivers available to high-performing Class 12 students.',
    items: [
      {
        title: 'MEC 75% Public Medical Scholarship',
        subtitle: 'Medical Education Commission',
        detail: 'Full tuition waiver in public medical colleges plus open & inclusive reservation seats.',
        metric: '100% Tuition',
      },
      {
        title: 'IOE Regular Quota Subsidized Seats',
        subtitle: 'Pulchowk, Thapathali, WRC, ERC',
        detail: 'Top entrance rankers pay nominal constituent tuition across all four years.',
        metric: 'Merit Rank',
      },
      {
        title: 'MoEST Higher Education Scholarship',
        subtitle: 'Ministry of Education, Science & Technology Nepal',
        detail: 'Need-based & merit higher-education support for undergraduate scholars.',
        metric: 'Need + Merit',
      },
      {
        title: 'KU & PU Merit Tuition Waivers',
        subtitle: 'Semester Top-Performer Grants',
        detail: 'Up to 100% semester tuition waiver for top entrance and GPA achievers.',
        metric: 'Up to 100%',
      },
    ],
  },
  {
    id: 'careers',
    label: 'Career Pathways',
    summary:
      'Map +2 subjects to long-term careers in Nepal and globally across technology, engineering, healthcare, and public leadership.',
    items: [
      {
        title: 'Software Architect & AI Engineer',
        subtitle: 'Via B.Sc. CSIT / BE Computer / BCA',
        detail: 'Build scalable SaaS, fintech, and AI systems for Nepal’s growing IT export sector.',
        metric: 'High Demand',
      },
      {
        title: 'Hydropower & Infrastructure Engineer',
        subtitle: 'Via BE Civil / Electrical / Mechanical',
        detail: 'Design tunneling, smart grids, and sustainable Himalayan infrastructure projects.',
        metric: 'NEC Licensed',
      },
      {
        title: 'Chartered Accountant & Investment Analyst',
        subtitle: 'Via ICAN / BBA / BBS',
        detail: 'Corporate audit, NRB banking regulation, taxation, and capital market leadership.',
        metric: 'ICAN / Finance',
      },
      {
        title: 'Clinical Physician & Public Health Specialist',
        subtitle: 'Via MBBS / BPH / B.Sc. Nursing',
        detail: 'Hospital practice, community epidemiology, and health policy leadership.',
        metric: 'NMC Licensed',
      },
    ],
  },
];

const STUDY_PLANNER_WEEKS = [
  {
    week: 'Weeks 1–2',
    focus: 'Core Concept Consolidation & Chapter Notes',
    tasks: 'Read complete bilingual chapter notes and highlight key definitions & formulas.',
  },
  {
    week: 'Weeks 3–4',
    focus: 'Worked Examples, Numericals & Short Answers',
    tasks: 'Solve all step-marked numericals and 2–4 mark board specification items.',
  },
  {
    week: 'Week 5',
    focus: 'Timed Chapter Tests & Past Papers',
    tasks: 'Complete chapter quizzes and solve 3 recent provincial/national board papers.',
  },
  {
    week: 'Week 6',
    focus: 'Full Mock Simulation & Revision Sheets',
    tasks: 'Attempt full 3-hour board simulations and drill high-yield revision sheets.',
  },
];

export function SchoolGradeView({
  gradeSlug,
  onNavigate,
  onOpenAuth,
}: SchoolGradeViewProps) {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<SchoolGradeOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStreamCode, setSelectedStreamCode] = useState<string>('science');
  const [selectedCombo, setSelectedCombo] = useState<OptionalComboId>('all');
  const [activeMode, setActiveMode] = useState<ResourceModeId>('all');
  const [activeBachelorTab, setActiveBachelorTab] = useState<BachelorTabId>('entrance');

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  const [plannerCompleted, setPlannerCompleted] = useState<Record<string, boolean>>({});
  const [mockStarted, setMockStarted] = useState(false);
  const [bachelorBridge, setBachelorBridge] = useState<BachelorBridgeResponse | null>(null);

  const isClass10 = gradeSlug === 'class-10' || gradeSlug === 'see';
  const isClass11 = gradeSlug === 'class-11';
  const isClass12 = gradeSlug === 'class-12';

  const loadGradeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/school/grade/${encodeURIComponent(gradeSlug)}`);
      const json = (await res.json()) as SchoolGradeOverviewResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load grade curriculum.');
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load school curriculum.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, gradeSlug]);

  const loadBookmarks = useCallback(async () => {
    if (!user) {
      setBookmarks([]);
      return;
    }
    try {
      const res = await apiFetch('/api/school/bookmarks');
      if (res.ok) {
        const json = (await res.json()) as { bookmarks: BookmarkItem[] };
        setBookmarks(json.bookmarks ?? []);
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    }
  }, [apiFetch, user]);

  useEffect(() => {
    setActiveMode('all');
    setMockStarted(false);
    void loadGradeData();
  }, [loadGradeData]);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  useEffect(() => {
    if (!isClass12) return;
    let active = true;
    fetch('/api/explore/bachelor-bridge')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: BachelorBridgeResponse | null) => {
        if (active && json) {
          setBachelorBridge(json);
        }
      })
      .catch((err) => console.error('Failed to load bachelor bridge data:', err));
    return () => {
      active = false;
    };
  }, [isClass12]);

  const userPermissions = useMemo(
    () => user?.permissions ?? ['curriculum:read'],
    [user],
  );

  // Enforce published-only visibility boundary defensively on UI too
  const visibleResources: SchoolResourceItem[] = useMemo(() => {
    if (!data?.resources) return [];
    return data.resources.filter((r) =>
      canStudentViewResourceStatus(r.status, userPermissions),
    );
  }, [data, userPermissions]);

  const streamsList: SchoolStreamSummary[] = useMemo(() => data?.streams ?? [], [data]);

  const compulsorySubjects: SchoolSubjectSummary[] = useMemo(() => {
    if (isClass10) {
      const seeCore = streamsList.find((s) => s.code === 'see_general');
      return seeCore?.subjects ?? [];
    }
    const compStream = streamsList.find((s) => s.code === 'compulsory');
    return compStream?.subjects ?? [];
  }, [isClass10, streamsList]);

  const optionalSubjects10: SchoolSubjectSummary[] = useMemo(() => {
    if (!isClass10) return [];
    const optStream = streamsList.find((s) => s.code === 'see_optional');
    const allOpt = optStream?.subjects ?? [];
    const combo = OPTIONAL_COMBOS.find((c) => c.id === selectedCombo);
    if (!combo || combo.id === 'all') return allOpt;
    return allOpt.filter((s) => combo.codes.includes(s.code));
  }, [isClass10, selectedCombo, streamsList]);

  const nebStreamTabs = useMemo(
    () =>
      streamsList.filter((s) =>
        ['science', 'management', 'humanities', 'education'].includes(s.code),
      ),
    [streamsList],
  );

  const activeNebStream: SchoolStreamSummary | null = useMemo(() => {
    if (isClass10 || nebStreamTabs.length === 0) return null;
    return (
      nebStreamTabs.find((s) => s.code === selectedStreamCode) ?? nebStreamTabs[0]
    );
  }, [isClass10, nebStreamTabs, selectedStreamCode]);

  const gradeStats = useMemo(() => {
    const allSubs = streamsList.flatMap((s) => s.subjects);
    const allChs = allSubs.flatMap((s) => s.chapters);
    const totalTopics = allChs.reduce((sum, ch) => sum + ch.topicCount, 0);
    return {
      subjectCount: allSubs.length,
      chapterCount: allChs.length,
      topicCount: totalTopics,
      publishedCount: visibleResources.filter((r) => r.status === 'published').length,
    };
  }, [streamsList, visibleResources]);

  const activeModeObj = RESOURCE_MODES.find((m) => m.id === activeMode) ?? RESOURCE_MODES[0];

  const filteredModeResources = useMemo(() => {
    if (activeMode === 'model_question') {
      return visibleResources.filter((r) => r.resourceType === 'model_question');
    }
    if (activeMode === 'past_paper') {
      return visibleResources.filter((r) => r.resourceType === 'past_paper');
    }
    return visibleResources;
  }, [activeMode, visibleResources]);

  const handleRemoveBookmark = async (id: number) => {
    const res = await apiFetch(`/api/school/bookmarks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const chapterTargetUrl = (subjectCode: string, chapterNumber: number) => {
    const base = `/school/${gradeSlug}/${encodeURIComponent(subjectCode)}/${chapterNumber}`;
    if (activeModeObj.readerTab) {
      return `${base}?tab=${activeModeObj.readerTab}`;
    }
    return base;
  };

  const renderSubjectCard = (subject: SchoolSubjectSummary, streamLabel: string) => (
    <article
      key={subject.id}
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">
              <span className="font-mono font-semibold text-red-700">{subject.code}</span>
              {' · '}
              <span>{streamLabel}</span>
              {' · '}
              <span>{subject.isCompulsory ? 'Compulsory' : 'Optional'}</span>
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-slate-900">
              {subject.name}
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
            {subject.creditHours} Cr
          </span>
        </div>

        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {subject.chapters.map((ch) => {
            const isBookmarked = bookmarks.some((b) => b.chapterId === ch.id);
            return (
              <li key={ch.id} className="py-3 first:pt-3 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onNavigate(chapterTargetUrl(subject.code, ch.chapterNumber))}
                      className="text-left text-sm font-medium text-slate-900 hover:text-red-700 transition-colors"
                    >
                      <span className="font-mono text-xs text-slate-400 mr-1.5">
                        Ch {ch.chapterNumber}
                      </span>
                      {ch.title}
                    </button>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{ch.summary}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums">{ch.estimatedHours} hrs</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{ch.topicCount} topics</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums text-emerald-700">
                        {ch.publishedResourceCount} published
                      </span>
                      {isBookmarked && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 font-medium text-blue-700">
                            <Bookmark className="h-3 w-3 fill-current" aria-hidden="true" />
                            Saved
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(chapterTargetUrl(subject.code, ch.chapterNumber))}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 shrink-0"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {subject.chapters[0] && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs">
          <button
            type="button"
            onClick={() =>
              onNavigate(
                `/school/${gradeSlug}/${encodeURIComponent(subject.code)}/${subject.chapters[0].chapterNumber}?tab=notes`,
              )
            }
            className="font-medium text-slate-600 hover:text-red-700"
          >
            Notes
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() =>
              onNavigate(
                `/school/${gradeSlug}/${encodeURIComponent(subject.code)}/${subject.chapters[0].chapterNumber}?tab=practice`,
              )
            }
            className="font-medium text-slate-600 hover:text-red-700"
          >
            MCQs &amp; Numericals
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() =>
              onNavigate(
                `/school/${gradeSlug}/${encodeURIComponent(subject.code)}/${subject.chapters[0].chapterNumber}?tab=test`,
              )
            }
            className="font-medium text-slate-600 hover:text-red-700"
          >
            Chapter Test
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() =>
              onNavigate(
                `/school/${gradeSlug}/${encodeURIComponent(subject.code)}/${subject.chapters[0].chapterNumber}?tab=revision`,
              )
            }
            className="font-medium text-slate-600 hover:text-red-700"
          >
            Revision Sheet
          </button>
        </div>
      )}
    </article>
  );

  return (
    <section aria-labelledby="school-grade-heading" className="space-y-8">
      {/* Header & Grade Switcher */}
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Learn · CDC &amp; NEB School Curriculum
            </p>
            <h1
              id="school-grade-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              {isClass10
                ? 'Class 10 / SEE Board Preparation'
                : isClass11
                  ? 'Class 11 (NEB +2) Stream Curriculum'
                  : 'Class 12 (NEB Final Board) & Bachelor Bridge'}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              {isClass10
                ? 'Compulsory core and Optional Group I & II combinations with bilingual chapter notes, SEE model sets, past papers, and revision sheets.'
                : isClass11
                  ? 'Structured stream switcher across Science, Management, Humanities, and Education with chapter notes, numericals, MCQs, and chapter tests.'
                  : 'Complete Grade 12 NEB streams, board exam revision planner, mock exam entry points, and direct transition pathways to bachelor entrance exams.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="School grade level switcher"
              className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
            >
              {[
                { slug: 'class-10', label: 'Class 10 / SEE', active: isClass10 },
                { slug: 'class-11', label: 'Class 11', active: isClass11 },
                { slug: 'class-12', label: 'Class 12', active: isClass12 },
              ].map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  role="tab"
                  aria-selected={g.active}
                  onClick={() => onNavigate(`/school/${g.slug}`)}
                  className={`min-h-[38px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    g.active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  onOpenAuth();
                } else {
                  setBookmarksOpen(true);
                }
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              <Bookmark className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
              Saved Bookmarks
              {user && (
                <span className="font-mono text-slate-500 tabular-nums">
                  ({bookmarks.length})
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Grade Metric Strip */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
          <span>
            Board:{' '}
            <strong className="font-semibold text-slate-900">
              {isClass10 ? 'CDC / NEB SEE' : 'NEB Higher Secondary'}
            </strong>
          </span>
          <span>·</span>
          <span>
            Subjects:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">
              {loading ? '—' : gradeStats.subjectCount}
            </strong>
          </span>
          <span>·</span>
          <span>
            Chapters:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">
              {loading ? '—' : gradeStats.chapterCount}
            </strong>
          </span>
          <span>·</span>
          <span>
            Published Resources:{' '}
            <strong className="font-mono text-emerald-700 tabular-nums">
              {loading ? '—' : gradeStats.publishedCount}
            </strong>
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Published Content Only
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Resource & Exam Preparation Entry Points */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Study &amp; Exam Preparation Modes
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Select a study mode to filter resources or launch chapters directly into that section.
            </p>
          </div>
          {activeModeObj.readerTab && (
            <span className="text-xs font-medium text-blue-700">
              Clicking any chapter opens directly into {activeModeObj.label}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {RESOURCE_MODES.map((mode) => {
            const active = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setActiveMode(mode.id)}
                className={`min-h-[38px] rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-red-700 bg-red-700 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode-Specific Interactive Panels (Model Questions, Past Papers, Full Mock Test, Study Planner) */}
      {(activeMode === 'model_question' || activeMode === 'past_paper') && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {activeMode === 'model_question'
                  ? 'Specification Grid Model Questions'
                  : 'Previous Board Examination Past Papers'}
              </h2>
              <p className="text-xs text-slate-500">
                Only Academic Reviewer-approved resources with <span className="font-mono">status = published</span> are shown to students.
              </p>
            </div>
            <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
          </div>

          {filteredModeResources.length === 0 ? (
            <p className="text-sm text-slate-600">
              Published chapter bundles below include model practice questions for every subject.
              Browse Class 10 Mathematics Chapter 1 for full CDC specification model &amp; past papers.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredModeResources.map((resItem) => {
                const matchedSub = streamsList
                  .flatMap((s) => s.subjects)
                  .find((sub) => sub.id === resItem.subjectId);
                const matchedCh = matchedSub?.chapters.find((c) => c.id === resItem.chapterId);
                return (
                  <li
                    key={resItem.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{resItem.title}</p>
                      <p className="text-xs text-slate-600">{resItem.summary}</p>
                      <p className="mt-1 text-[11px] font-mono text-slate-500">
                        {matchedSub?.code ?? 'BOARD'} · {resItem.category?.name ?? resItem.resourceType} · v{resItem.currentVersion} · {resItem.status}
                      </p>
                    </div>
                    {matchedSub && matchedCh && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate(
                            `/school/${gradeSlug}/${encodeURIComponent(matchedSub.code)}/${matchedCh.chapterNumber}`,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 shrink-0"
                      >
                        Open Paper
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {activeMode === 'mock_test' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {isClass10 ? 'SEE 75-Mark Full Board Mock Simulator' : 'NEB 75/100-Mark Full Mock Simulation'}
              </h2>
              <p className="text-xs text-slate-600">
                Timed specification-grid simulation across Group A (Objective), Group B (Short Answer), and Group C (Analytical Long Problems).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMockStarted((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 shrink-0"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              {mockStarted ? 'Hide Mock Blueprint' : 'Launch Mock Exam Blueprint'}
            </button>
          </div>

          {mockStarted && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-mono text-xs text-slate-500">Group A · 15 Marks</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Objective &amp; Very Short</p>
                <p className="mt-1 text-xs text-slate-600">15 items × 1 mark each · Target 25 mins</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-mono text-xs text-slate-500">Group B · 28 Marks</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Short Analytical &amp; Numericals</p>
                <p className="mt-1 text-xs text-slate-600">7–8 questions · Target 70 mins</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-mono text-xs text-slate-500">Group C · 32 Marks</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Long Derivations &amp; Proofs</p>
                <p className="mt-1 text-xs text-slate-600">4–8 questions · Target 85 mins</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Select any subject chapter below for Chapter Tests, or launch our full server-graded timed mock examination engine.
            </p>
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  isClass10
                    ? '/exams/see-compulsory-mock-1'
                    : '/exams/class-12-science-mock-1',
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shrink-0"
            >
              Start Timed Board Mock
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {activeMode === 'planner' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {isClass10 ? 'SEE 6-Week Revision & Study Planner' : 'NEB Board Revision & Pacing Planner'}
              </h2>
              <p className="text-xs text-slate-500">
                Track weekly milestones across your compulsory and stream subjects.
              </p>
            </div>
            <Calendar className="h-5 w-5 text-slate-400" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {STUDY_PLANNER_WEEKS.map((item) => {
              const checked = Boolean(plannerCompleted[item.week]);
              return (
                <button
                  key={item.week}
                  type="button"
                  onClick={() =>
                    setPlannerCompleted((prev) => ({ ...prev, [item.week]: !prev[item.week] }))
                  }
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                    checked
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      checked ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-mono text-xs font-semibold text-red-700">{item.week}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{item.focus}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.tasks}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Sync personal study tasks, exam countdowns, and daily progress inside your dashboard.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/planner')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Open Personalized Study Planner
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Loading / Class 10 / Class 11 & 12 Streams */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white p-6"
            />
          ))}
        </div>
      ) : isClass10 ? (
        <div className="space-y-8">
          {/* Compulsory Subjects */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Compulsory SEE Subjects
                </h2>
                <p className="text-xs text-slate-500">
                  All 5 mandatory CDC national curriculum subjects
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {compulsorySubjects.length} subjects
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {compulsorySubjects.map((sub) => renderSubjectCard(sub, 'Compulsory SEE'))}
            </div>
          </div>

          {/* Optional Subjects with Combination Selector */}
          <div className="space-y-4 border-t border-slate-200 pt-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Optional Subject Combinations (Opt I &amp; II)
                </h2>
                <p className="text-xs text-slate-500">
                  Select a subject combination to tailor your SEE Optional library.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {OPTIONAL_COMBOS.map((combo) => {
                  const active = selectedCombo === combo.id;
                  return (
                    <button
                      key={combo.id}
                      type="button"
                      onClick={() => setSelectedCombo(combo.id)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {combo.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              {OPTIONAL_COMBOS.find((c) => c.id === selectedCombo)?.description}
            </p>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {optionalSubjects10.map((sub) => renderSubjectCard(sub, 'SEE Optional'))}
            </div>
          </div>
        </div>
      ) : (
        /* Class 11 & Class 12 Stream Switcher View */
        <div className="space-y-8">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Select Academic Stream
                </h2>
                <p className="text-xs text-slate-500">
                  Switch between Science, Management, Humanities, and Education tracks.
                </p>
              </div>
              <div
                role="tablist"
                aria-label="Academic stream switcher"
                className="flex flex-wrap gap-1.5"
              >
                {nebStreamTabs.map((stream) => {
                  const active = activeNebStream?.code === stream.code;
                  return (
                    <button
                      key={stream.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedStreamCode(stream.code)}
                      className={`min-h-[40px] rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-red-700 bg-red-700 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      {stream.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeNebStream && (
              <div className="mt-4 border-t border-slate-100 pt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-800">{activeNebStream.name}</p>
                <p className="text-xs text-slate-500">{activeNebStream.description}</p>
              </div>
            )}
          </div>

          {/* Active Stream Subjects */}
          {activeNebStream && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-slate-900">
                  {activeNebStream.name} Subjects
                </h3>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {activeNebStream.subjects.length} subjects
                </span>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {activeNebStream.subjects.map((sub) =>
                  renderSubjectCard(sub, activeNebStream.name.split(' ')[0]),
                )}
              </div>
            </div>
          )}

          {/* Compulsory Core Subjects */}
          <div className="space-y-4 border-t border-slate-200 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  Compulsory Core (Shared Across All Streams)
                </h3>
                <p className="text-xs text-slate-500">
                  Nepali, English, and Social Studies &amp; Life Skill required for all NEB students
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {compulsorySubjects.length} subjects
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {compulsorySubjects.map((sub) => renderSubjectCard(sub, 'Compulsory Core'))}
            </div>
          </div>
        </div>
      )}

      {/* Prominent Class 12 "Plan Your Bachelor Journey" Bridge Section */}
      {isClass12 && (
        <section
          aria-labelledby="bachelor-bridge-heading"
          className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-700">
                <Compass className="h-4 w-4" aria-hidden="true" />
                Post-NEB Higher Education Bridge
              </p>
              <h2
                id="bachelor-bridge-heading"
                className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900"
              >
                Plan Your Bachelor Journey
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
                Connect your Class 12 NEB board preparation directly to Nepal’s top bachelor
                entrance exams, undergraduate degree programs, universities, scholarships, and
                career pathways.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                <GraduationCap className="h-4 w-4 text-blue-700" aria-hidden="true" />
                IOE · CEE · CMAT · CSIT Ready
              </span>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Bachelor journey categories"
            className="mt-5 flex flex-wrap gap-2"
          >
            {BACHELOR_BRIDGE_TABS.map((tab) => {
              const active = activeBachelorTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveBachelorTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  {tab.id === 'entrance' && <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />}
                  {tab.id === 'programs' && <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
                  {tab.id === 'colleges' && <Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  {tab.id === 'scholarships' && <Award className="h-3.5 w-3.5" aria-hidden="true" />}
                  {tab.id === 'careers' && <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {(() => {
            const activeBridge =
              BACHELOR_BRIDGE_TABS.find((t) => t.id === activeBachelorTab) ??
              BACHELOR_BRIDGE_TABS[0];
            const liveItems =
              activeBachelorTab === 'entrance'
                ? bachelorBridge?.entrances
                : activeBachelorTab === 'programs'
                  ? bachelorBridge?.programs
                  : activeBachelorTab === 'colleges'
                    ? bachelorBridge?.colleges
                    : activeBachelorTab === 'scholarships'
                      ? bachelorBridge?.scholarships
                      : bachelorBridge?.careers;
            const bridgeItems =
              liveItems && liveItems.length > 0 ? liveItems : activeBridge.items;

            return (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-slate-600">{activeBridge.summary}</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {bridgeItems.map((item) => {
                    const targetRoute =
                      item.route ??
                      (activeBachelorTab === 'entrance'
                        ? '/entrance'
                        : activeBachelorTab === 'programs'
                          ? '/explore/courses'
                          : activeBachelorTab === 'colleges'
                            ? '/explore/colleges'
                            : activeBachelorTab === 'scholarships'
                              ? '/explore/scholarships'
                              : '/explore/careers');
                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => onNavigate(targetRoute)}
                        className="group rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-base font-semibold text-slate-900 group-hover:text-red-700">
                              {item.title}
                            </h3>
                            <p className="text-xs font-medium text-blue-700">{item.subtitle}</p>
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                            {item.metric}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                        {(item.source || item.lastVerifiedDate) && (
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2 text-[11px] text-slate-500">
                            <span className="truncate">
                              {item.source ? `Source: ${item.source}` : ''}
                            </span>
                            {item.lastVerifiedDate && (
                              <span className="font-mono tabular-nums shrink-0">
                                Verified {item.lastVerifiedDate}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <p className="text-xs text-slate-700">
                Bridge directly from Grade 12 Physics, Mathematics, or Accountancy into competitive
                bachelor preparation, verified colleges, scholarships, and career roadmaps.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('/explore/courses')}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Explore All Courses &amp; Careers
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/entrance')}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
              >
                Explore Bachelor Entrances
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/school/class-12/PHY-201/1')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
              >
                PHY-201 Ch 1
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/school/class-12/ACC-204/1')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
              >
                ACC-204 Ch 1
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Saved Bookmarks Slide-over Drawer */}
      {bookmarksOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bookmarks-drawer-title"
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl border-l border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2
                  id="bookmarks-drawer-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Saved Bookmarks
                </h2>
                <p className="text-xs text-slate-500">
                  Chapters &amp; resources synced to your student account
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookmarksOpen(false)}
                aria-label="Close bookmarks drawer"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {bookmarks.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
                  <Bookmark className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-slate-800">No bookmarks yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open any chapter reader and click Bookmark Chapter to save it here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {bookmarks.map((bm) => (
                    <li key={bm.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{bm.title}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {bm.bookmarkType} · saved {new Date(bm.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveBookmark(bm.id)}
                        aria-label={`Remove bookmark ${bm.title}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
