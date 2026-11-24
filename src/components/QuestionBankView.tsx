import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { QUESTION_TYPE_CATALOG, QUESTION_WORKFLOW_STAGES } from '../lib/exam-engine.ts';
import type {
  AiQuestionGeneratorResponse,
  QuestionBankItem,
  QuestionBankResponse,
  QuestionType,
  QuestionWorkflowStatus,
} from '../types/api.ts';

interface QuestionBankViewProps {
  onOpenAuth: () => void;
}

const EXAM_FILTER_OPTIONS = [
  'all',
  'SEE',
  'Class 12 Science',
  'Class 12 Management',
  'BSc CSIT',
  'CMAT',
  'IOE',
  'MECEE-BL',
];

export function QuestionBankView({ onOpenAuth }: QuestionBankViewProps) {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<QuestionBankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [examination, setExamination] = useState('all');
  const [questionType, setQuestionType] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});

  // Manager create-question form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newExam, setNewExam] = useState('IOE');
  const [newSubject, setNewSubject] = useState('Physics');
  const [newChapter, setNewChapter] = useState('Rotational Dynamics');
  const [newTopic, setNewTopic] = useState('Torque and Angular Momentum');
  const [newType, setNewType] = useState<QuestionType>('single_mcq');
  const [newDifficulty, setNewDifficulty] = useState('medium');
  const [newPrompt, setNewPrompt] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOptKey, setCorrectOptKey] = useState('A');
  const [newNumericVal, setNewNumericVal] = useState('0');
  const [newAcceptedText, setNewAcceptedText] = useState('');
  const [newExplanation, setNewExplanation] = useState('');
  const [newMarks, setNewMarks] = useState('1');
  const [newNegMarks, setNewNegMarks] = useState('0.1');
  const [submitting, setSubmitting] = useState(false);

  // AI Question Generator state (Draft-only guardrail)
  const [showAiGenForm, setShowAiGenForm] = useState(false);
  const [aiExam, setAiExam] = useState('SEE');
  const [aiSubject, setAiSubject] = useState('Compulsory Mathematics');
  const [aiChapter, setAiChapter] = useState('Compound Interest & Depreciation');
  const [aiTopic, setAiTopic] = useState('Population Growth & Depreciation');
  const [aiType, setAiType] = useState<'single_mcq' | 'numerical'>('single_mcq');
  const [aiDiff, setAiDiff] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiCount, setAiCount] = useState(3);
  const [aiLang, setAiLang] = useState<'en' | 'ne'>('en');
  const [aiGenerating, setAiGenerating] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (examination !== 'all') params.set('examination', examination);
      if (questionType !== 'all') params.set('questionType', questionType);
      if (difficulty !== 'all') params.set('difficulty', difficulty);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiFetch(`/api/question-bank?${params.toString()}`);
      const json = (await res.json()) as QuestionBankResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load question bank.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load question bank.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, difficulty, examination, questionType, search, statusFilter]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const canManage = Boolean(data?.canManage);
  const canReviewOrPublish = Boolean(
    user?.permissions.includes('curriculum:review') || user?.permissions.includes('system:admin'),
  );
  const canCreate = Boolean(user?.permissions.includes('questions:manage'));
  const canUseAiGenerator = Boolean(
    user?.permissions.includes('questions:manage') ||
      user?.permissions.includes('curriculum:write') ||
      user?.permissions.includes('curriculum:review') ||
      user?.permissions.includes('system:admin'),
  );

  const handleAiGenerateQuestions = async (e: FormEvent) => {
    e.preventDefault();
    setAiGenerating(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await apiFetch('/api/ai/generate-questions', {
        method: 'POST',
        body: JSON.stringify({
          gradeOrExam: aiExam,
          subjectName: aiSubject,
          chapterName: aiChapter,
          topicName: aiTopic,
          questionType: aiType,
          difficulty: aiDiff,
          count: Number(aiCount),
          language: aiLang,
          saveToBank: true,
        }),
      });
      const json = (await res.json()) as AiQuestionGeneratorResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'AI Question Generator failed.');
      setActionMsg(
        `Generated ${json.savedQuestions.length} draft question(s). ${json.notice}`,
      );
      setStatusFilter('Draft');
      setShowAiGenForm(false);
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate questions.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleTransitionStatus = async (
    q: QuestionBankItem,
    nextStatus: QuestionWorkflowStatus,
  ) => {
    setActionMsg(null);
    setError(null);
    try {
      const res = await apiFetch(`/api/question-bank/${q.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextStatus }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to update status.');
      setActionMsg(`Question ${q.questionUid} moved to ${nextStatus}.`);
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow transition failed.');
    }
  };

  const handleCreateQuestion = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setActionMsg(null);
    try {
      const isMcq = ['single_mcq', 'multiple_mcq', 'diagram_based', 'case_based', 'assertion_reason'].includes(newType);
      const options = isMcq
        ? [
            { optionKey: 'A', optionText: optA.trim() || 'Option A', isCorrect: correctOptKey === 'A' },
            { optionKey: 'B', optionText: optB.trim() || 'Option B', isCorrect: correctOptKey === 'B' },
            { optionKey: 'C', optionText: optC.trim() || 'Option C', isCorrect: correctOptKey === 'C' },
            { optionKey: 'D', optionText: optD.trim() || 'Option D', isCorrect: correctOptKey === 'D' },
          ]
        : [];

      const correctAnswer =
        newType === 'true_false'
          ? { booleanValue: correctOptKey === 'TRUE' }
          : newType === 'numerical'
            ? { numericValue: Number(newNumericVal) || 0, tolerance: 0.05 }
            : newType === 'short_answer' || newType === 'long_answer'
              ? { acceptedText: newAcceptedText.trim(), keywords: newAcceptedText.split(',').map((s) => s.trim()).filter(Boolean) }
              : { optionKeys: [correctOptKey] };

      const res = await apiFetch('/api/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicLevel: newExam === 'SEE' ? 'Secondary (Class 10 / SEE)' : 'Bachelor Entrance',
          examination: newExam,
          subjectName: newSubject,
          chapterName: newChapter,
          topicName: newTopic,
          questionType: newType,
          difficulty: newDifficulty,
          questionContent: { prompt: newPrompt.trim() },
          options,
          correctAnswer,
          explanation: newExplanation.trim(),
          marks: Number(newMarks) || 1,
          negativeMarks: Number(newNegMarks) || 0,
          source: 'Faculty Original',
          status: 'Draft',
        }),
      });
      const json = (await res.json()) as { question?: { questionUid: string }; error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to create question.');
      setActionMsg(`Created ${json.question?.questionUid ?? 'question'} in Draft stage.`);
      setNewPrompt('');
      setNewExplanation('');
      setShowCreateForm(false);
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create question.');
    } finally {
      setSubmitting(false);
    }
  };

  const questions = data?.questions ?? [];

  return (
    <section aria-labelledby="question-bank-title" className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium text-red-700">
              Section 7 · Editorial Question Bank &amp; Review Workflow
            </p>
            <h1
              id="question-bank-title"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              Structured Multi-Type Question Bank
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              Supports all 10 question types across SEE, Class 12, and Bachelor Entrances. Only{' '}
              <span className="font-mono font-semibold text-emerald-700">Published</span> items
              are visible to students and eligible for live timed mock exams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canUseAiGenerator && (
              <button
                type="button"
                onClick={() => {
                  setShowAiGenForm((v) => !v);
                  setShowCreateForm(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                {showAiGenForm ? 'Close AI Generator' : 'AI Question Generator'}
              </button>
            )}
            {canCreate ? (
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm((v) => !v);
                  setShowAiGenForm(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {showCreateForm ? 'Close Authoring Form' : 'Create Question'}
              </button>
            ) : !user ? (
              <button
                type="button"
                onClick={onOpenAuth}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Sign In for Faculty Authoring
              </button>
            ) : null}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search UID, chapter, prompt..."
              aria-label="Search question bank"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </div>

          <select
            value={examination}
            onChange={(e) => setExamination(e.target.value)}
            aria-label="Filter by examination"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
          >
            {EXAM_FILTER_OPTIONS.map((ex) => (
              <option key={ex} value={ex}>
                {ex === 'all' ? 'All Examinations' : ex}
              </option>
            ))}
          </select>

          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
            aria-label="Filter by question type"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
          >
            <option value="all">All 10 Question Types</option>
            {QUESTION_TYPE_CATALOG.map((qt) => (
              <option key={qt.id} value={qt.id}>
                {qt.label}
              </option>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            aria-label="Filter by difficulty"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {canManage ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by workflow status"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            >
              <option value="all">All Workflow Stages</option>
              {QUESTION_WORKFLOW_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Published Questions Only
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {actionMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* AI Question Generator Drawer (Draft-Only Guardrail) */}
      {showAiGenForm && canUseAiGenerator && (
        <form
          onSubmit={(e) => void handleAiGenerateQuestions(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-red-700" aria-hidden="true" />
                Section 10.2 · AI Question Generator (Draft-Only Guardrail)
              </h2>
              <p className="text-xs text-slate-500">
                All AI-generated items are saved strictly as Draft with &ldquo;AI-Generated — Pending
                Academic Review&rdquo; and never enter live mock exams without human approval.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Class / Exam</span>
              <select
                value={aiExam}
                onChange={(e) => setAiExam(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                {EXAM_FILTER_OPTIONS.filter((o) => o !== 'all').map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Subject</span>
              <input
                value={aiSubject}
                onChange={(e) => setAiSubject(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              />
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Chapter</span>
              <input
                value={aiChapter}
                onChange={(e) => setAiChapter(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              />
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Topic</span>
              <input
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Question Type</span>
              <select
                value={aiType}
                onChange={(e) => setAiType(e.target.value as 'single_mcq' | 'numerical')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <option value="single_mcq">Single-Correct MCQ</option>
                <option value="numerical">Numerical</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Difficulty</span>
              <select
                value={aiDiff}
                onChange={(e) => setAiDiff(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Count (1–5)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Language</span>
              <select
                value={aiLang}
                onChange={(e) => setAiLang(e.target.value as 'en' | 'ne')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <option value="en">English</option>
                <option value="ne">Nepali (नेपाली)</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={aiGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {aiGenerating ? 'Generating Drafts via Gemini...' : 'Generate Draft Questions for Review'}
          </button>
        </form>
      )}

      {/* Faculty Question Authoring Drawer */}
      {showCreateForm && canCreate && (
        <form
          onSubmit={(e) => void handleCreateQuestion(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Author New Question (Starts in Draft Workflow)
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <select
              value={newExam}
              onChange={(e) => setNewExam(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            >
              {EXAM_FILTER_OPTIONS.filter((o) => o !== 'all').map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject"
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={newChapter}
              onChange={(e) => setNewChapter(e.target.value)}
              placeholder="Chapter"
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="Topic"
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as QuestionType)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            >
              {QUESTION_TYPE_CATALOG.map((qt) => (
                <option key={qt.id} value={qt.id}>
                  {qt.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={2}
            required
            placeholder="Enter complete question stem..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          {newType === 'true_false' ? (
            <div className="flex items-center gap-3 text-xs">
              <label className="font-semibold text-slate-700">Correct Boolean:</label>
              <select
                value={correctOptKey}
                onChange={(e) => setCorrectOptKey(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5"
              >
                <option value="TRUE">True</option>
                <option value="FALSE">False</option>
              </select>
            </div>
          ) : newType === 'numerical' ? (
            <div className="flex items-center gap-3 text-xs">
              <label className="font-semibold text-slate-700">Exact Numeric Answer:</label>
              <input
                type="number"
                step="any"
                value={newNumericVal}
                onChange={(e) => setNewNumericVal(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-mono"
              />
            </div>
          ) : newType === 'short_answer' || newType === 'long_answer' ? (
            <input
              value={newAcceptedText}
              onChange={(e) => setNewAcceptedText(e.target.value)}
              placeholder="Comma-separated grading keywords (e.g. momentum, conserved, external torque)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={optA}
                onChange={(e) => setOptA(e.target.value)}
                placeholder="Option A"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={optB}
                onChange={(e) => setOptB(e.target.value)}
                placeholder="Option B"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={optC}
                onChange={(e) => setOptC(e.target.value)}
                placeholder="Option C"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={optD}
                onChange={(e) => setOptD(e.target.value)}
                placeholder="Option D"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              value={newDifficulty}
              onChange={(e) => setNewDifficulty(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <input
              type="number"
              step="0.5"
              value={newMarks}
              onChange={(e) => setNewMarks(e.target.value)}
              placeholder="Marks"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
            />
            <input
              type="number"
              step="0.05"
              value={newNegMarks}
              onChange={(e) => setNewNegMarks(e.target.value)}
              placeholder="Negative Marks"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
            />
            {['single_mcq', 'multiple_mcq', 'diagram_based', 'case_based', 'assertion_reason'].includes(newType) && (
              <select
                value={correctOptKey}
                onChange={(e) => setCorrectOptKey(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="A">Correct: A</option>
                <option value="B">Correct: B</option>
                <option value="C">Correct: C</option>
                <option value="D">Correct: D</option>
              </select>
            )}
          </div>

          <textarea
            value={newExplanation}
            onChange={(e) => setNewExplanation(e.target.value)}
            rows={2}
            required
            placeholder="Step-by-step academic explanation..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Saving Draft...' : 'Save Question to Draft'}
          </button>
        </form>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          Showing{' '}
          <strong className="font-mono text-slate-900 tabular-nums">{questions.length}</strong>{' '}
          verified question items
        </span>
      </div>

      {/* Question Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white p-6"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            No questions match the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const typeMeta = QUESTION_TYPE_CATALOG.find((t) => t.id === q.questionType);
            const revealed = Boolean(revealedIds[q.id]);
            const isPublished = q.status === 'Published';

            return (
              <article
                key={q.id}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600">
                    <span className="font-mono font-semibold text-red-700">{q.questionUid}</span>
                    <span>·</span>
                    <span className="font-semibold text-slate-900">{q.examination}</span>
                    <span>·</span>
                    <span>
                      {q.subjectName} / {q.chapterName} / {q.topicName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                      {typeMeta?.label ?? q.questionType}
                    </span>
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 uppercase">
                      {q.difficulty}
                    </span>
                    <span className="text-slate-600 tabular-nums">
                      +{q.marks} / -{q.negativeMarks}
                    </span>
                    {(q.aiGenerated || q.source.includes('AI-Generated')) && (
                      <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-800">
                        AI-Generated — Pending Academic Review
                      </span>
                    )}
                    <span
                      className={`rounded border px-2 py-0.5 font-semibold ${
                        isPublished
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {q.status} (v{q.version})
                    </span>
                  </div>
                </div>

                {q.questionContent.passage && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                    <strong className="text-slate-900">Case Passage: </strong>
                    {q.questionContent.passage}
                  </div>
                )}

                {q.questionContent.assertion && q.questionContent.reason && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                    <p>
                      <strong className="text-slate-900">Assertion (A): </strong>
                      {q.questionContent.assertion}
                    </p>
                    <p>
                      <strong className="text-slate-900">Reason (R): </strong>
                      {q.questionContent.reason}
                    </p>
                  </div>
                )}

                {q.questionContent.diagramSvg && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-[11px] font-medium text-slate-500">
                      {q.questionContent.diagramLabel || 'Diagram'}
                    </p>
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(q.questionContent.diagramSvg)}`}
                      alt={q.questionContent.diagramLabel || 'Question diagram'}
                      className="max-w-full h-auto"
                    />
                  </div>
                )}

                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                  {q.questionContent.prompt}
                </p>

                {q.answerOptions.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.answerOptions.map((opt) => (
                      <div
                        key={opt.optionKey}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800"
                      >
                        <span className="font-mono font-semibold text-slate-900 mr-2">
                          {opt.optionKey}.
                        </span>
                        {opt.optionText}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                  <div className="text-slate-500">
                    Source: <strong className="text-slate-700">{q.source}</strong> · Reviewer:{' '}
                    <strong className="text-slate-700">{q.reviewer}</strong>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedIds((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {revealed ? (
                        <>
                          Hide Solution
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          Show Solution
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      )}
                    </button>

                    {canManage && q.status !== 'Published' && (
                      <>
                        {q.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => void handleTransitionStatus(q, 'Academic Review')}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                          >
                            Send to Review
                          </button>
                        )}
                        {canReviewOrPublish && (
                          <button
                            type="button"
                            onClick={() => void handleTransitionStatus(q, 'Published')}
                            className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                          >
                            Approve &amp; Publish
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {revealed && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                    <p className="font-semibold text-emerald-800">
                      Correct Answer:{' '}
                      {q.correctAnswer.optionKeys?.join(', ') ??
                        (typeof q.correctAnswer.booleanValue === 'boolean'
                          ? String(q.correctAnswer.booleanValue)
                          : q.correctAnswer.numericValue !== undefined
                            ? `${q.correctAnswer.numericValue} (±${q.correctAnswer.tolerance ?? 0.01})`
                            : q.correctAnswer.acceptedText ??
                              (q.correctAnswer.matchingMap
                                ? Object.entries(q.correctAnswer.matchingMap)
                                    .map(([k, v]) => `${k} → ${v}`)
                                    .join(' | ')
                                : ''))}
                    </p>
                    <p className="text-slate-700 leading-relaxed">{q.explanation}</p>
                    {q.versions.length > 0 && (
                      <p className="pt-1 font-mono text-[11px] text-slate-500">
                        Latest version history: v{q.versions[0].versionNumber} —{' '}
                        {q.versions[0].changeSummary}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
