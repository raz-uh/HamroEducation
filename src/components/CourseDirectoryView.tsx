import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  ExternalLink,
  GitCompare,
  Search,
  Square,
} from 'lucide-react';
import {
  COURSE_CATEGORIES,
  filterCourses,
  formatNprRange,
  isSafeHttpUrl,
} from '../lib/explorer.ts';
import type {
  ComparisonRow,
} from '../lib/explorer.ts';
import type {
  ExploreCourseDetailResponse,
  ExploreCourseItem,
  ExploreUniversityItem,
} from '../types/api.ts';
import { ExploreNavBar } from './ExploreNavBar.tsx';

interface CourseDirectoryViewProps {
  slug?: string;
  compareMode?: boolean;
  onNavigate: (path: string) => void;
}

export function CourseDirectoryView({
  slug,
  compareMode = false,
  onNavigate,
}: CourseDirectoryViewProps) {
  const [courses, setCourses] = useState<ExploreCourseItem[]>([]);
  const [universities, setUniversities] = useState<ExploreUniversityItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [compareSlugs, setCompareSlugs] = useState<string[]>(['bsc-csit', 'bit', 'bca']);
  const [comparisonResult, setComparisonResult] = useState<{
    courses: ExploreCourseItem[];
    rows: ComparisonRow[];
  } | null>(null);
  const [detail, setDetail] = useState<ExploreCourseDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Read initial compare slugs from URL search query if in compareMode
  useEffect(() => {
    if (!compareMode || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('slugs');
    if (raw) {
      const parsed = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      if (parsed.length >= 2) {
        setCompareSlugs(parsed);
      }
    }
  }, [compareMode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    if (slug && !compareMode) {
      fetch(`/api/explore/courses/${encodeURIComponent(slug)}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Course record could not be loaded.');
          return (await res.json()) as ExploreCourseDetailResponse;
        })
        .then((json) => {
          if (active) setDetail(json);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Failed to load course.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }

    fetch('/api/explore/courses')
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load course directory.');
        return (await res.json()) as {
          courses: ExploreCourseItem[];
          universities: ExploreUniversityItem[];
        };
      })
      .then((json) => {
        if (!active) return;
        setCourses(json.courses);
        setUniversities(json.universities);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load courses.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug, compareMode]);

  useEffect(() => {
    if (!compareMode || compareSlugs.length < 2) return;
    let active = true;
    fetch(`/api/explore/courses/compare?slugs=${encodeURIComponent(compareSlugs.join(','))}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to build course comparison.');
        return (await res.json()) as {
          matrix: { valid: boolean; courses: ExploreCourseItem[]; rows: ComparisonRow[] };
        };
      })
      .then((json) => {
        if (active && json.matrix?.valid) {
          setComparisonResult({
            courses: json.matrix.courses,
            rows: json.matrix.rows,
          });
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Comparison failed.');
      });
    return () => {
      active = false;
    };
  }, [compareMode, compareSlugs]);

  const filteredCourses = useMemo(
    () =>
      filterCourses(courses, {
        category: selectedCategory,
        universityCode: selectedUniversity,
        query,
      }),
    [courses, selectedCategory, selectedUniversity, query],
  );

  const toggleCompareSlug = (courseSlug: string) => {
    setCompareSlugs((prev) => {
      if (prev.includes(courseSlug)) {
        if (compareMode && prev.length <= 2) return prev;
        return prev.filter((s) => s !== courseSlug);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), courseSlug];
      }
      return [...prev, courseSlug];
    });
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active={compareMode ? 'compare' : 'courses'} onNavigate={onNavigate} />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Loading verified Nepal higher-education records...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active={compareMode ? 'compare' : 'courses'} onNavigate={onNavigate} />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      </section>
    );
  }

  // --------------------------------------------------------------------------
  // COURSE COMPARISON MODE (/explore/courses/compare)
  // --------------------------------------------------------------------------
  if (compareMode) {
    return (
      <section aria-labelledby="compare-courses-heading" className="space-y-6">
        <ExploreNavBar active="compare" onNavigate={onNavigate} />

        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-red-700">
              Side-by-Side Degree Evaluation · 2 to 4 Programs
            </p>
            <h1
              id="compare-courses-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
            >
              Bachelor Course Comparison Matrix
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Compare verified eligibility, entrance tests, semester curricula, NPR fees, career
              pathways, and higher studies across up to 4 courses.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/explore/courses')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Courses
          </button>
        </div>

        {/* Preset & Multi-Course Selector */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Select 2 to 4 Courses to Compare ({compareSlugs.length}/4 active)
              </h2>
              <p className="text-xs text-slate-500">
                Quick presets or toggle any degree below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCompareSlugs(['bsc-csit', 'bit', 'bca'])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                BSc CSIT vs BIT vs BCA
              </button>
              <button
                type="button"
                onClick={() => setCompareSlugs(['bba', 'bbm'])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                BBA vs BBM
              </button>
              <button
                type="button"
                onClick={() => setCompareSlugs(['be-computer', 'bsc-csit', 'btech-ai'])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                BE Computer vs BSc CSIT vs BTech AI
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {courses.map((c) => {
              const selected = compareSlugs.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => toggleCompareSlug(c.slug)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {selected ? (
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {c.name} ({c.universityShortCode})
                </button>
              );
            })}
          </div>
        </div>

        {/* Comparison Table */}
        {comparisonResult && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-48 px-4 py-3.5 font-display text-xs font-semibold text-slate-700">
                    Dimension
                  </th>
                  {comparisonResult.courses.map((course) => (
                    <th key={course.slug} className="px-4 py-3.5 align-top">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/explore/courses/${course.slug}`)}
                          className="font-display text-sm font-bold text-slate-900 hover:text-red-700 text-left"
                        >
                          {course.name}
                        </button>
                        <p className="text-[11px] font-normal text-slate-500">
                          {course.fullForm}
                        </p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonResult.rows.map((row) => (
                  <tr key={row.dimension} className="align-top">
                    <th scope="row" className="px-4 py-3.5 font-semibold text-slate-800 bg-slate-50/40">
                      {row.dimension}
                    </th>
                    {row.values.map((val, idx) => (
                      <td
                        key={`${row.dimension}-${idx}`}
                        className={`px-4 py-3.5 leading-relaxed text-slate-700 ${
                          row.dimension === 'Verified Fees (Total)' ? 'font-mono tabular-nums' : ''
                        }`}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  // --------------------------------------------------------------------------
  // COURSE DETAIL VIEW (/explore/courses/[slug])
  // --------------------------------------------------------------------------
  if (slug && detail) {
    const { course, university, entranceExam, colleges, scholarships } = detail;
    return (
      <section aria-labelledby="course-detail-heading" className="space-y-6">
        <ExploreNavBar active="courses" onNavigate={onNavigate} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/explore/courses')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Course Directory
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                `/explore/courses/compare?slugs=${encodeURIComponent(
                  [course.slug, course.slug === 'bsc-csit' ? 'bit' : 'bsc-csit'].join(','),
                )}`,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
            Compare With Another Course
          </button>
        </div>

        {/* Course Header & Verification Provenance */}
        <header className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-red-700">{course.category}</span>
                <span aria-hidden="true">·</span>
                <span>{university.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{course.durationLabel}</span>
              </div>
              <h1
                id="course-detail-heading"
                className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              >
                {course.name} — {course.fullForm}
              </h1>
              <p className="text-xs text-slate-600">
                Recommended +2 Background: {course.streamRecommendation}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs shrink-0 space-y-1">
              <p className="font-semibold text-slate-900">Verified Record Metadata</p>
              <p className="text-slate-600">Source: {course.source}</p>
              <p className="font-mono text-slate-600 tabular-nums">
                Last Verified: {course.lastVerifiedDate}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 text-xs">
            <div>
              <p className="font-semibold text-slate-500">Verified Total Fee Range</p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                {formatNprRange(course.verifiedFeeMinNpr, course.verifiedFeeMaxNpr)}
              </p>
              <p className="mt-0.5 text-slate-600">{course.verifiedFeeNote}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Required Entrance Examination</p>
              {entranceExam ? (
                <div className="mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/entrance/${entranceExam.slug}`)}
                    className="font-semibold text-blue-700 hover:underline text-left"
                  >
                    {entranceExam.name} →
                  </button>
                  <p className="text-slate-600">{entranceExam.examPatternSummary}</p>
                </div>
              ) : (
                <p className="mt-1 text-slate-700">{course.admissionProcess}</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-500">Affiliated University</p>
              <p className="mt-1 font-semibold text-slate-900">{university.name}</p>
              <p className="mt-0.5 text-slate-600">{university.location}</p>
              {isSafeHttpUrl(university.officialWebsite) && (
                <a
                  href={university.officialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                >
                  Official Portal
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Eligibility & Admission + Career/Skills */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Eligibility &amp; Admission Process
            </h2>
            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Minimum Eligibility</p>
                <p className="mt-1">{course.eligibility}</p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="font-semibold text-slate-900">Step-by-Step Admission Flow</p>
                <p className="mt-1">{course.admissionProcess}</p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Career Possibilities, Skills &amp; Higher Studies
            </h2>
            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Target Careers</p>
                <p className="mt-1">{course.careerPossibilities.join(' · ')}</p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="font-semibold text-slate-900">Key Practical Skills</p>
                <p className="mt-1">{course.requiredSkills.join(' · ')}</p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="font-semibold text-slate-900">Higher Studies Pathways</p>
                <p className="mt-1">{course.higherStudiesOptions.join(' · ')}</p>
              </div>
            </div>
          </article>
        </div>

        {/* Curriculum & Modules */}
        <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Curriculum &amp; Semester Modules
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {course.curriculumModules.map((mod) => (
              <div key={mod.term} className="border-t border-slate-200 pt-3">
                <h3 className="text-xs font-semibold text-slate-900">{mod.term}</h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc pl-4">
                  {mod.subjects.map((sub) => (
                    <li key={sub}>{sub}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        {/* Available Colleges Offering This Course */}
        <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Verified Colleges Offering {course.name}
              </h2>
              <p className="text-xs text-slate-500">
                Seat allocations and campus-specific verified fee schedules
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/explore/colleges')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Open Full College Directory →
            </button>
          </div>

          {colleges.length === 0 ? (
            <p className="text-xs text-slate-600">
              Offered across constituent and affiliated campuses under {university.name}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4 font-semibold">College / Campus</th>
                    <th className="py-2.5 px-4 font-semibold">Location</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Seats (Schol.)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Verified Fees</th>
                    <th className="py-2.5 pl-4 font-semibold">Source &amp; Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {colleges.map((col) => (
                    <tr key={col.id} className="align-top">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">{col.name}</p>
                        <p className="text-[11px] text-slate-500">{col.institutionType}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {col.city}, {col.province}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {col.totalSeats} ({col.scholarshipSeats})
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatNprRange(col.verifiedFeeMinNpr, col.verifiedFeeMaxNpr)}
                        </p>
                        <p className="text-[11px] text-slate-500">{col.feeStructureNote}</p>
                      </td>
                      <td className="py-3 pl-4 text-[11px] text-slate-600">
                        <p>{col.source}</p>
                        <p className="font-mono tabular-nums">{col.lastVerifiedDate}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {/* Available Scholarships */}
        <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Relevant Scholarships for {course.name}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/explore/scholarships')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Browse All Scholarships →
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {scholarships.map((sch) => (
              <div key={sch.id} className="border-t border-slate-200 pt-3 space-y-1 text-xs">
                <p className="font-semibold text-slate-900">{sch.title}</p>
                <p className="text-slate-500">
                  {sch.category} · {sch.provider}
                </p>
                <p className="text-slate-700">{sch.financialBenefits}</p>
                <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                  Source: {sch.source} · Verified {sch.lastVerifiedDate}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    );
  }

  // --------------------------------------------------------------------------
  // COURSE DIRECTORY LISTING (/explore/courses)
  // --------------------------------------------------------------------------
  return (
    <section aria-labelledby="courses-directory-heading" className="space-y-6">
      <ExploreNavBar active="courses" onNavigate={onNavigate} />

      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-red-700">
            Section 11 Verified Nepal Higher-Education Directory
          </p>
          <h1
            id="courses-directory-heading"
            className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
          >
            Bachelor Courses &amp; Degree Explorer
          </h1>
          <p className="text-sm text-slate-600">
            Browse verified undergraduate programs across Tribhuvan University, Kathmandu
            University, Pokhara University, and Purbanchal University with source citations and
            verification dates.
          </p>
        </div>

        {/* Comparison Launch Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={compareSlugs.length < 2}
            onClick={() =>
              onNavigate(`/explore/courses/compare?slugs=${encodeURIComponent(compareSlugs.join(','))}`)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            Compare Selected ({compareSlugs.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-700">Search Courses</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search BSc CSIT, MBBS, BE Civil, BBA..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-700">Filter by University</span>
            <select
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="all">All Universities ({universities.length})</option>
              {universities.map((u) => (
                <option key={u.shortCode} value={u.shortCode}>
                  {u.name} ({u.shortCode})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end justify-between text-xs text-slate-500 pb-2">
            <span className="font-mono tabular-nums">
              Showing {filteredCourses.length} of {courses.length} verified courses
            </span>
            {(selectedCategory !== 'all' || selectedUniversity !== 'all' || query) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedUniversity('all');
                  setQuery('');
                }}
                className="font-semibold text-red-700 hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* 11 Category Filter Tabs */}
        <div
          role="group"
          aria-label="Filter courses by academic category"
          className="flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {COURSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Course Cards */}
      {filteredCourses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No courses match those filters. Clear filters to view all Nepal undergraduate programs.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const isSelected = compareSlugs.includes(course.slug);
            return (
              <article
                key={course.slug}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {course.category} · {course.universityShortCode}
                    </span>
                    <span className="font-mono tabular-nums">{course.durationYears} yrs</span>
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/explore/courses/${course.slug}`)}
                        className="text-left hover:text-red-700 transition-colors"
                      >
                        {course.name}
                      </button>
                    </h2>
                    <p className="text-xs text-slate-600">{course.fullForm}</p>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-700 line-clamp-2">
                    {course.eligibility}
                  </p>

                  <div className="border-t border-slate-100 pt-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Verified Fees</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatNprRange(course.verifiedFeeMinNpr, course.verifiedFeeMaxNpr)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Entrance</span>
                      <span className="font-medium text-slate-800 truncate max-w-[180px]">
                        {course.entranceExamName ?? 'Campus Screening'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Source: {course.source} · {course.lastVerifiedDate}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCompareSlug(course.slug)}
                      aria-pressed={isSelected}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Square className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isSelected ? 'In Compare' : 'Compare'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate(`/explore/courses/${course.slug}`)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Course Details
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
