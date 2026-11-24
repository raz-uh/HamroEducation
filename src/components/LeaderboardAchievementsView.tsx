import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Shield,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { StudentSubNav } from './StudentSubNav.tsx';
import { BADGE_CATALOG } from '../lib/student-features.ts';

type LeaderboardVisibility = 'masked' | 'display_name' | 'private';

interface LeaderboardAchievementsViewProps {
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

type BoardType =
  | 'weekly'
  | 'monthly'
  | 'class_wise'
  | 'subject_wise'
  | 'mock_exam'
  | 'improvement';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  isCurrentUser: boolean;
  gradeOrTrack: string;
  subjectFocus: string;
  testsCompleted: number;
  questionsSolved: number;
  accuracyPercent: number;
  improvementDelta: number;
  latestScore: number;
  points: number;
}

interface LeaderboardBundle {
  boardType: BoardType;
  myPrivacy: {
    visibility: LeaderboardVisibility;
    displayName: string;
  };
  entries: LeaderboardEntry[];
}

interface AchievementItem {
  badgeSlug: string;
  badgeName: string;
  description: string;
  category: string;
  progressValue: number;
  targetValue: number;
  unlockedAt: string | null;
}

const BOARD_TABS: Array<{ id: BoardType; label: string }> = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'class_wise', label: 'Class-wise' },
  { id: 'subject_wise', label: 'Subject-wise' },
  { id: 'mock_exam', label: 'Mock Examination' },
  { id: 'improvement', label: 'Improvement-based' },
];

export function LeaderboardAchievementsView({
  onNavigate,
  onOpenAuth,
}: LeaderboardAchievementsViewProps) {
  const { user, apiFetch, refreshSession } = useAuth();
  const [boardType, setBoardType] = useState<BoardType>('weekly');
  const [filterVal, setFilterVal] = useState('all');
  const [bundle, setBundle] = useState<LeaderboardBundle | null>(null);
  const [badges, setBadges] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [visibility, setVisibility] = useState<LeaderboardVisibility>('masked');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ boardType });
      if (filterVal !== 'all') qs.set('filter', filterVal);

      const lbRes = await apiFetch(`/api/dashboard/leaderboard?${qs.toString()}`);
      const lbJson = (await lbRes.json()) as LeaderboardBundle & { error?: string };
      if (!lbRes.ok) throw new Error(lbJson.error || 'Failed to load leaderboards.');
      setBundle(lbJson);
      setVisibility(lbJson.myPrivacy.visibility);
      setDisplayNameInput(lbJson.myPrivacy.displayName || '');

      if (user) {
        const dashRes = await apiFetch('/api/dashboard');
        if (dashRes.ok) {
          const dashJson = (await dashRes.json()) as { achievements?: AchievementItem[] };
          setBadges(dashJson.achievements ?? []);
        }
      } else {
        setBadges(
          BADGE_CATALOG.map((b) => ({
            badgeSlug: b.code,
            badgeName: b.title,
            description: b.description,
            category: b.category,
            progressValue: 0,
            targetValue: 1,
            unlockedAt: null,
          })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load leaderboards.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, boardType, filterVal, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    setSavingPrivacy(true);
    setPrivacyNotice(null);
    try {
      const res = await apiFetch('/api/dashboard/privacy', {
        method: 'PATCH',
        body: JSON.stringify({
          visibility,
          displayName: displayNameInput,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to update privacy settings.');
      await refreshSession();
      await loadData();
      setPrivacyNotice('Leaderboard privacy preference updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update privacy.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  return (
    <section aria-labelledby="leaderboard-heading" className="space-y-6">
      <StudentSubNav active="leaderboard" onNavigate={onNavigate} />

      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium text-red-700">
          Milestone Recognition &amp; Student Privacy Controls
        </p>
        <h1
          id="leaderboard-heading"
          className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          Achievements &amp; Privacy-Safe Leaderboards
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Unlock learning milestones automatically and compare progress across Weekly, Monthly,
          Class-wise, Subject-wise, Mock Exam, and Improvement rankings without exposing personal
          emails or phone numbers.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Milestone Badges Grid */}
      <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Automatic Student Milestone Badges
            </h2>
          </div>
          {!user && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline"
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              Sign in to track badge unlocks
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge) => {
            const unlocked = badge.unlockedAt !== null;
            const pct = Math.min(
              100,
              Math.round((badge.progressValue / Math.max(1, badge.targetValue)) * 100),
            );
            return (
              <div
                key={badge.badgeSlug}
                className={`rounded-xl border p-4 space-y-2 ${
                  unlocked
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono uppercase text-[11px] text-slate-500">
                    {badge.category}
                  </span>
                  {unlocked ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Unlocked
                    </span>
                  ) : (
                    <span className="font-mono text-slate-500 tabular-nums">
                      {badge.progressValue}/{badge.targetValue}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-sm font-bold text-slate-900">{badge.badgeName}</h3>
                <p className="text-xs leading-snug text-slate-600">{badge.description}</p>
                <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200">
                  <div
                    className={`h-full ${unlocked ? 'bg-emerald-600' : 'bg-slate-600'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {/* Privacy Controls + Leaderboards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {BOARD_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setBoardType(tab.id);
                      setFilterVal('all');
                    }}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      boardType === tab.id
                        ? 'border-red-700 bg-red-700 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {(boardType === 'class_wise' || boardType === 'subject_wise') && (
                <select
                  value={filterVal}
                  onChange={(e) => setFilterVal(e.target.value)}
                  aria-label="Filter leaderboard ranking"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                >
                  <option value="all">All</option>
                  {boardType === 'class_wise' ? (
                    <>
                      <option value="SEE">SEE / Class 10</option>
                      <option value="Class 12">Class 12</option>
                      <option value="IOE">IOE Engineering</option>
                      <option value="BSc CSIT">BSc CSIT</option>
                    </>
                  ) : (
                    <>
                      <option value="Physics">Physics</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Computer">Computer Science</option>
                      <option value="Accountancy">Accountancy</option>
                    </>
                  )}
                </select>
              )}
            </div>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-red-700" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  {BOARD_TABS.find((t) => t.id === boardType)?.label} Standings
                </h2>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                PII Hidden · Privacy-Safe Aliases
              </span>
            </div>

            {loading ? (
              <div className="p-6 h-48 animate-pulse" />
            ) : !bundle || bundle.entries.length === 0 ? (
              <p className="p-6 text-xs text-slate-600">
                No ranked learners match this filter yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Learner Alias</th>
                      <th className="px-4 py-3 font-semibold">Track / Focus</th>
                      <th className="px-4 py-3 font-semibold text-right">Solved</th>
                      <th className="px-4 py-3 font-semibold text-right">Accuracy</th>
                      <th className="px-4 py-3 font-semibold text-right">
                        {boardType === 'improvement' ? 'Gain' : 'Points'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bundle.entries.map((entry) => (
                      <tr
                        key={`${entry.rank}-${entry.displayName}`}
                        className={entry.isCurrentUser ? 'bg-red-50/60' : 'hover:bg-slate-50/70'}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 tabular-nums">
                          #{entry.rank}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {entry.displayName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {entry.gradeOrTrack} · {entry.subjectFocus}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                          {entry.questionsSolved}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700 tabular-nums">
                          {entry.accuracyPercent}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {boardType === 'improvement'
                            ? `+${entry.improvementDelta}%`
                            : entry.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        {/* Privacy Settings Sidebar */}
        <aside className="lg:col-span-4">
          <form
            onSubmit={(e) => void handleSavePrivacy(e)}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="h-4 w-4 text-slate-700" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Leaderboard Privacy Controls
              </h2>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Hamro Education never displays your email address, phone number, or full identity on
              public rankings. Choose how your name appears:
            </p>

            <div className="space-y-2">
              {[
                {
                  id: 'masked' as LeaderboardVisibility,
                  label: 'Masked Name (Recommended)',
                  desc: 'Shows masked initials like Aa*** S.',
                  icon: Shield,
                },
                {
                  id: 'display_name' as LeaderboardVisibility,
                  label: 'Chosen Display Handle',
                  desc: 'Shows a custom nickname you pick below.',
                  icon: Eye,
                },
                {
                  id: 'private' as LeaderboardVisibility,
                  label: 'Private (Hidden from Others)',
                  desc: 'Only you see your rank; hidden from peers.',
                  icon: EyeOff,
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = visibility === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVisibility(opt.id)}
                    className={`flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        active ? 'text-red-700' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-[11px] text-slate-500">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Public Display Handle (optional)
              </label>
              <input
                type="text"
                maxLength={32}
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="e.g., KathmanduScholar"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            {privacyNotice && (
              <p className="text-xs font-semibold text-emerald-700">{privacyNotice}</p>
            )}

            <button
              type="submit"
              disabled={savingPrivacy}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {!user
                ? 'Sign In to Save Privacy Settings'
                : savingPrivacy
                  ? 'Saving Preference...'
                  : 'Save Privacy Preference'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
