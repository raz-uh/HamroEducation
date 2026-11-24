import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Info,
  Mail,
  MapPin,
  Phone,
  Search,
} from 'lucide-react';
import {
  filterColleges,
  formatNprRange,
  isSafeHttpUrl,
  NEPAL_PROVINCES,
} from '../lib/explorer.ts';
import type { ExploreCollegeItem, ExploreUniversityItem } from '../types/api.ts';
import { ExploreNavBar } from './ExploreNavBar.tsx';

interface CollegeDirectoryViewProps {
  onNavigate: (path: string) => void;
}

export function CollegeDirectoryView({ onNavigate }: CollegeDirectoryViewProps) {
  const [colleges, setColleges] = useState<ExploreCollegeItem[]>([]);
  const [universities, setUniversities] = useState<ExploreUniversityItem[]>([]);
  const [courseOptions, setCourseOptions] = useState<Array<{ slug: string; name: string }>>([]);
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [uniFilter, setUniFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/explore/colleges')
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load verified college directory.');
        return (await res.json()) as {
          colleges: ExploreCollegeItem[];
          universities: ExploreUniversityItem[];
          courses: Array<{ slug: string; name: string }>;
        };
      })
      .then((json) => {
        if (!active) return;
        setColleges(json.colleges);
        setUniversities(json.universities);
        setCourseOptions(json.courses);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load colleges.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      filterColleges(colleges, {
        province: provinceFilter,
        universityCode: uniFilter,
        courseSlug: courseFilter,
        query,
      }),
    [colleges, provinceFilter, uniFilter, courseFilter, query],
  );

  if (loading) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active="colleges" onNavigate={onNavigate} />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Loading verified Nepali colleges and campus profiles...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <ExploreNavBar active="colleges" onNavigate={onNavigate} />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="colleges-heading" className="space-y-6">
      <ExploreNavBar active="colleges" onNavigate={onNavigate} />

      <div className="border-b border-slate-200 pb-6 space-y-1.5">
        <p className="text-xs font-medium text-red-700">
          Section 11.3 Transparent Institution Directory
        </p>
        <h1
          id="colleges-heading"
          className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
        >
          Nepal College &amp; Campus Profiles
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Every profile explicitly separates audited <strong>Verified Facts</strong> (official
          affiliation, verified seats, regulated fees) from{' '}
          <strong>Promotional / Institutional Claims</strong> so students can evaluate campuses
          objectively.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-700">Search College or City</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pulchowk, St. Xavier's, Pokhara..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-700">Province</span>
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="all">All 7 Provinces</option>
              {NEPAL_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-700">University Affiliation</span>
            <select
              value={uniFilter}
              onChange={(e) => setUniFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="all">All Universities</option>
              {universities.map((u) => (
                <option key={u.shortCode} value={u.shortCode}>
                  {u.name} ({u.shortCode})
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-700">Offered Program</span>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="all">All Programs</option>
              {courseOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono tabular-nums">
            Showing {filtered.length} of {colleges.length} verified campuses
          </span>
          {(provinceFilter !== 'all' ||
            uniFilter !== 'all' ||
            courseFilter !== 'all' ||
            query) && (
            <button
              type="button"
              onClick={() => {
                setProvinceFilter('all');
                setUniFilter('all');
                setCourseFilter('all');
                setQuery('');
              }}
              className="font-semibold text-red-700 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* College Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No colleges matched your selected province, university, or program filter.
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((col) => (
            <article
              key={col.slug}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
            >
              {/* Header */}
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {col.institutionType} · {col.universityName}
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900">{col.name}</h2>
                  <p className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {col.city}, {col.district}, {col.province}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-1.5 text-xs lg:items-end shrink-0">
                  {isSafeHttpUrl(col.officialWebsite) && (
                    <a
                      href={col.officialWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 font-semibold text-white hover:bg-slate-800"
                    >
                      Official Website
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Source: {col.source} · Verified {col.lastVerifiedDate}
                  </p>
                </div>
              </div>

              {/* Explicit Visual Separation: Verified Facts vs Promotional / Institutional Claims */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    Verified Institutional Facts (Audited)
                  </div>
                  <dl className="space-y-1.5 text-xs text-slate-700">
                    <div>
                      <dt className="font-semibold text-slate-900 inline">Affiliation: </dt>
                      <dd className="inline">{col.verifiedFacts.affiliationBody}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-900 inline">Verified Intake: </dt>
                      <dd className="inline">{col.verifiedFacts.verifiedIntakeSummary}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-900 inline">Fee Basis: </dt>
                      <dd className="inline">{col.verifiedFacts.feeVerificationNote}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-900 inline">Admission Rule: </dt>
                      <dd className="inline">{col.admissionRequirements}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Info className="h-4 w-4 text-amber-700" aria-hidden="true" />
                    Institutional &amp; Promotional Highlights (Campus-Reported)
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                    {col.promotionalClaims.map((claim, idx) => (
                      <li key={idx}>{claim}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-800">
                    Campus-reported highlights are separated from statutory verification facts for
                    transparent student comparison.
                  </p>
                </div>
              </div>

              {/* Offered Programs & Verified Fees Table */}
              {col.offeredCourses.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Offered Programs &amp; Verified Fees
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 pr-3 font-semibold">Program</th>
                          <th className="py-2 px-3 font-semibold text-right">Total Seats</th>
                          <th className="py-2 px-3 font-semibold text-right">Scholarship Seats</th>
                          <th className="py-2 pl-3 font-semibold text-right">Verified Fee Range</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {col.offeredCourses.map((prog) => (
                          <tr key={prog.courseSlug}>
                            <td className="py-2.5 pr-3">
                              <button
                                type="button"
                                onClick={() => onNavigate(`/explore/courses/${prog.courseSlug}`)}
                                className="font-semibold text-blue-700 hover:underline"
                              >
                                {prog.courseName}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                              {prog.totalSeats}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                              {prog.scholarshipSeats}
                            </td>
                            <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-900">
                              {formatNprRange(prog.verifiedFeeMinNpr, prog.verifiedFeeMaxNpr)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Facilities, Scholarships & Contact */}
              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">Campus Facilities</p>
                  <p className="mt-1 text-slate-600">{col.facilities.join(' · ')}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Scholarships Available</p>
                  <p className="mt-1 text-slate-600">{col.scholarshipHighlights.join(' · ')}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">Verified Contact</p>
                  <p className="inline-flex items-center gap-1.5 text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {col.contactEmail}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono text-slate-600 tabular-nums">
                    <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {col.contactPhone}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
