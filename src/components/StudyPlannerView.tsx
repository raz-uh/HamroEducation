import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { PlannerBundleResponse } from '../types/api.ts';

interface StudyPlannerViewProps {
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

const TRACK_OPTIONS = [
  'SEE Class 10',
  'NEB Class 11 Science',
  'NEB Class 12 Science',
  'NEB Class 12 Management',
  'IOE Engineering Entrance',
  'MECEE-BL Medical Entrance',
  'BSc CSIT Entrance',
  'CMAT Management Entrance',
];

const SUBJECT_CHOICES = [
  'Compulsory Mathematics',
  'Science & Technology',
  'Optional Mathematics',
  'Computer Science',
  'Physics',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Accountancy',
  'Economics',
  'English',
  'Nepali',
];

export function StudyPlannerView({ onNavigate, onOpenAuth }: StudyPlannerViewProps) {
  const { user, apiFetch } = useAuth();
  const [bundle, setBundle] = useState<PlannerBundleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Goal & countdown form state
  const [targetTrack, setTargetTrack] = useState('SEE Class 10');
  const [targetExamName, setTargetExamName] = useState('');
  const [targetExamSlug, setTargetExamSlug] = useState('see-compulsory-mock-1');
  const [targetExamDate, setTargetExamDate] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(90);
  const [dailyQuestions, setDailyQuestions] = useState(15);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [careerText, setCareerText] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // New plan form
  const [planTitle, setPlanTitle] = useState('');
  const [planSubject, setPlanSubject] = useState('Compulsory Mathematics');
  const [planGrade, setPlanGrade] = useState('G10');
  const [planStart, setPlanStart] = useState('');
  const [planEnd, setPlanEnd] = useState('');
  const [creatingPlan, setCreatingPlan] = useState(false);

  // New task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<'chapter_study' | 'revision' | 'practice' | 'mock_test'>('chapter_study');
  const [taskSubject, setTaskSubject] = useState('Compulsory Mathematics');
  const [taskChapter, setTaskChapter] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [taskMinutes, setTaskMinutes] = useState(40);
  const [creatingTask, setCreatingTask] = useState(false);

  // AI Study Plan Generator state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiDailyHours, setAiDailyHours] = useState(2.5);
  const [aiGeneratingPlan, setAiGeneratingPlan] = useState(false);

  const loadPlanner = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/planner');
      const json = (await res.json()) as PlannerBundleResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load study planner.');
      setBundle(json);

      setTargetTrack(json.goal.targetTrack);
      setTargetExamName(json.goal.targetExamName ?? '');
      setTargetExamSlug(json.goal.targetExamSlug ?? 'see-compulsory-mock-1');
      setTargetExamDate(
        json.goal.targetExamDate ? json.goal.targetExamDate.slice(0, 10) : '',
      );
      setDailyMinutes(json.goal.dailyStudyMinutes);
      setDailyQuestions(json.goal.dailyQuestionTarget);
      setSelectedSubjects(json.goal.selectedSubjects ?? []);
      setCareerText((json.goal.careerInterests ?? []).join(', '));

      if (!planStart) setPlanStart(json.todayDate);
      if (!planEnd) {
        const dt = new Date(`${json.todayDate}T00:00:00Z`);
        dt.setUTCDate(dt.getUTCDate() + 14);
        setPlanEnd(dt.toISOString().slice(0, 10));
      }
      if (!taskDate) setTaskDate(json.todayDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load planner.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, planEnd, planStart, taskDate, user]);

  useEffect(() => {
    void loadPlanner();
  }, [loadPlanner]);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoal(true);
    setNotice(null);
    setError(null);
    try {
      const careerInterests = careerText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiFetch('/api/dashboard/goals', {
        method: 'PATCH',
        body: JSON.stringify({
          targetTrack,
          targetExamName: targetExamName || targetTrack,
          targetExamSlug: targetExamSlug || null,
          targetExamDate: targetExamDate || null,
          dailyStudyMinutes: Number(dailyMinutes),
          dailyQuestionTarget: Number(dailyQuestions),
          selectedSubjects,
          careerInterests,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not save study goals.');
      setNotice('Academic goals, subjects, and exam countdown saved.');
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goals.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingPlan(true);
    setError(null);
    try {
      const res = await apiFetch('/api/planner/plans', {
        method: 'POST',
        body: JSON.stringify({
          title: planTitle,
          goalFocus: targetTrack,
          subjectName: planSubject,
          gradeCode: planGrade,
          startDate: planStart,
          endDate: planEnd,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to create study plan.');
      setPlanTitle('');
      setNotice('Study plan schedule created.');
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create study plan.');
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTask(true);
    setError(null);
    try {
      const res = await apiFetch('/api/planner/tasks', {
        method: 'POST',
        body: JSON.stringify({
          planId: bundle?.plans[0]?.id ?? null,
          title: taskTitle,
          taskType,
          subjectName: taskSubject,
          chapterName: taskChapter || null,
          scheduledDate: taskDate,
          estimatedMinutes: Number(taskMinutes),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to add study task.');
      setTaskTitle('');
      setTaskChapter('');
      setNotice('Daily study task scheduled.');
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add task.');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleToggleTask = async (taskId: number, nextCompleted: boolean) => {
    try {
      const res = await apiFetch(`/api/planner/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: nextCompleted }),
      });
      const json = (await res.json()) as {
        newlyUnlockedBadges?: Array<{ title: string }>;
      };
      if (res.ok) {
        if (json.newlyUnlockedBadges && json.newlyUnlockedBadges.length > 0) {
          setNotice(
            `Badge unlocked: ${json.newlyUnlockedBadges.map((b) => b.title).join(', ')}`,
          );
        }
        await loadPlanner();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const res = await apiFetch(`/api/planner/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadPlanner();
    }
  };

  const handleAutoGenerateAiPlan = async () => {
    setAiGeneratingPlan(true);
    setError(null);
    setNotice(null);
    try {
      const subjectsToUse =
        selectedSubjects.length > 0
          ? selectedSubjects
          : ['Compulsory Mathematics', 'Science & Technology', 'English'];
      const res = await apiFetch('/api/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify({
          examDate: targetExamDate || undefined,
          subjects: subjectsToUse,
          dailyHours: Number(aiDailyHours) || 2,
          targetGoal: targetExamName || targetTrack,
          gradeCode: targetTrack.includes('12') ? 'G12' : targetTrack.includes('11') ? 'G11' : 'G10',
        }),
      });
      const json = (await res.json()) as {
        plan?: { title: string };
        tasks?: Array<{ id: number }>;
        weakTopicsTargeted?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Could not auto-generate AI study plan.');
      setNotice(
        `AI generated "${json.plan?.title ?? 'Study Plan'}" with ${json.tasks?.length ?? 0} daily tasks (${json.weakTopicsTargeted ?? 0} weak topic(s) prioritized).`,
      );
      setAiPanelOpen(false);
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Study Plan Generator failed.');
    } finally {
      setAiGeneratingPlan(false);
    }
  };

  if (!user) {
    return (
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-red-700">Section 9.7 · Goal-Driven Scheduling</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Personalized Study Planner
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure academic goals, target exam countdowns, subject priorities, and daily
            chapter/revision checklists.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-slate-900">
            Sign in to save your study schedule
          </h2>
          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign In to Open Study Planner
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="planner-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Student Dashboard
          </button>
          <p className="text-xs font-medium text-red-700">Section 9.7 · Academic Goals &amp; Tasks</p>
          <h1
            id="planner-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Personalized Study Planner
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Set your target examination countdown, prioritize subjects, build multi-week plans, and
            check off daily study and revision tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAiPanelOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {aiPanelOpen ? 'Close AI Generator' : 'Auto-Generate with AI'}
        </button>
      </div>

      {aiPanelOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-red-700" aria-hidden="true" />
                Section 10.3 · AI Personalized 7-Day Study Plan Generator
              </h2>
              <p className="text-xs text-slate-600">
                Uses your target exam date ({targetExamDate || 'next 3 weeks'}), selected subjects,
                and Weak Topic Detection accuracy (&lt;60%) to schedule daily tasks into your
                account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Daily Available Study Hours</span>
              <input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={aiDailyHours}
                onChange={(e) => setAiDailyHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900"
              />
            </label>

            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800 block">Target Subjects</span>
              <span className="truncate block">
                {selectedSubjects.length > 0
                  ? selectedSubjects.join(', ')
                  : 'Default: Compulsory Math, Science & English'}
              </span>
            </div>

            <button
              type="button"
              disabled={aiGeneratingPlan}
              onClick={() => void handleAutoGenerateAiPlan()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {aiGeneratingPlan ? 'Generating Plan via Gemini...' : 'Generate & Save 7-Day Schedule'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Academic Goal & Exam Countdown */}
          <form
            onSubmit={(e) => void handleSaveGoal(e)}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4 self-start"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Target className="h-4 w-4 text-red-700" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Academic Goal &amp; Exam Countdown
              </h2>
            </div>

            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Primary Learning Track</span>
              <select
                value={targetTrack}
                onChange={(e) => setTargetTrack(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                {TRACK_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-medium text-slate-700">
                <span>Target Examination</span>
                <input
                  type="text"
                  value={targetExamName}
                  onChange={(e) => setTargetExamName(e.target.value)}
                  placeholder="e.g., IOE Entrance 2083"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                />
              </label>

              <label className="block space-y-1 text-xs font-medium text-slate-700">
                <span>Target Exam Date</span>
                <input
                  type="date"
                  value={targetExamDate}
                  onChange={(e) => setTargetExamDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs font-medium text-slate-700">
                <span>Daily Study Goal (mins)</span>
                <input
                  type="number"
                  min={15}
                  max={600}
                  value={dailyMinutes}
                  onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900"
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-slate-700">
                <span>Daily Questions Target</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={dailyQuestions}
                  onChange={(e) => setDailyQuestions(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Selected Subjects</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SUBJECT_CHOICES.map((sub) => {
                  const checked = selectedSubjects.includes(sub);
                  return (
                    <label
                      key={sub}
                      className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedSubjects((prev) =>
                            checked ? prev.filter((s) => s !== sub) : [...prev, sub],
                          )
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      <span className="truncate">{sub}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Career Interests (comma-separated)</span>
              <input
                type="text"
                value={careerText}
                onChange={(e) => setCareerText(e.target.value)}
                placeholder="Software Engineering, Robotics, Public Health"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </label>

            <button
              type="submit"
              disabled={savingGoal}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {savingGoal ? 'Saving Goals...' : 'Save Academic Goal & Countdown'}
            </button>
          </form>

          {/* Right: Daily Study Tasks + Study Plans */}
          <div className="lg:col-span-7 space-y-6">
            {/* Schedule Task Form + Task Checklist */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Daily Study &amp; Revision Tasks
                </h2>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {bundle?.tasks.filter((t) => t.isCompleted).length ?? 0} /{' '}
                  {bundle?.tasks.length ?? 0} completed
                </span>
              </div>

              <form
                onSubmit={(e) => void handleCreateTask(e)}
                className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-6"
              >
                <div className="sm:col-span-3">
                  <label className="block space-y-1 text-[11px] font-medium text-slate-700">
                    <span>Task Title</span>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g., Revise Sets & Venn Diagrams"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </label>
                </div>
                <div className="sm:col-span-3">
                  <label className="block space-y-1 text-[11px] font-medium text-slate-700">
                    <span>Subject</span>
                    <select
                      value={taskSubject}
                      onChange={(e) => setTaskSubject(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      {SUBJECT_CHOICES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block space-y-1 text-[11px] font-medium text-slate-700">
                    <span>Type</span>
                    <select
                      value={taskType}
                      onChange={(e) =>
                        setTaskType(
                          e.target.value as
                            | 'chapter_study'
                            | 'revision'
                            | 'practice'
                            | 'mock_test',
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="chapter_study">Chapter Study</option>
                      <option value="revision">Revision Sheet</option>
                      <option value="practice">Practice Questions</option>
                      <option value="mock_test">Timed Mock Test</option>
                    </select>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block space-y-1 text-[11px] font-medium text-slate-700">
                    <span>Scheduled Date</span>
                    <input
                      type="date"
                      required
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </label>
                </div>
                <div className="sm:col-span-1">
                  <label className="block space-y-1 text-[11px] font-medium text-slate-700">
                    <span>Mins</span>
                    <input
                      type="number"
                      min={10}
                      max={240}
                      value={taskMinutes}
                      onChange={(e) => setTaskMinutes(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                    />
                  </label>
                </div>
                <div className="sm:col-span-1 flex items-end">
                  <button
                    type="submit"
                    disabled={creatingTask}
                    className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add
                  </button>
                </div>
              </form>

              {(bundle?.tasks.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  No scheduled tasks yet. Add your first chapter study or revision task above.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {bundle?.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          aria-label={`Mark "${task.title}" as ${task.isCompleted ? 'incomplete' : 'completed'}`}
                          onClick={() => void handleToggleTask(task.id, !task.isCompleted)}
                          className="mt-0.5 text-slate-500 hover:text-emerald-700 shrink-0"
                        >
                          {task.isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                          ) : (
                            <Circle className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {task.subjectName} · {task.taskType.replace('_', ' ')} ·{' '}
                            <span className="font-mono tabular-nums">{task.scheduledDate}</span> ·{' '}
                            <span className="font-mono tabular-nums">
                              {task.estimatedMinutes}m
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label={`Delete task "${task.title}"`}
                        onClick={() => void handleDeleteTask(task.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Multi-Week Study Plans */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-900">
                Chapter Study Plans ({bundle?.plans.length ?? 0})
              </h2>

              <form
                onSubmit={(e) => void handleCreatePlan(e)}
                className="grid grid-cols-1 gap-3 sm:grid-cols-5"
              >
                <input
                  type="text"
                  required
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Plan title (e.g., SEE Algebra Sprint)"
                  className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                />
                <select
                  value={planSubject}
                  onChange={(e) => setPlanSubject(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                >
                  {SUBJECT_CHOICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={planGrade}
                  onChange={(e) => setPlanGrade(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="G10">Class 10 / SEE</option>
                  <option value="G11">Class 11</option>
                  <option value="G12">Class 12</option>
                  <option value="ENT">Bachelor Entrance</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingPlan}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {creatingPlan ? 'Creating...' : 'Create Plan'}
                </button>
              </form>

              {(bundle?.plans.length ?? 0) > 0 && (
                <ul className="divide-y divide-slate-100">
                  {bundle?.plans.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900">{p.title}</p>
                        <p className="text-slate-500">
                          {p.subjectName} · {p.gradeCode} · {p.startDate} to {p.endDate}
                        </p>
                      </div>
                      <span className="font-mono font-semibold uppercase text-emerald-700">
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
