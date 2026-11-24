import { useEffect, useState, type FormEvent } from 'react';
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Globe,
  HelpCircle,
  Languages,
  ListChecks,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { AiStudyAction, AiStudyAssistantResponse } from '../types/api.ts';

export interface AiStudyContextPayload {
  mode: 'chapter' | 'exam_result' | 'mistake';
  gradeLevel?: string;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  chapterSummary?: string;
  questionPrompt?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  officialExplanation?: string;
}

interface AiStudyAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  context: AiStudyContextPayload;
  defaultLanguage?: 'en' | 'ne';
  initialAction?: AiStudyAction | null;
  initialPrompt?: string;
}

export function AiStudyAssistantDrawer({
  open,
  onClose,
  context,
  defaultLanguage = 'en',
  initialAction = null,
  initialPrompt = '',
}: AiStudyAssistantDrawerProps) {
  const { apiFetch } = useAuth();
  const [language, setLanguage] = useState<'en' | 'ne'>(defaultLanguage);
  const [customPrompt, setCustomPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiStudyAssistantResponse | null>(null);
  const [lastActionLabel, setLastActionLabel] = useState<string | null>(null);
  const [practicePicks, setPracticePicks] = useState<Record<number, string>>({});

  useEffect(() => {
    setLanguage(defaultLanguage);
  }, [defaultLanguage]);

  const runAction = async (
    action: AiStudyAction,
    promptText: string,
    label: string,
    overrideLang?: 'en' | 'ne',
  ) => {
    setLoading(true);
    setError(null);
    setLastActionLabel(label);
    setPracticePicks({});
    try {
      const res = await apiFetch('/api/ai/study-assistant', {
        method: 'POST',
        body: JSON.stringify({
          action,
          prompt: promptText,
          language: overrideLang ?? language,
          context,
        }),
      });
      const json = (await res.json()) as AiStudyAssistantResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'AI Study Assistant could not complete this request.');
      }
      setResult(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach AI Study Assistant right now.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !initialAction) return;
    const defaultPromptByAction: Record<AiStudyAction, string> = {
      explain_simple: `Explain ${context.chapterName || context.topicName || 'this topic'} in simple language.`,
      solve_numerical: `Solve the numerical step-by-step for ${context.questionPrompt || context.chapterName || 'this topic'}.`,
      summarize_chapter: `Summarize ${context.chapterName || 'this chapter'} for quick revision.`,
      generate_practice_5: `Generate 5 practice questions on ${context.topicName || context.chapterName || 'this topic'}.`,
      explain_incorrect: `Explain why my answer "${context.studentAnswer || 'submitted'}" is incorrect for: ${context.questionPrompt || context.topicName || 'this question'}.`,
      custom_chat: initialPrompt || 'Help me understand this concept clearly.',
    };
    const labelMap: Record<AiStudyAction, string> = {
      explain_simple: 'Explain in Simple Language',
      solve_numerical: 'Solve Numerical Step-by-Step',
      summarize_chapter: 'Summarize Chapter',
      generate_practice_5: '5 Practice Questions',
      explain_incorrect: 'Why Answer Is Incorrect',
      custom_chat: 'Custom Study Question',
    };
    void runAction(
      initialAction,
      initialPrompt.trim() || defaultPromptByAction[initialAction],
      labelMap[initialAction],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAction, context.questionPrompt, context.chapterName]);

  if (!open) return null;

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    void runAction('custom_chat', customPrompt.trim(), 'Study Chat');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-study-assistant-title"
    >
      <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-red-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Section 10.1 · Context-Aware AI Study Assistant
            </p>
            <h2
              id="ai-study-assistant-title"
              className="mt-0.5 font-display text-lg font-bold text-slate-900 truncate"
            >
              {context.subjectName || 'Study Helper'}
              {context.chapterName ? ` — ${context.chapterName}` : ''}
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {context.mode === 'chapter'
                ? 'Chapter Reader Mode'
                : context.mode === 'exam_result'
                  ? 'Exam Result Review Mode'
                  : 'Mistake Book Recovery Mode'}
              {context.topicName ? ` · ${context.topicName}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="AI explanation language"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            >
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="h-3 w-3" aria-hidden="true" />
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ne')}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  language === 'ne' ? 'bg-red-700 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Languages className="h-3 w-3" aria-hidden="true" />
                नेपाली
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Study Assistant"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* One-Click Actions */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            One-Click Study Actions ({language === 'ne' ? 'Nepali Output' : 'English Output'})
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void runAction(
                  'explain_simple',
                  `Explain "${context.questionPrompt || context.chapterName || context.topicName || 'this concept'}" in simple language.`,
                  'Explain in Simple Language',
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-slate-400 disabled:opacity-50"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              Explain Simple
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void runAction(
                  'solve_numerical',
                  `Solve a step-by-step numerical problem for ${context.questionPrompt || context.chapterName || context.topicName || 'this chapter'}.`,
                  'Solve Numerical Step-by-Step',
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-slate-400 disabled:opacity-50"
            >
              <Calculator className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              Solve Numerical
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void runAction(
                  'summarize_chapter',
                  `Summarize "${context.chapterName || context.subjectName || 'this topic'}" concisely with formulas and board exam tips.`,
                  'Summarize Chapter',
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-slate-400 disabled:opacity-50"
            >
              <ListChecks className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
              Summarize Chapter
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void runAction(
                  'generate_practice_5',
                  `Generate 5 practice MCQs for ${context.chapterName || context.topicName || context.subjectName || 'this chapter'}.`,
                  'Generate 5 Practice Questions',
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-slate-400 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
              5 Practice Questions
            </button>

            {context.questionPrompt && (
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  void runAction(
                    'explain_incorrect',
                    `Explain why my answer "${context.studentAnswer || 'unattempted'}" is incorrect and how to arrive at "${context.correctAnswer || 'the correct answer'}".`,
                    'Explain Why Incorrect',
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Why Answer Is Incorrect
              </button>
            )}
          </div>
        </div>

        {/* Context Preview + Output Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {context.questionPrompt && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-800">Active Question Context</p>
              <p className="text-slate-700 leading-relaxed">{context.questionPrompt}</p>
              {context.studentAnswer && (
                <p className="text-red-700 font-mono">
                  Your answer: {context.studentAnswer}
                  {context.correctAnswer ? ` · Correct: ${context.correctAnswer}` : ''}
                </p>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 leading-relaxed"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-mono text-xs font-semibold text-slate-600">
                Thinking in {language === 'ne' ? 'Nepali' : 'English'} · {lastActionLabel}...
              </p>
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
            </div>
          )}

          {!loading && !result && !error && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center space-y-2">
              <Sparkles className="mx-auto h-6 w-6 text-red-700" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900">
                Ask any doubt or trigger a one-click action above
              </p>
              <p className="text-xs text-slate-600">
                Switch between English and नेपाली anytime. All Gemini AI calls run strictly on the
                Hamro Education server with rate limiting.
              </p>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-[11px] font-mono text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {lastActionLabel || 'AI Study Response'}
                  </span>
                  <span>
                    {result.language.toUpperCase()} · Rate quota left: {result.rateLimitRemaining}
                  </span>
                </div>

                <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
                  {result.answer}
                </div>

                {result.keyTakeaways.length > 0 && (
                  <div className="rounded-lg bg-slate-50 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-900">Key Takeaways</p>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                      {result.keyTakeaways.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.practiceQuestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Generated 5-Question Quick Drill
                  </h3>
                  {result.practiceQuestions.map((pq, idx) => {
                    const picked = practicePicks[idx];
                    const isCorrect = picked === pq.correctKey;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5"
                      >
                        <p className="text-xs font-semibold text-slate-900">
                          <span className="font-mono text-red-700 mr-1.5">Q{idx + 1}.</span>
                          {pq.prompt}
                        </p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {pq.options.map((opt) => {
                            const selected = picked === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() =>
                                  setPracticePicks((prev) => ({ ...prev, [idx]: opt.key }))
                                }
                                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                                  selected
                                    ? opt.key === pq.correctKey
                                      ? 'border-emerald-700 bg-emerald-50 font-semibold text-emerald-900'
                                      : 'border-red-700 bg-red-50 font-semibold text-red-900'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-white'
                                }`}
                              >
                                <span className="font-mono mr-1.5">{opt.key}.</span>
                                {opt.text}
                              </button>
                            );
                          })}
                        </div>
                        {picked && (
                          <div
                            className={`rounded-lg p-2.5 text-xs ${
                              isCorrect
                                ? 'bg-emerald-50 text-emerald-900'
                                : 'bg-amber-50 text-amber-900'
                            }`}
                          >
                            <p className="font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {isCorrect ? 'Correct!' : `Answer: ${pq.correctKey}`}
                            </p>
                            <p className="mt-1">{pq.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Prompt Footer */}
        <form
          onSubmit={handleChatSubmit}
          className="border-t border-slate-200 bg-slate-50 px-5 py-3.5"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={
                language === 'ne'
                  ? 'नेपाली वा अंग्रेजीमा प्रश्न सोध्नुहोस्...'
                  : 'Ask a follow-up question about this chapter or problem...'
              }
              aria-label="Ask AI Study Assistant"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || customPrompt.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Ask
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
