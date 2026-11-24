import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardCheck, FileSpreadsheet, Pencil, ShieldAlert, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { EDITORIAL_LIFECYCLE_STAGES, normalizeLifecycleStage } from '../../lib/admin-governance.ts';
import type {
  AdminExamItem,
  AdminExamResultSummary,
  CsvImportReport,
  EditorialLifecycleStage,
  QuestionBankItem,
} from '../../types/api.ts';

interface AdminQuestionExamPanelProps {
  mode: 'questions' | 'exams';
}

const SAMPLE_NEPAL_CSV = `examination,academic_level,subject,chapter,topic,question_type,difficulty,prompt,option_a,option_b,option_c,option_d,correct_answer,explanation,marks,negative_marks,source
SEE,Secondary / SEE,Compulsory Mathematics,Quadratic Equations,Roots & Discriminant,single_mcq,medium,"If the discriminant b^2 - 4ac of a quadratic equation is equal to zero, the roots are:",Imaginary and unequal,Real and equal,Real and distinct,Irrational only,B,A zero discriminant yields two identical real roots x = -b/(2a).,1,0,Nepal CDC Model Set 2082
IOE,Bachelor Entrance,Physics,Electrostatics,Coulomb Law,numerical,medium,"Calculate the force in Newtons between two +2 uC charges placed 1 meter apart in vacuum (use k = 9e9 Nm^2/C^2).",,,,,0.036,F = k*q1*q2/r^2 = 9e9 * 4e-12 / 1 = 0.036 N.,2,0.2,IOE Pulchowk Practice Archive`;

export function AdminQuestionExamPanel({ mode }: AdminQuestionExamPanelProps) {
  const { apiFetch, user } = useAuth();
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [examsList, setExamsList] = useState<AdminExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // CSV Bulk Import state
  const [csvText, setCsvText] = useState(SAMPLE_NEPAL_CSV);
  const [csvInitialStage, setCsvInitialStage] = useState<'Draft' | 'Review'>('Review');
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvReport, setCsvReport] = useState<CsvImportReport | null>(null);

  // Question filter & inline edit
  const [qStageFilter, setQStageFilter] = useState<string>('all');
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editSource, setEditSource] = useState('');

  // Exam form state
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [examCategory, setExamCategory] = useState('school');
  const [examSlug, setExamSlug] = useState('see');
  const [examLevel, setExamLevel] = useState('Secondary / SEE');
  const [examSubjectScope, setExamSubjectScope] = useState('Mathematics & Science');
  const [examTotalMarks, setExamTotalMarks] = useState('100');
  const [examDuration, setExamDuration] = useState('60');
  const [examNegative, setExamNegative] = useState(false);
  const [examDeduction, setExamDeduction] = useState('0.25');
  const [examRandomQ, setExamRandomQ] = useState(true);
  const [examRandomOpt, setExamRandomOpt] = useState(true);
  const [examAttemptLimit, setExamAttemptLimit] = useState('5');
  const [examStatus, setExamStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [examSaving, setExamSaving] = useState(false);

  // Exam results drilldown
  const [selectedExamForResults, setSelectedExamForResults] = useState<AdminExamItem | null>(null);
  const [examResults, setExamResults] = useState<AdminExamResultSummary[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'questions') {
        const res = await apiFetch('/api/question-bank');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load question bank.');
        setQuestions(json.questions ?? []);
      } else {
        const res = await apiFetch('/api/admin/exams');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load exams.');
        setExamsList(json.exams ?? []);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to load records.',
      });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canReview = Boolean(
    user?.permissions.includes('curriculum:review') || user?.permissions.includes('system:admin'),
  );

  const handleBulkImportCsv = async (e: FormEvent) => {
    e.preventDefault();
    setImportingCsv(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/admin/questions/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvText, initialStage: csvInitialStage }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'CSV import failed.');
      setCsvReport(json as CsvImportReport);
      setFeedback({
        type: 'success',
        message: `Imported ${json.importedCount} questions (${json.skippedDuplicateCount} duplicates skipped, ${json.errorCount} invalid rows).`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'CSV import failed.',
      });
    } finally {
      setImportingCsv(false);
    }
  };

  const handleTransitionQuestion = async (
    q: QuestionBankItem,
    nextStage: EditorialLifecycleStage,
  ) => {
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/questions/${q.id}/lifecycle`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextStage,
          comment: `Lifecycle move from ${q.status} to ${nextStage}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lifecycle transition rejected.');
      setFeedback({
        type: 'success',
        message: `Question ${q.questionUid} moved to ${json.question.status}.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to change question status.',
      });
    }
  };

  const handleSaveQuestionEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingQuestionId) return;
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/questions/${editingQuestionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          prompt: editPrompt,
          explanation: editExplanation,
          source: editSource,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Question update failed.');
      setFeedback({
        type: 'success',
        message: `Updated question ${json.question.questionUid} (v${json.question.version}).`,
      });
      setEditingQuestionId(null);
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Question update failed.',
      });
    }
  };

  const handleSaveExam = async (e: FormEvent) => {
    e.preventDefault();
    setExamSaving(true);
    setFeedback(null);
    try {
      const endpoint = editingExamId ? `/api/admin/exams/${editingExamId}` : '/api/admin/exams';
      const method = editingExamId ? 'PATCH' : 'POST';
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify({
          title: examTitle,
          category: examCategory,
          examinationSlug: examSlug,
          academicLevel: examLevel,
          subjectScope: examSubjectScope,
          totalMarks: Number(examTotalMarks || 100),
          durationMinutes: Number(examDuration || 60),
          negativeEnabled: examNegative,
          deductionPerWrong: Number(examDeduction || 0.25),
          randomizeQuestions: examRandomQ,
          randomizeOptions: examRandomOpt,
          attemptLimit: Number(examAttemptLimit || 5),
          status: examStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save examination.');
      setFeedback({
        type: 'success',
        message: `${editingExamId ? 'Updated' : 'Created'} exam "${json.exam.title}".`,
      });
      setEditingExamId(null);
      setExamTitle('');
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save exam.',
      });
    } finally {
      setExamSaving(false);
    }
  };

  const handleViewResults = async (exam: AdminExamItem) => {
    setSelectedExamForResults(exam);
    setLoadingResults(true);
    try {
      const res = await apiFetch(`/api/admin/exams/${exam.id}/results`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load exam results.');
      setExamResults(json.results ?? []);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to load attempt results.',
      });
    } finally {
      setLoadingResults(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }

  if (mode === 'questions') {
    const filtered = questions.filter((q) => {
      if (qStageFilter === 'all') return true;
      return normalizeLifecycleStage(q.status) === qStageFilter;
    });

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <strong className="font-semibold">AI &amp; Unverified Question Guardrail:</strong> Only{' '}
            <span className="font-mono">Published</span> questions enter live mock exams. AI-generated
            questions are flagged <span className="font-mono">Draft</span> and cannot skip{' '}
            <span className="font-mono">Review → Approved</span> before publishing.
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

        {/* CSV Bulk Import */}
        <form
          onSubmit={(e) => void handleBulkImportCsv(e)}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Bulk CSV Question Importer &amp; Duplicate Detector
                </h3>
                <p className="text-xs text-slate-500">
                  Validates headers, checks existing Question Bank + intra-batch duplicates, and
                  queues unique questions into Draft or Review.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={csvInitialStage}
                onChange={(e) => setCsvInitialStage(e.target.value as 'Draft' | 'Review')}
                aria-label="CSV import initial lifecycle stage"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="Draft">Import as Draft</option>
                <option value="Review">Import to Academic Review</option>
              </select>
              <button
                type="submit"
                disabled={importingCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {importingCsv ? 'Importing...' : 'Run CSV Import'}
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            aria-label="CSV question payload"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
          />

          {csvReport && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-slate-900">
                Import Summary: {csvReport.importedCount} imported ·{' '}
                {csvReport.skippedDuplicateCount} duplicates skipped · {csvReport.errorCount} invalid
                rows
              </div>
              {csvReport.duplicates.map((d, i) => (
                <div key={i} className="text-amber-800">
                  Row {d.rowNumber} skipped ({d.reason}): &ldquo;{d.prompt.slice(0, 70)}&rdquo;
                </div>
              ))}
              {csvReport.errors.map((errItem, i) => (
                <div key={i} className="text-red-700">
                  Row {errItem.rowNumber} error: {errItem.message}
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Inline Edit Modal Card */}
        {editingQuestionId !== null && (
          <form
            onSubmit={(e) => void handleSaveQuestionEdit(e)}
            className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm font-semibold text-slate-900">
                Edit Question #{editingQuestionId}
              </h4>
              <button
                type="button"
                onClick={() => setEditingQuestionId(null)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Question Prompt</label>
              <textarea
                rows={2}
                required
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Explanation</label>
                <input
                  required
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">Source Attribution</label>
                <input
                  required
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Save Question Revision
            </button>
          </form>
        )}

        {/* Question Bank Lifecycle List */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Question Verification &amp; Lifecycle Queue ({filtered.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {['all', ...EDITORIAL_LIFECYCLE_STAGES].map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setQStageFilter(stage)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                    qStageFilter === stage
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {stage === 'all' ? 'All' : stage}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.slice(0, 35).map((q) => {
              const stage = normalizeLifecycleStage(q.status);
              return (
                <div
                  key={q.id}
                  className="rounded-lg border border-slate-200 p-4 space-y-2.5 hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span className="font-semibold text-slate-800">{q.questionUid}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600">
                        {q.examination} / {q.subjectName}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span
                        className={`font-semibold ${
                          stage === 'Published'
                            ? 'text-emerald-700'
                            : stage === 'Correction'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {q.status}
                      </span>
                      {q.aiGenerated && (
                        <span className="font-semibold text-blue-700">[AI-Generated]</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuestionId(q.id);
                        setEditPrompt(q.questionContent.prompt);
                        setEditExplanation(q.explanation);
                        setEditSource(q.source);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Edit
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-900">{q.questionContent.prompt}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                    <span>
                      Source: {q.source} · Marks: +{q.marks} / -{q.negativeMarks} · v{q.version}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleTransitionQuestion(q, 'Review')}
                        className="rounded border border-slate-200 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTransitionQuestion(q, 'Correction')}
                        className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-900"
                      >
                        Correction
                      </button>
                      {canReview && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleTransitionQuestion(q, 'Approved')}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-900"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTransitionQuestion(q, 'Published')}
                            className="rounded bg-emerald-600 px-2 py-0.5 font-semibold text-white hover:bg-emerald-700"
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTransitionQuestion(q, 'Archived')}
                            className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-700"
                          >
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Examination Management
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

      {/* Create / Edit Exam Form */}
      <form
        onSubmit={(e) => void handleSaveExam(e)}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {editingExamId ? `Edit Examination #${editingExamId}` : 'Configure New Mock Examination'}
            </h3>
            <p className="text-xs text-slate-500">
              Set marks, timer duration, negative marking, randomization, and publication status.
            </p>
          </div>
          {editingExamId && (
            <button
              type="button"
              onClick={() => {
                setEditingExamId(null);
                setExamTitle('');
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Reset Form
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600">Exam Title</label>
            <input
              required
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="e.g. SEE 2083 Compulsory Mathematics Model Mock"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Status</label>
            <select
              value={examStatus}
              onChange={(e) => setExamStatus(e.target.value as 'draft' | 'published' | 'archived')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              <option value="draft">Draft</option>
              <option value="published">Published (Live)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Category</label>
            <select
              value={examCategory}
              onChange={(e) => setExamCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              <option value="school">School / SEE / +2</option>
              <option value="entrance">Bachelor Entrance</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Track Slug</label>
            <input
              value={examSlug}
              onChange={(e) => setExamSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Total Marks</label>
            <input
              type="number"
              min={1}
              value={examTotalMarks}
              onChange={(e) => setExamTotalMarks(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Duration (Min)</label>
            <input
              type="number"
              min={5}
              value={examDuration}
              onChange={(e) => setExamDuration(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Attempt Limit</label>
            <input
              type="number"
              min={1}
              value={examAttemptLimit}
              onChange={(e) => setExamAttemptLimit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={examNegative}
              onChange={(e) => setExamNegative(e.target.checked)}
            />
            Negative Marking ({examNegative ? `-${examDeduction}` : 'Off'})
          </label>
          {examNegative && (
            <input
              type="number"
              step="0.05"
              min="0"
              value={examDeduction}
              onChange={(e) => setExamDeduction(e.target.value)}
              aria-label="Negative mark deduction"
              className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
            />
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={examRandomQ}
              onChange={(e) => setExamRandomQ(e.target.checked)}
            />
            Randomize Questions
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={examRandomOpt}
              onChange={(e) => setExamRandomOpt(e.target.checked)}
            />
            Randomize Options
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={examSaving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {examSaving ? 'Saving...' : editingExamId ? 'Save Exam Configuration' : 'Create Examination'}
          </button>
        </div>
      </form>

      {/* Exams List */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Configured Mock Examinations ({examsList.length})
          </h3>
          <ClipboardCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Exam</th>
                <th className="py-2 px-3 font-medium">Rules</th>
                <th className="py-2 px-3 font-medium text-right">Attempts</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {examsList.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50/70">
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-slate-900">{ex.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {ex.academicLevel} · {ex.subjectScope}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                    {ex.durationMinutes}m · {ex.totalMarks} marks · {ex.questionCount} Qs ·{' '}
                    {ex.negativeMarkingRule.enabled
                      ? `-${ex.negativeMarkingRule.deductionPerWrong}`
                      : 'No neg'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                    {ex.attemptCount}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] capitalize">{ex.status}</td>
                  <td className="py-3 pl-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExamId(ex.id);
                        setExamTitle(ex.title);
                        setExamCategory(ex.category);
                        setExamSlug(ex.examinationSlug);
                        setExamLevel(ex.academicLevel);
                        setExamSubjectScope(ex.subjectScope);
                        setExamTotalMarks(String(ex.totalMarks));
                        setExamDuration(String(ex.durationMinutes));
                        setExamNegative(ex.negativeMarkingRule.enabled);
                        setExamDeduction(String(ex.negativeMarkingRule.deductionPerWrong));
                        setExamRandomQ(ex.randomizeQuestions);
                        setExamRandomOpt(ex.randomizeOptions);
                        setExamAttemptLimit(String(ex.attemptLimit));
                        setExamStatus(
                          ex.status === 'published' || ex.status === 'archived'
                            ? ex.status
                            : 'draft',
                        );
                      }}
                      className="text-blue-700 font-medium hover:underline"
                    >
                      Configure
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleViewResults(ex)}
                      className="text-slate-700 font-medium hover:underline"
                    >
                      Results
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Drawer */}
      {selectedExamForResults && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-display text-sm font-semibold text-slate-900">
              Submitted Results — {selectedExamForResults.title}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedExamForResults(null)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </div>
          {loadingResults ? (
            <div className="h-24 animate-pulse rounded bg-slate-100" />
          ) : examResults.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              No submitted student attempts recorded for this examination yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Student</th>
                    <th className="py-2 px-3 font-medium text-right">Score</th>
                    <th className="py-2 px-3 font-medium text-right">Accuracy</th>
                    <th className="py-2 px-3 font-medium text-right">Time</th>
                    <th className="py-2 pl-3 text-right font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examResults.map((r) => (
                    <tr key={r.attemptUid}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">{r.studentName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{r.userEmail}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {r.obtainedMarks} / {r.totalMarks}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {r.accuracyPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {Math.round(r.timeTakenSeconds / 60)}m
                      </td>
                      <td className="py-2.5 pl-3 text-right text-slate-500">
                        {new Date(r.submittedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
