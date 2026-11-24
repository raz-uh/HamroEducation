import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookPlus, CheckCircle2, FileCheck2, Layers, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { EDITORIAL_LIFECYCLE_STAGES } from '../../lib/admin-governance.ts';
import type {
  AdminContentResourceItem,
  ContentSourceItem,
  CurriculumHierarchyResponse,
  EditorialLifecycleStage,
} from '../../types/api.ts';

interface AdminCurriculumContentPanelProps {
  mode: 'curriculum' | 'content';
}

interface FlatStreamOption {
  id: number;
  label: string;
}

interface FlatSubjectOption {
  id: number;
  gradeId: number;
  label: string;
}

interface FlatChapterOption {
  id: number;
  subjectId: number;
  label: string;
}

export function AdminCurriculumContentPanel({ mode }: AdminCurriculumContentPanelProps) {
  const { apiFetch, user } = useAuth();
  const [tree, setTree] = useState<CurriculumHierarchyResponse | null>(null);
  const [resources, setResources] = useState<AdminContentResourceItem[]>([]);
  const [sources, setSources] = useState<ContentSourceItem[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; slug: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Curriculum creation forms
  const [subStreamId, setSubStreamId] = useState<number>(0);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subCredits, setSubCredits] = useState('4');
  const [subCompulsory, setSubCompulsory] = useState(true);

  const [chapSubjectId, setChapSubjectId] = useState<number>(0);
  const [chapNumber, setChapNumber] = useState('1');
  const [chapTitle, setChapTitle] = useState('');
  const [chapSummary, setChapSummary] = useState('');

  const [topicChapterId, setTopicChapterId] = useState<number>(0);
  const [topicNumber, setTopicNumber] = useState('1.1');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicObjectives, setTopicObjectives] = useState('');

  // Content creation & lifecycle filter
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [reviewComments, setReviewComments] = useState<Record<number, string>>({});
  const [selectedSourceByRes, setSelectedSourceByRes] = useState<Record<number, string>>({});
  const [newCategorySlug, setNewCategorySlug] = useState('chapter-notes');
  const [newGradeId, setNewGradeId] = useState<number>(0);
  const [newSubjectId, setNewSubjectId] = useState<number>(0);
  const [newChapterId, setNewChapterId] = useState<number>(0);
  const [newSourceSlug, setNewSourceSlug] = useState('nepal-cdc-sanothimi');
  const [newInitialStage, setNewInitialStage] = useState<'Draft' | 'Review'>('Draft');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newNotesBody, setNewNotesBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const currRes = await fetch('/api/curriculum?country=NP');
      if (currRes.ok) {
        const currData = (await currRes.json()) as CurriculumHierarchyResponse;
        setTree(currData);

        const firstLevel = currData.curricula[0]?.educationLevels[0];
        const firstGrade = firstLevel?.grades[0];
        const firstStream = firstGrade?.streams[0];
        const firstSubject = firstStream?.subjects[0];
        const firstChapter = firstSubject?.chapters[0];

        if (firstStream && subStreamId === 0) setSubStreamId(firstStream.id);
        if (firstGrade && newGradeId === 0) setNewGradeId(firstGrade.id);
        if (firstSubject && chapSubjectId === 0) setChapSubjectId(firstSubject.id);
        if (firstSubject && newSubjectId === 0) setNewSubjectId(firstSubject.id);
        if (firstChapter && topicChapterId === 0) setTopicChapterId(firstChapter.id);
        if (firstChapter && newChapterId === 0) setNewChapterId(firstChapter.id);
      }

      if (mode === 'content') {
        const contentRes = await apiFetch('/api/admin/content');
        const contentJson = await contentRes.json();
        if (!contentRes.ok) {
          throw new Error(contentJson.error || 'Failed to load content governance list.');
        }
        setResources(contentJson.resources ?? []);
        setSources(contentJson.sources ?? []);
        setCategories(contentJson.categories ?? []);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to load module data.',
      });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, chapSubjectId, mode, newChapterId, newGradeId, newSubjectId, subStreamId, topicChapterId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Flatten curriculum nodes for selector dropdowns
  const streamOptions: FlatStreamOption[] = [];
  const gradeOptions: Array<{ id: number; label: string }> = [];
  const subjectOptions: FlatSubjectOption[] = [];
  const chapterOptions: FlatChapterOption[] = [];

  if (tree) {
    for (const curr of tree.curricula) {
      for (const lvl of curr.educationLevels) {
        for (const grade of lvl.grades) {
          gradeOptions.push({ id: grade.id, label: `${grade.name} (${curr.code})` });
          for (const st of grade.streams) {
            streamOptions.push({
              id: st.id,
              label: `${grade.name} · ${st.name}`,
            });
            for (const sub of st.subjects) {
              subjectOptions.push({
                id: sub.id,
                gradeId: grade.id,
                label: `${grade.code} · ${sub.code} — ${sub.name}`,
              });
              for (const ch of sub.chapters) {
                chapterOptions.push({
                  id: ch.id,
                  subjectId: sub.id,
                  label: `${sub.code} Ch ${ch.chapterNumber}: ${ch.title}`,
                });
              }
            }
          }
        }
      }
    }
  }

  const handleCreateSubject = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/curriculum/subjects', {
        method: 'POST',
        body: JSON.stringify({
          streamId: subStreamId,
          code: subCode,
          name: subName,
          creditHours: Number(subCredits || 4),
          isCompulsory: subCompulsory,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create subject.');
      setFeedback({ type: 'success', message: `Subject ${json.subject.code} created & logged.` });
      setSubCode('');
      setSubName('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to create subject.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateChapter = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/curriculum/chapters', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: chapSubjectId,
          chapterNumber: Number(chapNumber || 1),
          title: chapTitle,
          summary: chapSummary,
          estimatedHours: 8,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create chapter.');
      setFeedback({
        type: 'success',
        message: `Chapter ${json.chapter.chapterNumber}: ${json.chapter.title} added.`,
      });
      setChapTitle('');
      setChapSummary('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to create chapter.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTopic = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/curriculum/topics', {
        method: 'POST',
        body: JSON.stringify({
          chapterId: topicChapterId,
          topicNumber,
          title: topicTitle,
          learningObjectives: topicObjectives,
          difficultyLevel: 'intermediate',
          estimatedMinutes: 45,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create topic.');
      setFeedback({ type: 'success', message: `Topic ${json.topic.topicNumber} created.` });
      setTopicTitle('');
      setTopicObjectives('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to create topic.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateResource = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          categorySlug: newCategorySlug,
          gradeId: newGradeId,
          subjectId: newSubjectId,
          chapterId: newChapterId || null,
          title: newTitle,
          summary: newSummary,
          notesHeading: newTitle,
          notesBody: newNotesBody,
          sourceSlug: newSourceSlug,
          initialStage: newInitialStage,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save resource.');
      setFeedback({
        type: 'success',
        message: `Created "${json.resource.title}" in ${newInitialStage} stage.`,
      });
      setNewTitle('');
      setNewSummary('');
      setNewNotesBody('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create resource.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLifecycleMove = async (
    item: AdminContentResourceItem,
    nextStage: EditorialLifecycleStage,
  ) => {
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/content/${item.id}/lifecycle`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextStage,
          comments:
            reviewComments[item.id] ?? `Editorial move from ${item.lifecycleStage} to ${nextStage}`,
          sourceSlug: selectedSourceByRes[item.id] ?? item.sourceSlug ?? 'nepal-cdc-sanothimi',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lifecycle transition rejected.');
      setFeedback({
        type: 'success',
        message: `Moved "${item.title}" to ${nextStage}.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lifecycle transition failed.',
      });
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }

  if (mode === 'curriculum') {
    return (
      <div className="space-y-6">
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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Create Subject */}
          <form
            onSubmit={(e) => void handleCreateSubject(e)}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="h-4 w-4 text-red-700" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-slate-900">Add Subject</h3>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Class &amp; Stream</label>
              <select
                value={subStreamId}
                onChange={(e) => setSubStreamId(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              >
                {streamOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Code</label>
                <input
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. PHY201"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Credit Hours</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={subCredits}
                  onChange={(e) => setSubCredits(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Subject Title</label>
              <input
                required
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="e.g. Applied Mechanics"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={subCompulsory}
                onChange={(e) => setSubCompulsory(e.target.checked)}
              />
              Compulsory curriculum subject
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Create Subject
            </button>
          </form>

          {/* Create Chapter */}
          <form
            onSubmit={(e) => void handleCreateChapter(e)}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <BookPlus className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-slate-900">Add Chapter</h3>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Subject</label>
              <select
                value={chapSubjectId}
                onChange={(e) => setChapSubjectId(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              >
                {subjectOptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Unit #</label>
                <input
                  type="number"
                  min={1}
                  value={chapNumber}
                  onChange={(e) => setChapNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-slate-600">Chapter Title</label>
                <input
                  required
                  value={chapTitle}
                  onChange={(e) => setChapTitle(e.target.value)}
                  placeholder="e.g. Rotational Dynamics"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Syllabus Summary</label>
              <textarea
                rows={2}
                value={chapSummary}
                onChange={(e) => setChapSummary(e.target.value)}
                placeholder="CDC / NEB learning focus..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Add Chapter Unit
            </button>
          </form>

          {/* Create Topic */}
          <form
            onSubmit={(e) => void handleCreateTopic(e)}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileCheck2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-slate-900">Add Topic</h3>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Chapter</label>
              <select
                value={topicChapterId}
                onChange={(e) => setTopicChapterId(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              >
                {chapterOptions.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Topic #</label>
                <input
                  required
                  value={topicNumber}
                  onChange={(e) => setTopicNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-slate-600">Topic Title</label>
                <input
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="e.g. Moment of Inertia"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Learning Objectives</label>
              <textarea
                rows={2}
                value={topicObjectives}
                onChange={(e) => setTopicObjectives(e.target.value)}
                placeholder="Competencies expected in board exams..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Create Topic
            </button>
          </form>
        </div>

        {/* Hierarchy Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Active Nepal Curriculum Structure ({tree?.activeCountry?.name ?? 'Nepal'})
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Grades / Tiers</div>
              <div className="font-mono text-lg font-bold text-slate-900">{gradeOptions.length}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Streams</div>
              <div className="font-mono text-lg font-bold text-slate-900">{streamOptions.length}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Subjects</div>
              <div className="font-mono text-lg font-bold text-slate-900">{subjectOptions.length}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Chapters</div>
              <div className="font-mono text-lg font-bold text-slate-900">{chapterOptions.length}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Content Management & 6-Stage Editorial Lifecycle
  const canReview = Boolean(
    user?.permissions.includes('curriculum:review') || user?.permissions.includes('system:admin'),
  );
  const canPublish = Boolean(
    canReview || user?.permissions.includes('curriculum:publish'),
  );

  const filteredResources = resources.filter(
    (r) => stageFilter === 'all' || r.lifecycleStage === stageFilter,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <strong className="font-semibold text-slate-900">
            6-Stage Content Governance Workflow:
          </strong>{' '}
          <span className="font-mono">
            Draft → Review → Correction → Approved → Published → Archived
          </span>
          . Every resource requires an attributed verified Nepal source (<span className="font-mono">content_sources</span>) before publishing.
        </div>
      </div>

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

      {/* Create Draft Resource */}
      <form
        onSubmit={(e) => void handleCreateResource(e)}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Author New Curriculum Resource
            </h3>
            <p className="text-xs text-slate-500">
              New resources enter as Draft or Review and cannot be published without source attribution.
            </p>
          </div>
          <select
            value={newInitialStage}
            onChange={(e) => setNewInitialStage(e.target.value as 'Draft' | 'Review')}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="Draft">Save as Draft</option>
            <option value="Review">Submit to Review</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Category</label>
            <select
              value={newCategorySlug}
              onChange={(e) => setNewCategorySlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Grade</label>
            <select
              value={newGradeId}
              onChange={(e) => setNewGradeId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              {gradeOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Subject</label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              {subjectOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Verified Source</label>
            <select
              value={newSourceSlug}
              onChange={(e) => setNewSourceSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              {sources.map((src) => (
                <option key={src.id} value={src.slug}>
                  {src.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Resource Title</label>
            <input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. SEE Trigonometry Revision Summary & Identities"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Chapter Link (Optional)</label>
            <select
              value={newChapterId}
              onChange={(e) => setNewChapterId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              <option value={0}>General Subject Resource</option>
              {chapterOptions.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Short Summary</label>
            <input
              required
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Concise syllabus scope for learners..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Study Note Body</label>
            <input
              required
              value={newNotesBody}
              onChange={(e) => setNewNotesBody(e.target.value)}
              placeholder="Key theorems, formulas, and Nepal exam tips..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Create Resource Version 1'}
          </button>
        </div>
      </form>

      {/* Editorial Queue Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Editorial Content Queue ({filteredResources.length})
            </h3>
            <p className="text-xs text-slate-500">
              Review versions, verify source attribution, and control Published vs Archived visibility.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {['all', ...EDITORIAL_LIFECYCLE_STAGES].map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setStageFilter(stage)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                  stageFilter === stage
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {stage === 'all' ? 'All Stages' : stage}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredResources.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4 space-y-3 hover:border-slate-300"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase text-slate-500">
                      {item.gradeName} · {item.subjectName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      v{item.currentVersion}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        item.lifecycleStage === 'Published'
                          ? 'text-emerald-700'
                          : item.lifecycleStage === 'Correction'
                            ? 'text-red-700'
                            : item.lifecycleStage === 'Archived'
                              ? 'text-slate-500'
                              : 'text-amber-700'
                      }`}
                    >
                      [{item.lifecycleStage}]
                    </span>
                  </div>
                  <h4 className="mt-1 font-display text-sm font-semibold text-slate-900">
                    {item.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-600">{item.summary}</p>
                  {item.latestReviewComment && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Last review ({item.latestReviewDecision}): {item.latestReviewComment}
                    </p>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-500 shrink-0">
                  <div>Source: {item.sourceSlug || 'nepal-cdc-sanothimi'}</div>
                  <div>Updated: {new Date(item.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <select
                    aria-label={`Source attribution for ${item.title}`}
                    value={selectedSourceByRes[item.id] ?? item.sourceSlug ?? 'nepal-cdc-sanothimi'}
                    onChange={(e) =>
                      setSelectedSourceByRes((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                  >
                    {sources.map((src) => (
                      <option key={src.id} value={src.slug}>
                        {src.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={reviewComments[item.id] ?? ''}
                    onChange={(e) =>
                      setReviewComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Reviewer note or correction instruction..."
                    className="min-w-[200px] flex-1 rounded border border-slate-300 px-2.5 py-1 text-[11px]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleLifecycleMove(item, 'Review')}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLifecycleMove(item, 'Correction')}
                    className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Correction
                  </button>
                  {canReview && (
                    <button
                      type="button"
                      onClick={() => void handleLifecycleMove(item, 'Approved')}
                      className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-900 hover:bg-blue-100"
                    >
                      Approve
                    </button>
                  )}
                  {canPublish && (
                    <button
                      type="button"
                      onClick={() => void handleLifecycleMove(item, 'Published')}
                      className="rounded border border-emerald-200 bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                    >
                      Publish
                    </button>
                  )}
                  {canPublish && item.lifecycleStage !== 'Archived' && (
                    <button
                      type="button"
                      onClick={() => void handleLifecycleMove(item, 'Archived')}
                      className="rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
