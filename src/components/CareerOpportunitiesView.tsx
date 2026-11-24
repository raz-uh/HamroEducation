import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ExternalLink,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { isSafeHttpUrl, OPPORTUNITY_CATEGORIES } from '../lib/explorer.ts';
import type {
  ExploreCareerPathItem,
  ExploreDeadlineItem,
  ExploreOpportunityItem,
} from '../types/api.ts';
import { ExploreNavBar } from './ExploreNavBar.tsx';

interface CareerOpportunitiesViewProps {
  mode: 'careers' | 'opportunities';
  onNavigate: (path: string) => void;
}

export function CareerOpportunitiesView({
  mode,
  onNavigate,
}: CareerOpportunitiesViewProps) {
  const [careers, setCareers] = useState<ExploreCareerPathItem[]>([]);
  const [selectedCareerSlug, setSelectedCareerSlug] = useState<string>('');
  const [opportunities, setOpportunities] = useState<ExploreOpportunityItem[]>([]);
  const [deadlines, setDeadlines] = useState<ExploreDeadlineItem[]>([]);
  const [oppCategoryFilter, setOppCategoryFilter] = useState<string>('all');
  const [deadlineCategoryFilter, setDeadlineCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    if (mode === 'careers') {
      fetch('/api/explore/careers')
        .then(async (res) => {
          if (!res.ok) throw new Error('Unable to load career roadmaps.');
          return (await res.json()) as { careers: ExploreCareerPathItem[] };
        })
        .then((json) => {
          if (!active) return;
          setCareers(json.careers);
          if (json.careers[0]) setSelectedCareerSlug(json.careers[0].slug);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Failed to load careers.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      fetch('/api/explore/opportunities')
        .then(async (res) => {
          if (!res.ok) throw new Error('Unable to load opportunities and calendar.');
          return (await res.json()) as {
            opportunities: ExploreOpportunityItem[];
            deadlines: ExploreDeadlineItem[];
          };
        })
        .then((json) => {
          if (!active) return;
          setOpportunities(json.opportunities);
          setDeadlines(json.deadlines);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Failed to load opportunities.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [mode]);

  const activeCareer = useMemo(
    () => careers.find((c) => c.slug === selectedCareerSlug) ?? careers[0] ?? null,
    [careers, selectedCareerSlug],
  );

  const filteredOpps = useMemo(() => {
    if (oppCategoryFilter === 'all') return opportunities;
    return opportunities.filter((o) => o.category === oppCategoryFilter);
  }, [opportunities, oppCategoryFilter]);

  const filteredDeadlines = useMemo(() => {
    if (deadlineCategoryFilter === 'all') return deadlines;
    return deadlines.filter((d) => d.category === deadlineCategoryFilter);
  }, [deadlines, deadlineCategoryFilter]);

  if (loading) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active={mode} onNavigate={onNavigate} />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Loading career roadmaps and academic calendar...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active={mode} onNavigate={onNavigate} />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      </section>
    );
  }

  // --------------------------------------------------------------------------
  // CAREERS ROADMAP VIEW (/explore/careers)
  // --------------------------------------------------------------------------
  if (mode === 'careers') {
    return (
      <section aria-labelledby="careers-heading" className="space-y-6">
        <ExploreNavBar active="careers" onNavigate={onNavigate} />

        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-red-700">
              Section 11.5 End-to-End Academic &amp; Career Planning
            </p>
            <h1
              id="careers-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
            >
              Interactive Career Roadmaps
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Trace the complete progression from Class 10 / SEE through +2 stream selection,
              bachelor degree, practical internships, and professional licensing in Nepal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/explore/opportunities')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Opportunities &amp; Calendar
          </button>
        </div>

        {/* Interactive Career Path Selector */}
        <div
          role="tablist"
          aria-label="Select career roadmap"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {careers.map((cp) => {
            const selected = activeCareer?.slug === cp.slug;
            return (
              <button
                key={cp.slug}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedCareerSlug(cp.slug)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                }`}
              >
                <p
                  className={`text-[11px] font-medium ${
                    selected ? 'text-slate-300' : 'text-red-700'
                  }`}
                >
                  {cp.category}
                </p>
                <p className="mt-1 font-display text-base font-bold">{cp.title}</p>
                <p
                  className={`mt-1 font-mono text-xs tabular-nums ${
                    selected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {cp.averageSalaryRangeNpr.split('(')[0].trim()}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active Career Roadmap Canvas */}
        {activeCareer && (
          <div className="space-y-6">
            <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5 max-w-2xl">
                  <p className="text-xs font-medium text-red-700">{activeCareer.category}</p>
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    {activeCareer.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{activeCareer.summary}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-1 shrink-0">
                  <p className="font-semibold text-slate-900">Outlook &amp; Licensing</p>
                  <p className="text-slate-700">{activeCareer.demandOutlook}</p>
                  <p className="text-slate-600">{activeCareer.licensingBody}</p>
                  <p className="font-mono font-semibold text-slate-900 tabular-nums pt-1">
                    {activeCareer.averageSalaryRangeNpr}
                  </p>
                </div>
              </div>

              {/* 5-Stage Progression Timeline */}
              <div className="space-y-4">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Step-by-Step Progression (SEE → +2 → Bachelor → Skills → Career)
                </h3>
                <ol className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  {activeCareer.roadmapStages.map((stage) => (
                    <li
                      key={stage.stageCode}
                      className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-red-700 tabular-nums">
                            0{stage.stageOrder}
                          </span>
                          <span className="font-semibold text-slate-500">{stage.stageLabel}</span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-slate-900">
                          {stage.title}
                        </h4>
                        <p className="text-xs leading-relaxed text-slate-600">{stage.guidance}</p>
                        <ul className="space-y-1 text-[11px] text-slate-700 list-disc pl-3.5">
                          {stage.milestones.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>

                      {stage.recommendedRoute && (
                        <button
                          type="button"
                          onClick={() => onNavigate(stage.recommendedRoute!)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline pt-2 border-t border-slate-200/70"
                        >
                          Open Stage Guide
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Linked Degrees & Core Skills */}
              <div className="grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    Recommended Nepal Bachelor Degrees
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {activeCareer.recommendedCourses.map((rc) => (
                      <button
                        key={rc.slug}
                        type="button"
                        onClick={() => onNavigate(`/explore/courses/${rc.slug}`)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        {rc.name} ({rc.universityShortCode}) →
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Core Competency &amp; Technical Skills
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {activeCareer.requiredSkills.join(' · ')}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Source: {activeCareer.source} · Verified {activeCareer.lastVerifiedDate}
                  </p>
                </div>
              </div>
            </article>
          </div>
        )}
      </section>
    );
  }

  // --------------------------------------------------------------------------
  // OPPORTUNITIES HUB & CENTRALIZED ADMISSION CALENDAR (/explore/opportunities)
  // --------------------------------------------------------------------------
  return (
    <section aria-labelledby="opportunities-heading" className="space-y-8">
      <ExploreNavBar active="opportunities" onNavigate={onNavigate} />

      <div className="border-b border-slate-200 pb-6 space-y-1.5">
        <p className="text-xs font-medium text-red-700">
          Section 11.5 Opportunities Hub &amp; Centralized Admission Calendar
        </p>
        <h1
          id="opportunities-heading"
          className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
        >
          Student Opportunities &amp; National Education Calendar
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Track olympiads, hackathons, workshops, paid internships, and centralized SEE, NEB,
          bachelor entrance, and scholarship deadlines across Nepal.
        </p>
      </div>

      {/* Part 1: Centralized Education & Admission Calendar */}
      <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Centralized Education &amp; Admission Calendar
            </h2>
            <p className="text-xs text-slate-500">
              National board dates, entrance exam windows, and scholarship deadlines
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter calendar by milestone type"
            className="flex flex-wrap gap-1.5"
          >
            {['all', 'SEE', 'NEB', 'Entrance Exam', 'Scholarship', 'University Admission'].map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDeadlineCategoryFilter(cat)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    deadlineCategoryFilter === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'All Events' : cat}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2.5 pr-4 font-semibold">Event &amp; Authority</th>
                <th className="py-2.5 px-3 font-semibold">Category</th>
                <th className="py-2.5 px-3 font-semibold">Form Window</th>
                <th className="py-2.5 px-3 font-semibold">Exam / Target Date</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 pl-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeadlines.map((dl) => (
                <tr key={dl.slug} className="align-top">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-900">{dl.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {dl.authority} · {dl.targetAudience}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400 tabular-nums">
                      {dl.source} · Verified {dl.lastVerifiedDate}
                    </p>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                    {dl.category}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                    {dl.openDate} → {dl.deadlineDate}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {dl.examDate}
                  </td>
                  <td className="py-3 px-3 font-medium text-red-700 whitespace-nowrap">
                    {dl.status}
                  </td>
                  <td className="py-3 pl-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onNavigate(dl.actionRoute)}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        Prepare →
                      </button>
                      {isSafeHttpUrl(dl.officialUrl) && (
                        <a
                          href={dl.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Official site for ${dl.title}`}
                          className="text-slate-500 hover:text-slate-900"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {/* Part 2: Opportunities Hub */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-red-700" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Competitions, Olympiads, Hackathons &amp; Internships
            </h2>
          </div>

          <div
            role="group"
            aria-label="Filter opportunities by type"
            className="flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              onClick={() => setOppCategoryFilter('all')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                oppCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Types
            </button>
            {OPPORTUNITY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setOppCategoryFilter(cat)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  oppCategoryFilter === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredOpps.map((opp) => (
            <article
              key={opp.slug}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium text-red-700">{opp.category}</span>
                  <span>{opp.mode}</span>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">{opp.title}</h3>
                <p className="text-xs text-slate-500">{opp.organization}</p>
                <p className="text-xs leading-relaxed text-slate-700">{opp.eligibility}</p>
                <p className="text-xs font-semibold text-emerald-800">{opp.benefitOrPrize}</p>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                <p className="inline-flex items-center gap-1.5 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  {opp.location} · {opp.windowLabel}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Deadline {opp.deadlineDate}
                  </span>
                  {isSafeHttpUrl(opp.routeOrUrl) && (
                    <a
                      href={opp.routeOrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                    >
                      Organizer Site
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <p className="font-mono text-[10px] text-slate-400 tabular-nums">
                  {opp.source} · Verified {opp.lastVerifiedDate}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
