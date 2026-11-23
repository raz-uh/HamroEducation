import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Lock, Shield, Trash2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type {
  DirectoryUserItem,
  InstitutionItem,
  PermissionItem,
  RoleMatrixItem,
} from '../types/api.ts';

interface RbacGovernanceViewProps {
  onOpenAuth: () => void;
}

export function RbacGovernanceView({ onOpenAuth }: RbacGovernanceViewProps) {
  const { user, apiFetch } = useAuth();
  const [roles, setRoles] = useState<RoleMatrixItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUserItem[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Assignment form
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [targetRoleSlug, setTargetRoleSlug] = useState<string>('teacher');
  const [targetInstitutionId, setTargetInstitutionId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const canReadUsers = user?.permissions.includes('users:read') ?? false;
  const canAssignRoles = user?.permissions.includes('users:assign_role') ?? false;

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const [matrixRes, instRes] = await Promise.all([
        fetch('/api/rbac/matrix'),
        fetch('/api/institutions'),
      ]);
      if (matrixRes.ok) {
        const matrixData = await matrixRes.json();
        setRoles(matrixData.roles ?? []);
        setPermissions(matrixData.permissions ?? []);
      }
      if (instRes.ok) {
        const instData = await instRes.json();
        setInstitutions(instData.institutions ?? []);
      }
    } catch (err) {
      console.error('Failed to load RBAC matrix:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsersDirectory = useCallback(async () => {
    if (!user) {
      setDirectoryUsers([]);
      setUsersError(null);
      return;
    }
    try {
      const res = await apiFetch('/api/rbac/users');
      const json = await res.json();
      if (!res.ok) {
        setDirectoryUsers([]);
        setUsersError(json.error || 'Insufficient permissions to inspect user directory.');
        return;
      }
      setDirectoryUsers(json.users ?? []);
      setUsersError(null);
      if (!targetUserId && json.users?.length > 0) {
        setTargetUserId(String(json.users[0].id));
      }
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Unable to fetch users.');
    }
  }, [apiFetch, targetUserId, user]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    void loadUsersDirectory();
  }, [loadUsersDirectory]);

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/rbac/assign-role', {
        method: 'POST',
        body: JSON.stringify({
          userId: Number(targetUserId),
          roleSlug: targetRoleSlug,
          institutionId: targetInstitutionId ? Number(targetInstitutionId) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: json.error || 'Role assignment rejected.' });
        return;
      }
      setFeedback({
        type: 'success',
        message: `Assigned role "${targetRoleSlug}" to ${json.user.email}.`,
      });
      await loadUsersDirectory();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Role assignment failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (assignmentId: number) => {
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/rbac/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: json.error || 'Unable to revoke role.' });
        return;
      }
      setFeedback({ type: 'success', message: 'Role assignment revoked.' });
      await loadUsersDirectory();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to revoke assignment.',
      });
    }
  };

  return (
    <section aria-labelledby="rbac-heading" className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-medium text-red-700">Server-Side Role-Based Access Control</p>
        <h1
          id="rbac-heading"
          className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
        >
          12-Role Identity &amp; Permission Matrix
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          Every protected API endpoint verifies bearer credentials and enforces hierarchical
          role scopes (global, country, and institution) directly in PostgreSQL.
        </p>
      </div>

      {/* Current Session Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Current Security Principal</p>
            {user ? (
              <>
                <p className="text-base font-semibold text-slate-900">
                  {user.profile?.fullName || user.email}{' '}
                  <span className="font-mono text-xs font-normal text-slate-500">
                    ({user.email})
                  </span>
                </p>
                <p className="text-xs text-slate-600">
                  Active Roles:{' '}
                  <strong className="font-medium text-slate-900">
                    {user.roles.map((r) => r.name).join(' · ')}
                  </strong>
                  <span className="mx-2" aria-hidden="true">
                    /
                  </span>
                  Permissions:{' '}
                  <span className="font-mono text-slate-700">
                    {user.permissions.join(', ')}
                  </span>
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-900">Guest (Unauthenticated)</p>
                <p className="text-xs text-slate-600">
                  Effective permissions: <span className="font-mono">curriculum:read, institutions:read</span>
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {user ? 'Manage Account' : 'Sign In / Claim Admin'}
          </button>
        </div>
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
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* User Role Governance Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              User Directory &amp; Role Delegation
            </h2>
            <p className="text-xs text-slate-500">
              Requires <span className="font-mono">users:read</span> and{' '}
              <span className="font-mono">users:assign_role</span> server-side permissions.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            {canReadUsers ? (
              <>
                <UserCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                Authorized Governance Access
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Restricted Endpoint
              </>
            )}
          </span>
        </div>

        {!user ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-slate-900">
              Sign in as an Administrator or Institutional Administrator to manage user roles.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Guests and Students cannot enumerate user accounts or mutate RBAC assignments.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              Open Sign In
            </button>
          </div>
        ) : usersError ? (
          <div className="py-6 text-sm text-amber-900">
            <p className="font-medium">Server-Side RBAC Guard Active (403 Forbidden)</p>
            <p className="mt-1 text-xs text-amber-800">{usersError}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {canAssignRoles && (
              <form
                onSubmit={(e) => void handleAssignRole(e)}
                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4 sm:items-end"
              >
                <div>
                  <label htmlFor="assign-user" className="block text-xs font-medium text-slate-700">
                    User Account
                  </label>
                  <select
                    id="assign-user"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    {directoryUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="assign-role" className="block text-xs font-medium text-slate-700">
                    Role to Grant
                  </label>
                  <select
                    id="assign-role"
                    value={targetRoleSlug}
                    onChange={(e) => setTargetRoleSlug(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    {roles.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name} (Tier {r.hierarchyTier})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="assign-institution"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Institution Scope (Optional)
                  </label>
                  <select
                    id="assign-institution"
                    value={targetInstitutionId}
                    onChange={(e) => setTargetInstitutionId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    <option value="">Global / Platform-Wide</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !targetUserId}
                  className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Grant Role'}
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">User</th>
                    <th className="py-2.5 px-4 font-medium">Provider</th>
                    <th className="py-2.5 px-4 font-medium">Active Role Assignments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {directoryUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{u.fullName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-600">{u.authProvider}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {u.roles.map((r) => (
                            <div
                              key={r.assignmentId}
                              className="flex items-center justify-between gap-3 text-slate-700"
                            >
                              <span>
                                <strong className="font-medium text-slate-900">{r.roleName}</strong>
                                <span className="text-slate-400"> · </span>
                                <span>{r.institutionName || 'Global Scope'}</span>
                              </span>
                              {canAssignRoles && (
                                <button
                                  type="button"
                                  onClick={() => void handleRevoke(r.assignmentId)}
                                  aria-label={`Revoke ${r.roleName} from ${u.email}`}
                                  className="text-slate-400 hover:text-red-700"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 12-Role Matrix Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              System Roles &amp; Permission Bindings
            </h2>
            <p className="text-xs text-slate-500">
              All {roles.length} Section 15 roles mapped across {permissions.length} granular
              permissions.
            </p>
          </div>
          <Shield className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>

        {loading ? (
          <div className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Role Name</th>
                  <th className="py-2.5 px-4 font-medium">Scope</th>
                  <th className="py-2.5 px-4 font-medium text-right">Tier</th>
                  <th className="py-2.5 pl-4 font-medium">Granted Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map((role) => (
                  <tr key={role.id} className="align-top hover:bg-slate-50/70">
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-slate-900">{role.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{role.slug}</div>
                      <p className="mt-1 max-w-xs text-slate-600">{role.description}</p>
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-700">{role.scopeType}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800">
                      {role.hierarchyTier}
                    </td>
                    <td className="py-3.5 pl-4 font-mono text-[11px] text-slate-600 leading-relaxed">
                      {role.permissions.map((p) => p.code).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
