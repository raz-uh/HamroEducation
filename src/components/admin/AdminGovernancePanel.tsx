import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BarChart3, BellRing, CheckCircle2, Lock, ScrollText, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { NEPAL_PLATFORM_DEFAULTS } from '../../lib/admin-governance.ts';
import type {
  AdminAnalyticsBundle,
  AnnouncementItem,
  AuditLogItem,
  SystemSettingItem,
} from '../../types/api.ts';

interface AdminGovernancePanelProps {
  mode: 'announcements' | 'analytics' | 'settings' | 'audit_logs';
}

export function AdminGovernancePanel({ mode }: AdminGovernancePanelProps) {
  const { apiFetch } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalyticsBundle | null>(null);
  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Announcement creation state
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annAudience, setAnnAudience] = useState('all_students');
  const [annCategory, setAnnCategory] = useState('announcement');
  const [saving, setSaving] = useState(false);

  // Audit filter state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('all');

  // Settings drafts
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'announcements') {
        const res = await apiFetch('/api/admin/announcements');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load announcements.');
        setAnnouncements(json.announcements ?? []);
      } else if (mode === 'analytics') {
        const res = await apiFetch('/api/admin/analytics');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load analytics.');
        setAnalytics(json as AdminAnalyticsBundle);
      } else if (mode === 'settings') {
        const res = await apiFetch('/api/admin/settings');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load Nepal settings.');
        const list = (json.settings ?? []) as SystemSettingItem[];
        setSettings(list);
        const drafts: Record<string, string> = {};
        for (const s of list) {
          drafts[s.settingKey] = JSON.stringify(s.valueJson, null, 2);
        }
        setSettingDrafts(drafts);
      } else if (mode === 'audit_logs') {
        const res = await apiFetch('/api/admin/audit-logs');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load audit logs.');
        setAuditLogs(json.logs ?? []);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to load governance module.',
      });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: annTitle,
          message: annMessage,
          audienceRole: annAudience,
          category: annCategory,
          isPublished: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to publish announcement.');
      setFeedback({
        type: 'success',
        message: `Published announcement "${json.announcement.title}".`,
      });
      setAnnTitle('');
      setAnnMessage('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Announcement creation failed.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAnnouncement = async (item: AnnouncementItem) => {
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/announcements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !item.isPublished }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update announcement.');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Update failed.',
      });
    }
  };

  const handleSaveSetting = async (settingKey: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const raw = settingDrafts[settingKey] || '{}';
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const res = await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settingKey, valueJson: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update Nepal system setting.');
      setFeedback({
        type: 'success',
        message: `Saved Nepal setting "${settingKey}" and recorded audit entry.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invalid JSON or setting update rejected.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }

  if (mode === 'announcements') {
    return (
      <div className="space-y-6">
        {feedback && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{feedback.message}</span>
          </div>
        )}

        <form
          onSubmit={(e) => void handleCreateAnnouncement(e)}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <BellRing className="h-4 w-4 text-red-700" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Publish Nepal Platform Announcement
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600">Headline</label>
              <input
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. NEB Class 12 Routine & Model Questions Updated"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Audience</label>
                <select
                  value={annAudience}
                  onChange={(e) => setAnnAudience(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="all_students">All Students</option>
                  <option value="plus_two">+2 Students</option>
                  <option value="educators">Educators</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Category</label>
                <select
                  value={annCategory}
                  onChange={(e) => setAnnCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="announcement">Announcement</option>
                  <option value="exam_alert">Exam Alert</option>
                  <option value="scholarship">Scholarship</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Message</label>
            <textarea
              required
              rows={2}
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              placeholder="Notice details shown on student workspaces..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Publishing...' : 'Broadcast Notice'}
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Notifications &amp; Announcements ({announcements.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                    <span>{item.audienceRole}</span>
                    <span>·</span>
                    <span>{item.category}</span>
                    <span>·</span>
                    <span className={item.isPublished ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {item.isPublished ? 'Published' : 'Unpublished'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-900">{item.title}</div>
                  <p className="text-xs text-slate-600">{item.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleAnnouncement(item)}
                  className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-100"
                >
                  {item.isPublished ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'analytics') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-slate-500">Bookmarks Saved</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {analytics?.totals.bookmarksCount ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-slate-500">Study Notes</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {analytics?.totals.notesCount ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-slate-500">Mistake Book Entries</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {analytics?.totals.mistakesLogged ?? 0}
            </div>
            <div className="text-[11px] text-emerald-700">
              {analytics?.totals.mistakesResolved ?? 0} resolved
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-slate-500">AI Question Governance</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {analytics?.aiGovernance.pendingAiQuestions ?? 0}
            </div>
            <div className="text-[11px] text-slate-500">
              pending review ({analytics?.aiGovernance.approvedAiQuestions ?? 0} approved)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Subject Performance &amp; Weak Topic Density
              </h3>
              <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 px-3 text-right font-medium">Attempts</th>
                    <th className="py-2 px-3 text-right font-medium">Avg Accuracy</th>
                    <th className="py-2 pl-3 text-right font-medium">Weak Topics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analytics?.subjectPerformance ?? []).map((row) => (
                    <tr key={row.subjectName}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{row.subjectName}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {row.totalAttempts}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {row.avgAccuracy}%
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-amber-800">
                        {row.weakTopicCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Mock Examination Completion &amp; Accuracy
              </h3>
              <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Examination</th>
                    <th className="py-2 px-3 text-right font-medium">Attempts</th>
                    <th className="py-2 px-3 text-right font-medium">Submitted</th>
                    <th className="py-2 pl-3 text-right font-medium">Avg Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analytics?.examCompletion ?? []).map((ex) => (
                    <tr key={ex.examTitle}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{ex.examTitle}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {ex.attemptsCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {ex.submittedCount}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums">
                        {ex.avgAccuracyPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'settings') {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
          <div>
            <strong className="font-semibold text-slate-900">
              Nepal-Scoped Active Platform Configuration:
            </strong>{' '}
            Region defaults are locked to{' '}
            <span className="font-mono">
              {NEPAL_PLATFORM_DEFAULTS.countryName} ({NEPAL_PLATFORM_DEFAULTS.countryCode}) ·{' '}
              {NEPAL_PLATFORM_DEFAULTS.timezone} · {NEPAL_PLATFORM_DEFAULTS.currencyCode}
            </span>
            . Curriculum taxonomy remains clean and country-aware internally without exposing any
            international switcher UI.
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {settings.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <h3 className="font-display text-sm font-semibold text-slate-900">{s.label}</h3>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {s.settingKey} · Scope: {s.countryCode} · {s.category}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveSetting(s.settingKey)}
                  className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-slate-600">{s.description}</p>
              <textarea
                rows={4}
                aria-label={`Configuration JSON for ${s.settingKey}`}
                value={settingDrafts[s.settingKey] ?? ''}
                onChange={(e) =>
                  setSettingDrafts((prev) => ({ ...prev, [s.settingKey]: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Audit Logs
  const filteredLogs = auditLogs.filter((l) => {
    if (auditEntityFilter !== 'all' && l.targetEntity !== auditEntityFilter) return false;
    if (!auditSearch.trim()) return true;
    const q = auditSearch.trim().toLowerCase();
    return (
      l.actorEmail.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.summary.toLowerCase().includes(q)
    );
  });

  const entities = Array.from(new Set(auditLogs.map((l) => l.targetEntity)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Platform Governance &amp; Audit Trail ({filteredLogs.length})
            </h3>
            <p className="text-xs text-slate-500">
              Immutable record of administrative actions, lifecycle approvals, RBAC mutations, and
              moderation decisions.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            placeholder="Search actor, action, summary..."
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          />
          <select
            value={auditEntityFilter}
            onChange={(e) => setAuditEntityFilter(e.target.value)}
            aria-label="Filter audit logs by entity"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
          >
            <option value="all">All Entities</option>
            {entities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">Timestamp</th>
              <th className="py-2 px-3 font-medium">Actor</th>
              <th className="py-2 px-3 font-medium">Action &amp; Target</th>
              <th className="py-2 pl-3 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="align-top hover:bg-slate-50/70">
                <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-mono text-[11px] font-medium text-slate-900">
                    {log.actorEmail}
                  </div>
                  <div className="text-[11px] text-slate-500">{log.actorRole}</div>
                </td>
                <td className="py-2.5 px-3 font-mono text-[11px]">
                  <div className="font-semibold text-slate-800">{log.action}</div>
                  <div className="text-slate-500">
                    {log.targetEntity}
                    {log.targetId ? ` #${log.targetId}` : ''}
                  </div>
                </td>
                <td className="py-2.5 pl-3 text-slate-700">{log.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
