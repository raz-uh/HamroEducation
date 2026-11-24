import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ExternalLink, FileText, Search } from 'lucide-react';
import {
  filterScholarships,
  isSafeHttpUrl,
  SCHOLARSHIP_CATEGORIES,
} from '../lib/explorer.ts';
import type { ExploreScholarshipItem } from '../types/api.ts';
import { ExploreNavBar } from './ExploreNavBar.tsx';

interface ScholarshipFinderViewProps {
  onNavigate: (path: string) => void;
}

export function ScholarshipFinderView({ onNavigate }: ScholarshipFinderViewProps) {
  const [items, setItems] = useState<ExploreScholarshipItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/explore/scholarships')
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load verified scholarships.');
        return (await res.json()) as { scholarships: ExploreScholarshipItem[] };
      })
      .then((json) => {
        if (active) setItems(json.scholarships);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load scholarships.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => filterScholarships(items, { category: selectedCategory, query }),
    [items, selectedCategory, query],
  );

  if (loading) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active="scholarships" onNavigate={onNavigate} />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Loading verified Nepal &amp; international scholarship notices...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active="scholarships" onNavigate={onNavigate} />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="scholarships-heading" className="space-y-6">
      <ExploreNavBar active="scholarships" onNavigate={onNavigate} />

      <div className="border-b border-slate-200 pb-6 space-y-1.5">
        <p className="text-xs font-medium text-red-700">
          Section 11.4 Verified Financial Aid &amp; Grant Finder
        </p>
        <h1
          id="scholarships-heading"
          className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
        >
          Scholarship Finder &amp; Application Guides
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Explore Government, University, College, Merit-based, Need-based, Entrance, and
          International scholarships with required documents, step-by-step instructions, and
          verified official portals.
        </p>
      </div>

      {/* Category & Search Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block w-full max-w-md space-y-1 text-xs">
            <span className="font-semibold text-slate-700">Search Scholarships</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search MEC, IOE Regular, UGC, MoEST..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </label>

          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {filtered.length} of {items.length} verified scholarships
          </span>
        </div>

        <div
          role="group"
          aria-label="Filter scholarships by category"
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
          {SCHOLARSHIP_CATEGORIES.map((cat) => (
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

      {/* Scholarship List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No scholarships matched that category or keyword.
        </div>
      ) : (
        <div className="space-y-5">
          {filtered.map((sch) => (
            <article
              key={sch.slug}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-red-700">{sch.category}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{sch.provider}</span>
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900">{sch.title}</h2>
                  <p className="text-xs text-slate-600">
                    Target Tracks: {sch.targetStreams.join(' · ')}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-1.5 text-xs lg:items-end shrink-0">
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 tabular-nums">
                    <Calendar className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                    Deadline: {sch.applicationDeadline} ({sch.deadlineStatus})
                  </span>
                  {isSafeHttpUrl(sch.officialSourceUrl) && (
                    <a
                      href={sch.officialSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                    >
                      Official Notice Portal
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">Eligibility Criteria</p>
                  <p className="mt-1 leading-relaxed text-slate-700">{sch.eligibility}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Financial Benefits</p>
                  <p className="mt-1 leading-relaxed text-emerald-800 font-medium">
                    {sch.financialBenefits}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 border-t border-slate-100 pt-4 md:grid-cols-2 text-xs">
                <div>
                  <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                    <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    Required Documents
                  </p>
                  <ul className="mt-2 space-y-1 text-slate-700 list-disc pl-4">
                    {sch.requiredDocuments.map((doc) => (
                      <li key={doc}>{doc}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    Step-by-Step Application Instructions
                  </p>
                  <ol className="mt-2 space-y-1.5 text-slate-700 list-decimal pl-4">
                    {sch.applicationInstructions.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <p className="border-t border-slate-100 pt-3 font-mono text-[11px] text-slate-500 tabular-nums">
                Source: {sch.source} · Last Verified: {sch.lastVerifiedDate}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
