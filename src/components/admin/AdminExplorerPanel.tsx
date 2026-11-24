import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Award, CheckCircle2, Compass, GraduationCap, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import type {
  CommunityFeedResponse,
  ExploreCareerPathItem,
  ExploreCollegeItem,
  ExploreCourseItem,
  ExploreEntranceRefItem,
  ExploreScholarshipItem,
  ExploreUniversityItem,
} from '../../types/api.ts';

interface AdminExplorerPanelProps {
  mode: 'entrance' | 'explorer' | 'moderation';
}

interface AdminExplorerCatalogPayload {
  entranceExams: ExploreEntranceRefItem[];
  universities: ExploreUniversityItem[];
  courses: ExploreCourseItem[];
  colleges: ExploreCollegeItem[];
  scholarships: ExploreScholarshipItem[];
  careerPaths: ExploreCareerPathItem[];
}

export function AdminExplorerPanel({ mode }: AdminExplorerPanelProps) {
  const { apiFetch } = useAuth();
  const [catalog, setCatalog] = useState<AdminExplorerCatalogPayload | null>(null);
  const [communityFeed, setCommunityFeed] = useState<CommunityFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Entrance form
  const [entSlug, setEntSlug] = useState('');
  const [entCode, setEntCode] = useState('');
  const [entName, setEntName] = useState('');
  const [entBody, setEntBody] = useState('');
  const [entCategory, setEntCategory] = useState('Engineering & IT');
  const [entPattern, setEntPattern] = useState('100 MCQs · 2 Hours');
  const [entEligibility, setEntEligibility] = useState('+2 Science or equivalent');
  const [entSource, setEntSource] = useState('Tribhuvan University Official Notice');
  const [entVerifiedDate, setEntVerifiedDate] = useState('2026-03-15');

  // Course form
  const [courseSlug, setCourseSlug] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCategory, setCourseCategory] = useState('IT & Computer Science');
  const [courseUniversityId, setCourseUniversityId] = useState<number>(1);
  const [courseFeeMin, setCourseFeeMin] = useState('350000');
  const [courseFeeMax, setCourseFeeMax] = useState('850000');
  const [courseSource, setCourseSource] = useState('Tribhuvan University Official Curriculum');
  const [courseVerifiedDate, setCourseVerifiedDate] = useState('2026-03-15');

  // Scholarship form
  const [schSlug, setSchSlug] = useState('');
  const [schTitle, setSchTitle] = useState('');
  const [schProvider, setSchProvider] = useState('Ministry of Education, Science & Technology (MoEST)');
  const [schCategory, setSchCategory] = useState('Government Scholarships');
  const [schBenefits, setSchBenefits] = useState('Full tuition waiver per MoEST merit guidelines');
  const [schDeadline, setSchDeadline] = useState('2083 Ashwin');
  const [schSource, setSchSource] = useState('MoEST Nepal Official Portal');
  const [schVerifiedDate, setSchVerifiedDate] = useState('2026-03-15');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'moderation') {
        const res = await apiFetch('/api/community');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load moderation queue.');
        setCommunityFeed(json as CommunityFeedResponse);
      } else {
        const res = await apiFetch('/api/admin/explorer');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load explorer catalog.');
        setCatalog(json as AdminExplorerCatalogPayload);
        if (json.universities?.length > 0 && courseUniversityId === 1) {
          setCourseUniversityId(json.universities[0].id);
        }
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to load governance records.',
      });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, courseUniversityId, mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveEntrance = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/explorer/entrance', {
        method: 'POST',
        body: JSON.stringify({
          slug: entSlug,
          code: entCode,
          name: entName,
          conductingBody: entBody,
          academicCategory: entCategory,
          examPatternSummary: entPattern,
          eligibilitySummary: entEligibility,
          source: entSource,
          lastVerifiedDate: entVerifiedDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save entrance exam.');
      setFeedback({
        type: 'success',
        message: `Saved verified entrance exam "${json.entranceExam.name}".`,
      });
      setEntSlug('');
      setEntCode('');
      setEntName('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Entrance save failed.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCourse = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/explorer/courses', {
        method: 'POST',
        body: JSON.stringify({
          slug: courseSlug,
          code: courseCode,
          name: courseName,
          category: courseCategory,
          universityId: courseUniversityId,
          verifiedFeeMinNpr: Number(courseFeeMin || 350000),
          verifiedFeeMaxNpr: Number(courseFeeMax || 850000),
          source: courseSource,
          lastVerifiedDate: courseVerifiedDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save course.');
      setFeedback({
        type: 'success',
        message: `Added verified bachelor course "${json.course.name}".`,
      });
      setCourseSlug('');
      setCourseCode('');
      setCourseName('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Course save failed.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScholarship = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/explorer/scholarships', {
        method: 'POST',
        body: JSON.stringify({
          slug: schSlug,
          title: schTitle,
          provider: schProvider,
          category: schCategory,
          financialBenefits: schBenefits,
          applicationDeadline: schDeadline,
          source: schSource,
          lastVerifiedDate: schVerifiedDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save scholarship.');
      setFeedback({
        type: 'success',
        message: `Added verified scholarship "${json.scholarship.title}".`,
      });
      setSchSlug('');
      setSchTitle('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Scholarship save failed.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResolveReport = async (
    reportId: number,
    targetType: 'post' | 'comment',
    targetId: number,
    actionType: 'approve' | 'hide' | 'restore' | 'dismiss_report',
  ) => {
    setFeedback(null);
    try {
      const res = await apiFetch('/api/community/moderation/resolve', {
        method: 'POST',
        body: JSON.stringify({
          reportId,
          targetType,
          targetId,
          actionType,
          reasonNotes: `Admin moderation decision: ${actionType}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Moderation action failed.');
      setFeedback({
        type: 'success',
        message: `Applied '${actionType}' on ${targetType} #${targetId} and logged audit entry.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to resolve report.',
      });
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }

  if (mode === 'moderation') {
    const queue = communityFeed?.moderationQueue ?? [];
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <strong className="font-semibold text-slate-900">
              Youth Safety &amp; Community Moderation Queue:
            </strong>{' '}
            Protect minors from spam, harassment, unverified leaks, or off-topic links. Every
            moderation decision updates both <span className="font-mono">moderation_actions</span>{' '}
            and platform <span className="font-mono">audit_logs</span>.
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

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Reported Community Items ({queue.length})
          </h3>
          {queue.length === 0 ? (
            <p className="py-6 text-xs text-slate-500">
              No community reports queued at this time.
            </p>
          ) : (
            <div className="space-y-3">
              {queue.map((rep) => {
                const targetId = rep.targetType === 'post' ? rep.postId : rep.commentId;
                return (
                  <div key={rep.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono font-semibold text-slate-800">
                        Report #{rep.id} · {rep.targetType} #{targetId} · Status: {rep.status}
                      </span>
                      <span className="text-slate-500">
                        Reporter: {rep.reporterHandle} · Content: {rep.targetModerationStatus}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-red-800">Reason: {rep.reason}</div>
                    <p className="rounded bg-slate-50 p-2.5 text-xs text-slate-700">
                      {rep.targetPreview}
                    </p>
                    {targetId && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            void handleResolveReport(rep.id, rep.targetType, targetId, 'hide')
                          }
                          className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100"
                        >
                          Hide Content
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleResolveReport(rep.id, rep.targetType, targetId, 'restore')
                          }
                          className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-900 hover:bg-blue-100"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleResolveReport(
                              rep.id,
                              rep.targetType,
                              targetId,
                              'dismiss_report',
                            )
                          }
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Dismiss Report
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'entrance') {
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
          onSubmit={(e) => void handleSaveEntrance(e)}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <GraduationCap className="h-4 w-4 text-red-700" aria-hidden="true" />
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Add / Update Nepal Bachelor Entrance Record
              </h3>
              <p className="text-xs text-slate-500">
                Mandatory official source and YYYY-MM-DD verification date enforced on the server.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              required
              value={entSlug}
              onChange={(e) => setEntSlug(e.target.value)}
              placeholder="Slug (e.g. bsc-csit-tu)"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              required
              value={entCode}
              onChange={(e) => setEntCode(e.target.value)}
              placeholder="Code (e.g. TU-CSIT)"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              required
              value={entName}
              onChange={(e) => setEntName(e.target.value)}
              placeholder="Official Exam Name"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              required
              value={entBody}
              onChange={(e) => setEntBody(e.target.value)}
              placeholder="Conducting Body (e.g. TU IOST)"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              required
              value={entCategory}
              onChange={(e) => setEntCategory(e.target.value)}
              placeholder="Academic Category"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              required
              value={entPattern}
              onChange={(e) => setEntPattern(e.target.value)}
              placeholder="Pattern (e.g. 100 MCQs · 2 Hours)"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              required
              value={entEligibility}
              onChange={(e) => setEntEligibility(e.target.value)}
              placeholder="Eligibility Summary"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              required
              value={entSource}
              onChange={(e) => setEntSource(e.target.value)}
              placeholder="Verified Official Source"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              required
              type="date"
              value={entVerifiedDate}
              onChange={(e) => setEntVerifiedDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Entrance Record'}
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Verified Entrance Examinations ({catalog?.entranceExams.length ?? 0})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Exam</th>
                  <th className="py-2 px-3 font-medium">Authority</th>
                  <th className="py-2 px-3 font-medium">Pattern</th>
                  <th className="py-2 pl-3 text-right font-medium">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(catalog?.entranceExams ?? []).map((ex) => (
                  <tr key={ex.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">
                        {ex.code} — {ex.name}
                      </div>
                      <div className="text-[11px] text-slate-500">{ex.academicCategory}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{ex.conductingBody}</td>
                    <td className="py-2.5 px-3 text-slate-600">{ex.examPatternSummary}</td>
                    <td className="py-2.5 pl-3 text-right font-mono text-[11px] text-slate-600">
                      <div>{ex.lastVerifiedDate}</div>
                      <div className="text-slate-400">{ex.source}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Career, Course, College & Scholarship Explorer Management
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={(e) => void handleSaveCourse(e)}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Compass className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Add Verified Bachelor Course
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={courseSlug}
              onChange={(e) => setCourseSlug(e.target.value)}
              placeholder="Slug (e.g. be-architecture-ioe)"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
            <input
              required
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="Code (e.g. B.Arch)"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <input
            required
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Course Title"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={courseUniversityId}
              onChange={(e) => setCourseUniversityId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              {(catalog?.universities ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.shortCode} — {u.name}
                </option>
              ))}
            </select>
            <input
              required
              value={courseCategory}
              onChange={(e) => setCourseCategory(e.target.value)}
              placeholder="Category"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={courseFeeMin}
              onChange={(e) => setCourseFeeMin(e.target.value)}
              placeholder="Min NPR Fee"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
            <input
              type="number"
              value={courseFeeMax}
              onChange={(e) => setCourseFeeMax(e.target.value)}
              placeholder="Max NPR Fee"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={courseSource}
              onChange={(e) => setCourseSource(e.target.value)}
              placeholder="Verified Official Source"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
            <input
              required
              type="date"
              value={courseVerifiedDate}
              onChange={(e) => setCourseVerifiedDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Save Course Record
          </button>
        </form>

        <form
          onSubmit={(e) => void handleSaveScholarship(e)}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Add Verified Nepal Scholarship
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={schSlug}
              onChange={(e) => setSchSlug(e.target.value)}
              placeholder="Slug (e.g. neb-merit-2083)"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
            <input
              required
              value={schCategory}
              onChange={(e) => setSchCategory(e.target.value)}
              placeholder="Category"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <input
            required
            value={schTitle}
            onChange={(e) => setSchTitle(e.target.value)}
            placeholder="Scholarship Title"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
          <input
            required
            value={schProvider}
            onChange={(e) => setSchProvider(e.target.value)}
            placeholder="Provider / Ministry / University"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={schBenefits}
              onChange={(e) => setSchBenefits(e.target.value)}
              placeholder="Financial Benefits"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
            <input
              required
              value={schDeadline}
              onChange={(e) => setSchDeadline(e.target.value)}
              placeholder="Deadline Window"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={schSource}
              onChange={(e) => setSchSource(e.target.value)}
              placeholder="Verified Official Source"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
            <input
              required
              type="date"
              value={schVerifiedDate}
              onChange={(e) => setSchVerifiedDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Save Scholarship Record
          </button>
        </form>
      </div>

      {/* Catalog Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-base font-semibold text-slate-900">
          Verified Explorer Inventory
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Courses</div>
            <div className="font-mono text-lg font-bold text-slate-900">
              {catalog?.courses.length ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Colleges</div>
            <div className="font-mono text-lg font-bold text-slate-900">
              {catalog?.colleges.length ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Scholarships</div>
            <div className="font-mono text-lg font-bold text-slate-900">
              {catalog?.scholarships.length ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Career Roadmaps</div>
            <div className="font-mono text-lg font-bold text-slate-900">
              {catalog?.careerPaths.length ?? 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
