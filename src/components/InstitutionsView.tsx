import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, Plus, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { Country, InstitutionItem } from '../types/api.ts';

export function InstitutionsView() {
  const { user, apiFetch } = useAuth();
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [countryId, setCountryId] = useState<string>('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [institutionType, setInstitutionType] = useState('school');
  const [provinceOrState, setProvinceOrState] = useState('');
  const [city, setCity] = useState('');
  const [domain, setDomain] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, curRes] = await Promise.all([
        fetch('/api/institutions'),
        fetch('/api/curriculum?country=NP'),
      ]);
      if (instRes.ok) {
        const instJson = await instRes.json();
        setInstitutions(instJson.institutions ?? []);
      }
      if (curRes.ok) {
        const curJson = await curRes.json();
        setCountries(curJson.countries ?? []);
        if (curJson.countries?.[0] && !countryId) {
          setCountryId(String(curJson.countries[0].id));
        }
      }
    } catch (err) {
      console.error('Failed to load institutions:', err);
    } finally {
      setLoading(false);
    }
  }, [countryId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredInstitutions = institutions.filter((inst) => {
    if (countryFilter === 'all') return true;
    return inst.country?.isoCode === countryFilter;
  });

  const canManageInstitutions = user?.permissions.includes('institutions:manage') ?? false;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/institutions', {
        method: 'POST',
        body: JSON.stringify({
          countryId: Number(countryId),
          name,
          code,
          institutionType,
          provinceOrState,
          city,
          domain,
          isVerified: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: json.error || 'Permission denied.' });
        return;
      }
      setFeedback({
        type: 'success',
        message: `Registered institution "${json.institution.name}" (${json.institution.code}).`,
      });
      setName('');
      setCode('');
      setProvinceOrState('');
      setCity('');
      setDomain('');
      setShowForm(false);
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to register institution.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="institutions-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-red-700">Country-Scoped Institutional Tenants</p>
          <h1
            id="institutions-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Schools, Colleges &amp; Campuses
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Verified partner institutions linked to <span className="font-mono">countries</span> and
            scoped <span className="font-mono">institutional_administrator</span> role delegations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setShowForm((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Register Institution
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Register Partner Institution (Requires institutions:manage)
            </h2>
            {!canManageInstitutions && (
              <span className="text-xs text-amber-800">
                Requires Administrator or Super Administrator role
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="inst-country" className="block text-xs font-medium text-slate-700">
                Country
              </label>
              <select
                id="inst-country"
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.isoCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inst-name" className="block text-xs font-medium text-slate-700">
                Institution Name
              </label>
              <input
                id="inst-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kathmandu Model Secondary School"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="inst-code" className="block text-xs font-medium text-slate-700">
                Registry Code
              </label>
              <input
                id="inst-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. NP-KMC-005"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="inst-type" className="block text-xs font-medium text-slate-700">
                Type
              </label>
              <select
                id="inst-type"
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="school">School</option>
                <option value="college">College (+2)</option>
                <option value="university">University</option>
                <option value="training_center">Training Center</option>
                <option value="board">Examination Board</option>
              </select>
            </div>

            <div>
              <label htmlFor="inst-province" className="block text-xs font-medium text-slate-700">
                Province / State
              </label>
              <input
                id="inst-province"
                type="text"
                value={provinceOrState}
                onChange={(e) => setProvinceOrState(e.target.value)}
                placeholder="Bagmati Province"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="inst-city" className="block text-xs font-medium text-slate-700">
                City
              </label>
              <input
                id="inst-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Kathmandu"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="inst-domain" className="block text-xs font-medium text-slate-700">
                Domain
              </label>
              <input
                id="inst-domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="kmc.edu.np"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Save Institution'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setCountryFilter('all')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            countryFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          All Countries
        </button>
        {countries.map((c) => (
          <button
            key={c.isoCode}
            type="button"
            onClick={() => setCountryFilter(c.isoCode)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              countryFilter === c.isoCode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredInstitutions.map((inst) => (
            <article
              key={inst.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-mono text-slate-700">{inst.code}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {inst.isVerified ? 'Verified Tenant' : 'Pending Review'}
                  </span>
                </div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {inst.name}
                </h2>
                <p className="text-xs text-slate-600 capitalize">
                  {inst.institutionType.replace('_', ' ')}
                  {inst.city ? ` · ${inst.city}` : ''}
                  {inst.provinceOrState ? `, ${inst.provinceOrState}` : ''}
                  {inst.country ? ` · ${inst.country.name}` : ''}
                </p>
              </div>

              {inst.domain && (
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span className="font-mono">{inst.domain}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
