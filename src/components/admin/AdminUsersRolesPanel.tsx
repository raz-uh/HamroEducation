import { useCallback, useEffect, useState } from 'react';
import { Building2, Search, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { RbacGovernanceView } from '../RbacGovernanceView.tsx';
import type { DirectoryUserItem, InstitutionItem } from '../../types/api.ts';

interface AdminUsersRolesPanelProps {
  mode: 'users' | 'roles';
  onOpenAuth: () => void;
}

export function AdminUsersRolesPanel({ mode, onOpenAuth }: AdminUsersRolesPanelProps) {
  const { apiFetch, user } = useAuth();
  const [usersList, setUsersList] = useState<DirectoryUserItem[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const loadDirectory = useCallback(async () => {
    if (mode !== 'users') return;
    setLoading(true);
    setFeedback(null);
    try {
      const [usersRes, instRes] = await Promise.all([
        apiFetch('/api/admin/users'),
        fetch('/api/institutions'),
      ]);
      const usersJson = await usersRes.json();
      if (!usersRes.ok) {
        throw new Error(usersJson.error || 'Failed to load user directory.');
      }
      setUsersList(usersJson.users ?? []);
      if (instRes.ok) {
        const instJson = await instRes.json();
        setInstitutions(instJson.institutions ?? []);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to load users.',
      });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, mode]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  if (mode === 'roles') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <strong className="font-semibold">Privilege Escalation Guard Active:</strong> Only a{' '}
            <span className="font-mono">super_administrator</span> may grant or revoke{' '}
            <span className="font-mono">super_administrator</span> assignments. Every role change is
            permanently recorded in <span className="font-mono">audit_logs</span>.
          </div>
        </div>
        <RbacGovernanceView onOpenAuth={onOpenAuth} />
      </div>
    );
  }

  const handleToggleStatus = async (target: DirectoryUserItem) => {
    const nextStatus = target.status === 'active' ? 'suspended' : 'active';
    setSavingUserId(target.id);
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update account status.');
      setFeedback({
        type: 'success',
        message: `Updated ${target.email} status to ${nextStatus}.`,
      });
      await loadDirectory();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to update account status.',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleAssignInstitution = async (target: DirectoryUserItem, institutionIdRaw: string) => {
    setSavingUserId(target.id);
    setFeedback(null);
    try {
      const institutionId = institutionIdRaw ? Number(institutionIdRaw) : null;
      const res = await apiFetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ institutionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to assign institution.');
      setFeedback({
        type: 'success',
        message: `Updated institution affiliation for ${target.email}.`,
      });
      await loadDirectory();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Institution assignment failed.',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const filtered = usersList.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.roles.some((r) => r.roleName.toLowerCase().includes(q) || r.roleSlug.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Nepal User Directory &amp; Account Governance
            </h2>
            <p className="text-xs text-slate-500">
              Manage active/suspended account status, institutional affiliation, and inspect verified
              roles across {usersList.length} registered accounts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter email, name, or role..."
                className="w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'suspended')}
              aria-label="Filter users by status"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {loading ? (
          <div className="mt-4 h-48 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Account</th>
                  <th className="py-2.5 px-3 font-medium">Roles &amp; Scope</th>
                  <th className="py-2.5 px-3 font-medium">Institution</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const isSelf = user?.id === u.id;
                  const currentInstId =
                    u.roles.find((r) => r.institutionId !== null)?.institutionId ?? '';
                  return (
                    <tr key={u.id} className="align-top hover:bg-slate-50/70">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-slate-900">
                          {u.fullName}{' '}
                          {isSelf && (
                            <span className="ml-1 font-mono text-[10px] text-blue-700">(You)</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Provider: {u.authProvider} · Joined{' '}
                          {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          {u.roles.map((r) => (
                            <div key={r.assignmentId} className="text-slate-700">
                              <span className="font-medium text-slate-900">{r.roleName}</span>
                              <span className="text-slate-400"> · </span>
                              <span className="text-slate-500">
                                {r.institutionName || 'Nepal Global'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <select
                            aria-label={`Assign institution for ${u.email}`}
                            defaultValue={String(currentInstId)}
                            disabled={savingUserId === u.id}
                            onChange={(e) => void handleAssignInstitution(u, e.target.value)}
                            className="max-w-[200px] rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800"
                          >
                            <option value="">Independent / Unassigned</option>
                            {institutions.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {inst.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                            u.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {u.status === 'active' ? (
                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          disabled={isSelf || savingUserId === u.id}
                          onClick={() => void handleToggleStatus(u)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                            u.status === 'active'
                              ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No user accounts match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
