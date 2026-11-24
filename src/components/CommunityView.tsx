import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Flag,
  MessageSquare,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { CommunityFeedResponse, DiscussionPostItem } from '../types/api.ts';

interface CommunityViewProps {
  onOpenAuth: () => void;
}

export function CommunityView({ onOpenAuth }: CommunityViewProps) {
  const { user, apiFetch } = useAuth();
  const [feed, setFeed] = useState<CommunityFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedGroupSlug, setSelectedGroupSlug] = useState('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unanswered' | 'teacher_verified'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [postGroupId, setPostGroupId] = useState<number>(0);
  const [postType, setPostType] = useState<'question' | 'explanation' | 'resource_tip'>('question');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postTags, setPostTags] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Reply drafts per post
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [submittingReplyPostId, setSubmittingReplyPostId] = useState<number | null>(null);

  // Report modal/inline drawer state
  const [reportingTarget, setReportingTarget] = useState<{
    targetType: 'post' | 'comment';
    targetId: number;
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Spam or promotional link');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedGroupSlug !== 'all') params.set('groupSlug', selectedGroupSlug);
      if (activeFilter !== 'all') params.set('filter', activeFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await apiFetch(`/api/community?${params.toString()}`);
      const json = (await res.json()) as CommunityFeedResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load community feed.');
      setFeed(json);
      if (json.groups.length > 0 && postGroupId === 0) {
        setPostGroupId(json.groups[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load community discussions.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, apiFetch, postGroupId, searchQuery, selectedGroupSlug]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    setSubmittingPost(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch('/api/community/posts', {
        method: 'POST',
        body: JSON.stringify({
          groupId: postGroupId,
          title: postTitle,
          body: postBody,
          postType,
          tags: postTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not publish question.');
      setPostTitle('');
      setPostBody('');
      setPostTags('');
      setComposerOpen(false);
      setNotice('Discussion published cleanly after Youth Safety screening.');
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post creation failed.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleReplySubmit = async (postId: number) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    const body = (replyDrafts[postId] ?? '').trim();
    if (body.length < 2) return;
    setSubmittingReplyPostId(postId);
    setError(null);
    try {
      const res = await apiFetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not post reply.');
      setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply submission failed.');
    } finally {
      setSubmittingReplyPostId(null);
    }
  };

  const handleToggleVote = async (targetType: 'post' | 'comment', targetId: number) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await apiFetch('/api/community/vote', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId }),
      });
      if (res.ok) {
        await loadFeed();
      }
    } catch {
      // ignore
    }
  };

  const handleVerifyAnswer = async (commentId: number, verified: boolean) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/community/comments/${commentId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ verified }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to verify answer.');
      setNotice(verified ? 'Answer marked as Teacher-Verified.' : 'Teacher verification removed.');
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification update failed.');
    }
  };

  const handleSubmitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !reportingTarget) {
      onOpenAuth();
      return;
    }
    setSubmittingReport(true);
    setError(null);
    try {
      const res = await apiFetch('/api/community/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: reportingTarget.targetType,
          targetId: reportingTarget.targetId,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Report could not be submitted.');
      setReportingTarget(null);
      setReportDetails('');
      setNotice('Thank you. Your report has been routed to Hamro Education Youth Safety Moderators.');
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report submission failed.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleModerationAction = async (
    reportId: number,
    targetType: 'post' | 'comment',
    targetId: number,
    actionType: 'approve' | 'hide' | 'dismiss_report',
  ) => {
    setError(null);
    try {
      const res = await apiFetch('/api/community/moderation/resolve', {
        method: 'POST',
        body: JSON.stringify({
          reportId,
          targetType,
          targetId,
          actionType,
          reasonNotes: `Moderator resolved report #${reportId} with ${actionType}.`,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Moderation action failed.');
      setNotice(`Moderation action (${actionType}) recorded in audit log.`);
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation failed.');
    }
  };

  const groups = feed?.groups ?? [];
  const posts: DiscussionPostItem[] = feed?.posts ?? [];

  return (
    <section aria-labelledby="community-heading" className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium text-red-700">
              Section 12 · Youth-Safe Academic Q&amp;A &amp; Study Communities
            </p>
            <h1
              id="community-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              Nepal Student Community &amp; Doubt Forum
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              Ask syllabus questions across Class 10 SEE, Class 11–12 NEB, and Bachelor Entrance
              prep rooms. Peer answers can be endorsed with a{' '}
              <span className="font-semibold text-emerald-700">Teacher-Verified Explanation</span>{' '}
              badge while student contact information remains strictly protected.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!user) onOpenAuth();
                else setComposerOpen((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {composerOpen ? 'Close Composer' : 'Ask a Study Question'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {/* Ask Question Composer */}
      {composerOpen && (
        <form
          onSubmit={(e) => void handleCreatePost(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              Post a Study Question or Explanation
            </h2>
            <span className="text-[11px] text-slate-500">
              Auto-screened for profanity, spam &amp; personal contact privacy
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Study Community Room</span>
              <select
                value={postGroupId}
                onChange={(e) => setPostGroupId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.academicLevel})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Post Category</span>
              <select
                value={postType}
                onChange={(e) =>
                  setPostType(e.target.value as 'question' | 'explanation' | 'resource_tip')
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                <option value="question">Doubt / Question</option>
                <option value="explanation">Concept Explanation</option>
                <option value="resource_tip">Exam / Study Tip</option>
              </select>
            </label>

            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Tags (comma-separated)</span>
              <input
                type="text"
                value={postTags}
                onChange={(e) => setPostTags(e.target.value)}
                placeholder="e.g., Physics, Torque, IOE"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>
          </div>

          <input
            type="text"
            required
            minLength={5}
            maxLength={160}
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
            placeholder="Clear title summarizing your syllabus doubt..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
          />

          <textarea
            required
            minLength={10}
            maxLength={3000}
            rows={4}
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
            placeholder="Share the question, what step you already tried, and where you got stuck. Do not include personal emails or phone numbers."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingPost}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submittingPost ? 'Screening & Publishing...' : 'Publish to Room'}
            </button>
          </div>
        </form>
      )}

      {/* Report Modal */}
      {reportingTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <form
            onSubmit={(e) => void handleSubmitReport(e)}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl"
          >
            <h2 id="report-dialog-title" className="font-display text-base font-bold text-slate-900">
              Report {reportingTarget.targetType === 'post' ? 'Discussion Post' : 'Reply'}
            </h2>
            <p className="text-xs text-slate-600 line-clamp-2">{reportingTarget.label}</p>

            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Safety or Accuracy Concern</span>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <option value="Spam or promotional link">Spam or promotional link</option>
                <option value="Inappropriate or disrespectful behavior">
                  Inappropriate or disrespectful behavior
                </option>
                <option value="Personal contact info / privacy risk">
                  Personal contact info / privacy risk
                </option>
                <option value="Factually incorrect academic solution">
                  Factually incorrect academic solution
                </option>
              </select>
            </label>

            <textarea
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional context for safety moderators..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportingTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReport}
                className="rounded-lg bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {submittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Rail: Groups & Youth Safety */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-red-700" aria-hidden="true" />
                Class, Subject &amp; Entrance Rooms
              </h2>
              <span className="font-mono text-xs text-slate-500">{groups.length}</span>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedGroupSlug('all')}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  selectedGroupSlug === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>All Study Communities</span>
                <span className="font-mono tabular-nums opacity-80">
                  {groups.reduce((acc, g) => acc + g.postCount, 0)}
                </span>
              </button>

              {groups.map((grp) => {
                const active = selectedGroupSlug === grp.slug;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedGroupSlug(grp.slug)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{grp.name}</p>
                      <p
                        className={`text-[10px] truncate ${
                          active ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {grp.groupType.toUpperCase()} · {grp.academicLevel}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums shrink-0 opacity-80">
                      {grp.postCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Youth Safety Rules Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
            <h2 className="font-display text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Youth Safety &amp; Privacy Controls
            </h2>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              {(feed?.youthSafetyRules ?? []).map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-[11px] font-bold text-emerald-700">0{i + 1}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Moderator Queue (Visible strictly to Moderators & Admins) */}
          {feed?.canModerate && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-amber-950">
                  Moderation Queue ({feed.moderationQueue.filter((m) => m.status === 'open').length}{' '}
                  open)
                </h2>
              </div>

              {feed.moderationQueue.length === 0 ? (
                <p className="text-xs text-amber-900">No community reports queued.</p>
              ) : (
                <ul className="space-y-2.5">
                  {feed.moderationQueue.slice(0, 6).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-amber-200 bg-white p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-amber-900 uppercase">
                          {item.targetType} #{item.targetType === 'post' ? item.postId : item.commentId}
                        </span>
                        <span className="font-mono text-[10px] uppercase text-slate-500">
                          {item.status}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900">{item.reason}</p>
                      <p className="text-slate-600 line-clamp-2">{item.targetPreview}</p>
                      {item.status === 'open' && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              void handleModerationAction(
                                item.id,
                                item.targetType,
                                (item.targetType === 'post' ? item.postId : item.commentId) || 0,
                                'approve',
                              )
                            }
                            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"
                          >
                            Keep &amp; Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleModerationAction(
                                item.id,
                                item.targetType,
                                (item.targetType === 'post' ? item.postId : item.commentId) || 0,
                                'hide',
                              )
                            }
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800"
                          >
                            Hide Content
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>

        {/* Right Column: Filter Bar + Discussion Feed */}
        <div className="lg:col-span-8 space-y-5">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter discussions">
              {[
                { id: 'all' as const, label: 'All Discussions' },
                { id: 'unanswered' as const, label: 'Unanswered' },
                { id: 'teacher_verified' as const, label: 'Teacher-Verified' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeFilter === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics, chapters..."
                aria-label="Search community discussions"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-6"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-2">
              <MessageSquare className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900">
                No discussions match the current room or filter.
              </p>
              <p className="text-xs text-slate-600">
                Try switching back to All Discussions or ask a new study question.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
                >
                  {/* Post Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-slate-600">
                      <span className="font-semibold text-red-700">{post.groupName}</span>
                      <span>·</span>
                      <span className="font-semibold text-slate-900">
                        {post.author.displayHandle}
                      </span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {post.author.trackLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {post.hasTeacherVerified && (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Teacher-Verified Explanation
                        </span>
                      )}
                      {!post.isAnswered && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-800">
                          Needs Answer
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setReportingTarget({
                            targetType: 'post',
                            targetId: post.id,
                            label: post.title,
                          })
                        }
                        aria-label={`Report post ${post.title}`}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:border-red-200 hover:text-red-700"
                      >
                        <Flag className="h-3 w-3" aria-hidden="true" />
                        Report
                      </button>
                    </div>
                  </div>

                  {/* Post Body */}
                  <div className="space-y-2">
                    <h2 className="font-display text-lg font-bold text-slate-900">{post.title}</h2>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {post.body}
                    </p>
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vote + Reply Count Bar */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleToggleVote('post', post.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono font-semibold tabular-nums transition-colors ${
                          post.userHasVoted
                            ? 'border-blue-700 bg-blue-50 text-blue-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                        {post.upvoteCount}
                      </button>

                      <span className="inline-flex items-center gap-1 text-slate-600 font-mono tabular-nums">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        {post.comments.length} replies
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Replies Thread */}
                  {post.comments.length > 0 && (
                    <div className="space-y-2.5 border-t border-slate-100 pt-3">
                      {post.comments.map((c) => (
                        <div
                          key={c.id}
                          className={`rounded-lg border p-3.5 space-y-2 ${
                            c.isTeacherVerified
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : 'border-slate-200 bg-slate-50/70'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {c.author.displayHandle}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {c.author.roleLabel}
                              </span>
                              {c.isTeacherVerified && (
                                <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                                  Teacher-Verified Explanation
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleToggleVote('comment', c.id)}
                                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] tabular-nums ${
                                  c.userHasVoted
                                    ? 'border-blue-700 bg-blue-50 text-blue-800'
                                    : 'border-slate-200 bg-white text-slate-600'
                                }`}
                              >
                                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                                {c.upvoteCount}
                              </button>

                              {feed?.canVerifyAnswers && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleVerifyAnswer(c.id, !c.isTeacherVerified)
                                  }
                                  className="rounded border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                                >
                                  {c.isTeacherVerified ? 'Unverify' : 'Mark Teacher-Verified'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setReportingTarget({
                                    targetType: 'comment',
                                    targetId: c.id,
                                    label: c.body.slice(0, 90),
                                  })
                                }
                                aria-label={`Report reply by ${c.author.displayHandle}`}
                                className="rounded p-1 text-slate-400 hover:text-red-700"
                              >
                                <Flag className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          <p className="whitespace-pre-line text-xs leading-relaxed text-slate-800">
                            {c.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Reply Box */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={replyDrafts[post.id] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder={
                        user
                          ? 'Write a helpful, clear explanation (no phone/email PII)...'
                          : 'Sign in to reply or upvote answers...'
                      }
                      aria-label={`Reply to ${post.title}`}
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={
                        submittingReplyPostId === post.id ||
                        (user ? (replyDrafts[post.id] ?? '').trim().length < 2 : false)
                      }
                      onClick={() => void handleReplySubmit(post.id)}
                      className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
                    >
                      {submittingReplyPostId === post.id ? 'Posting...' : 'Reply'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
