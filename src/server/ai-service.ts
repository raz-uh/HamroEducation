import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { enforceAiQuestionDraftGuardrail } from '../lib/ai-community.ts';
import type {
  AiCareerAssistantResponse,
  AiCareerCitation,
  AiGeneratedQuestionDraft,
  AiStudyAction,
  AiStudyAssistantResponse,
} from '../types/api.ts';

const PRIMARY_MODEL_ID = 'gemini-4-hydrogen';
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-4-neon'] as const;

let cachedAiClient: GoogleGenAI | null = null;
let cachedKey: string | undefined;

async function generateStructuredContent(
  ai: GoogleGenAI,
  contents: string,
  config: Record<string, unknown>,
) {
  const candidates: Array<{ model: string; useThinking: boolean }> = [
    { model: PRIMARY_MODEL_ID, useThinking: true },
    { model: FALLBACK_MODELS[0], useThinking: false },
    { model: FALLBACK_MODELS[1], useThinking: true },
  ];

  let lastErr: unknown;
  for (const cand of candidates) {
    try {
      const candConfig = cand.useThinking
        ? config
        : (() => {
            const { thinkingConfig: _omit, ...rest } = config;
            return rest;
          })();
      const response = await ai.models.generateContent({
        model: cand.model,
        contents,
        config: candConfig,
      });
      return { response, modelUsed: cand.model };
    } catch (err) {
      lastErr = err;
      const raw = err instanceof Error ? err.message : String(err);
      const isTransientDemand =
        raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand');
      if (!isTransientDemand) {
        throw err;
      }
    }
  }
  throw lastErr;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Settings > Secrets. Add your Gemini API key on the server to use AI features.',
    );
  }
  if (!cachedAiClient || cachedKey !== apiKey) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKey = apiKey;
  }
  return cachedAiClient;
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 503, message: raw };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return {
      status: 502,
      message:
        'Gemini API key was rejected or invalid. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'AI tutor quota temporarily reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return {
      status: 503,
      message:
        'The AI model is temporarily experiencing high upstream demand. Please wait a few seconds and try again.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 502,
      message: 'Configured Gemini model was unavailable upstream.',
    };
  }
  let cleanMessage = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      cleanMessage = parsed.error.message;
    }
  } catch {
    // keep raw if not JSON
  }
  return {
    status: 502,
    message: `AI request could not be completed: ${cleanMessage.slice(0, 180)}`,
  };
}

export async function runAiStudyAssistant(params: {
  action: AiStudyAction;
  prompt: string;
  language: 'en' | 'ne';
  context: {
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
  };
}): Promise<Omit<AiStudyAssistantResponse, 'rateLimitRemaining'>> {
  const ai = getGeminiClient();
  const langLabel =
    params.language === 'ne'
      ? 'Nepali (Devanagari script with clear English technical formulas/terms in parentheses where helpful)'
      : 'English (clear, Nepal CDC/NEB academic style)';

  const actionInstructionMap: Record<AiStudyAction, string> = {
    explain_simple:
      'Explain the core topic in simple, intuitive language with a concrete everyday example for a Nepali student.',
    solve_numerical:
      'Solve the numerical step-by-step: Given values, Formula, Unit conversions (SI), Substitution, and Final Answer with units.',
    summarize_chapter:
      'Provide a concise high-yield revision summary of this chapter covering key laws, formulas, and common board exam pitfalls.',
    generate_practice_5:
      'Generate exactly 5 structured 4-option MCQs (A, B, C, D) directly aligned to the topic/chapter, each with correctKey and brief explanation.',
    explain_incorrect:
      'Diagnose why the student answer is incorrect, pinpoint the exact misconception, and walk through why the correct answer holds.',
    custom_chat:
      'Answer the student question directly, step-by-step, grounded strictly in the provided chapter or exam context.',
  };

  const ctx = params.context;
  const userContent = [
    `Action requested: ${actionInstructionMap[params.action]}`,
    `Output Language: ${langLabel}`,
    `Study Context Mode: ${ctx.mode}`,
    ctx.gradeLevel ? `Level: ${ctx.gradeLevel}` : '',
    ctx.subjectName ? `Subject: ${ctx.subjectName}` : '',
    ctx.chapterName ? `Chapter: ${ctx.chapterName}` : '',
    ctx.topicName ? `Topic: ${ctx.topicName}` : '',
    ctx.chapterSummary ? `Chapter Overview: ${ctx.chapterSummary.slice(0, 1200)}` : '',
    ctx.questionPrompt ? `Question Prompt: ${ctx.questionPrompt}` : '',
    ctx.studentAnswer ? `Student Answer: ${ctx.studentAnswer}` : '',
    ctx.correctAnswer ? `Expected Correct Answer: ${ctx.correctAnswer}` : '',
    ctx.officialExplanation ? `Official Explanation: ${ctx.officialExplanation}` : '',
    `Student Request: ${params.prompt}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const { response, modelUsed } = await generateStructuredContent(ai, userContent, {
      systemInstruction:
        'You are Hamro Education AI Study Assistant for Nepali SEE, Class 11–12 NEB, and bachelor entrance students. Be accurate, step-by-step, encouraging, and concise. Never fabricate official exam schedules or policies.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description: 'Main clear explanation or step-by-step solution in the requested language.',
          },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 to 5 bullet takeaways or formula reminders.',
          },
          practiceQuestions: {
            type: Type.ARRAY,
            description:
              'When generate_practice_5 is requested, return 5 MCQs; otherwise return empty array.',
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      key: { type: Type.STRING },
                      text: { type: Type.STRING },
                    },
                    required: ['key', 'text'],
                  },
                },
                correctKey: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['prompt', 'options', 'correctKey', 'explanation'],
            },
          },
        },
        required: ['answer', 'keyTakeaways', 'practiceQuestions'],
      },
    });

    const rawText = (response.text ?? '').trim();
    const parsed = JSON.parse(rawText) as {
      answer?: string;
      keyTakeaways?: string[];
      practiceQuestions?: Array<{
        prompt: string;
        options: Array<{ key: string; text: string }>;
        correctKey: string;
        explanation: string;
      }>;
    };

    return {
      answer: parsed.answer?.trim() || 'No response generated.',
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways.slice(0, 6) : [],
      practiceQuestions: Array.isArray(parsed.practiceQuestions)
        ? parsed.practiceQuestions.slice(0, 5)
        : [],
      language: params.language,
      model: modelUsed,
    };
  } catch (err) {
    const mapped = mapGeminiError(err);
    const e = new Error(mapped.message) as Error & { statusCode?: number };
    e.statusCode = mapped.status;
    throw e;
  }
}

export async function runAiQuestionGenerator(params: {
  gradeOrExam: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionType: 'single_mcq' | 'numerical';
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  language: 'en' | 'ne';
}): Promise<AiGeneratedQuestionDraft[]> {
  const ai = getGeminiClient();
  const safeCount = Math.max(1, Math.min(5, Math.round(params.count)));

  const prompt = [
    `Generate exactly ${safeCount} original, syllabus-accurate ${params.questionType === 'numerical' ? 'numerical calculation' : 'single-correct 4-option MCQ'} questions for Nepal curriculum.`,
    `Class / Exam: ${params.gradeOrExam}`,
    `Subject: ${params.subjectName}`,
    `Chapter: ${params.chapterName}`,
    `Topic: ${params.topicName}`,
    `Difficulty: ${params.difficulty}`,
    `Language: ${params.language === 'ne' ? 'Nepali (Devanagari script)' : 'English'}`,
    params.questionType === 'single_mcq'
      ? 'Each question must have 4 plausible options keyed A, B, C, D with exactly one correctOptionKey (A/B/C/D) and a step-by-step explanation.'
      : 'Each numerical question must specify an exact numericValue, unitHint, and step-by-step calculation explanation.',
  ].join('\n');

  try {
    const { response } = await generateStructuredContent(ai, prompt, {
      systemInstruction:
        'You are a Nepal CDC/NEB & University Entrance assessment specialist. Produce mathematically verified, unambiguous questions with detailed explanations.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            optionA: { type: Type.STRING },
            optionB: { type: Type.STRING },
            optionC: { type: Type.STRING },
            optionD: { type: Type.STRING },
            correctOptionKey: { type: Type.STRING },
            numericValue: { type: Type.NUMBER },
            unitHint: { type: Type.STRING },
            explanation: { type: Type.STRING },
            marks: { type: Type.NUMBER },
          },
          required: ['prompt', 'explanation', 'marks'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim()) as Array<{
      prompt: string;
      optionA?: string;
      optionB?: string;
      optionC?: string;
      optionD?: string;
      correctOptionKey?: string;
      numericValue?: number;
      unitHint?: string;
      explanation: string;
      marks?: number;
    }>;

    return parsed.slice(0, safeCount).map((item) => {
      const validKey = ['A', 'B', 'C', 'D'].includes((item.correctOptionKey ?? '').toUpperCase())
        ? item.correctOptionKey!.toUpperCase()
        : 'A';

      const baseDraft: AiGeneratedQuestionDraft =
        params.questionType === 'numerical'
          ? {
              prompt: item.prompt,
              questionType: 'numerical',
              options: [],
              numericValue: typeof item.numericValue === 'number' ? item.numericValue : 0,
              unitHint: item.unitHint || 'SI unit',
              explanation: item.explanation,
              marks: typeof item.marks === 'number' && item.marks > 0 ? item.marks : 2,
              status: 'Draft',
              sourceLabel: 'AI-Generated — Pending Academic Review',
            }
          : {
              prompt: item.prompt,
              questionType: 'single_mcq',
              options: [
                { optionKey: 'A', optionText: item.optionA || 'Option A', isCorrect: validKey === 'A' },
                { optionKey: 'B', optionText: item.optionB || 'Option B', isCorrect: validKey === 'B' },
                { optionKey: 'C', optionText: item.optionC || 'Option C', isCorrect: validKey === 'C' },
                { optionKey: 'D', optionText: item.optionD || 'Option D', isCorrect: validKey === 'D' },
              ],
              correctOptionKey: validKey,
              explanation: item.explanation,
              marks: typeof item.marks === 'number' && item.marks > 0 ? item.marks : 1,
              status: 'Draft',
              sourceLabel: 'AI-Generated — Pending Academic Review',
            };

      return enforceAiQuestionDraftGuardrail(baseDraft);
    });
  } catch (err) {
    const mapped = mapGeminiError(err);
    const e = new Error(mapped.message) as Error & { statusCode?: number };
    e.statusCode = mapped.status;
    throw e;
  }
}

export async function runAiStudyPlanGenerator(params: {
  examDate: string;
  subjects: string[];
  dailyHours: number;
  targetGoal: string;
  weakTopics: Array<{
    subjectName: string;
    chapterName: string;
    topicName: string;
    accuracyPercent: number;
  }>;
  startDate: string;
}): Promise<{
  planTitle: string;
  tasks: Array<{
    dayOffset: number;
    title: string;
    taskType: 'chapter_study' | 'revision' | 'practice' | 'mock_test';
    subjectName: string;
    chapterName: string;
    estimatedMinutes: number;
  }>;
}> {
  const ai = getGeminiClient();
  const dailyMinutes = Math.max(30, Math.min(480, Math.round(params.dailyHours * 60)));

  const prompt = [
    'Create a focused 7-day personalized Nepal student study schedule starting today.',
    `Target Goal: ${params.targetGoal}`,
    `Exam Date: ${params.examDate}`,
    `Start Date: ${params.startDate}`,
    `Subjects: ${params.subjects.join(', ')}`,
    `Daily Available Study Budget: ${params.dailyHours} hours (${dailyMinutes} minutes/day)`,
    params.weakTopics.length > 0
      ? `Detected Weak Topics (<60% accuracy) to prioritize early:\n${params.weakTopics
          .map((w) => `- ${w.subjectName} > ${w.chapterName} > ${w.topicName} (${w.accuracyPercent}%)`)
          .join('\n')}`
      : 'No weak topics logged yet — balance core concept study, practice MCQs, and revision.',
    'Generate 7 to 12 concrete, actionable tasks distributed over dayOffset 0..6. Keep taskType strictly one of: chapter_study, revision, practice, mock_test.',
  ].join('\n');

  try {
    const { response } = await generateStructuredContent(ai, prompt, {
      systemInstruction:
        'You are an academic study planner for Nepali students preparing for SEE, NEB Class 11/12, and IOE/MECEE-BL/CSIT/CMAT entrances. Output realistic daily tasks.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          planTitle: { type: Type.STRING },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dayOffset: { type: Type.INTEGER },
                title: { type: Type.STRING },
                taskType: { type: Type.STRING },
                subjectName: { type: Type.STRING },
                chapterName: { type: Type.STRING },
                estimatedMinutes: { type: Type.INTEGER },
              },
              required: [
                'dayOffset',
                'title',
                'taskType',
                'subjectName',
                'chapterName',
                'estimatedMinutes',
              ],
            },
          },
        },
        required: ['planTitle', 'tasks'],
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      planTitle?: string;
      tasks?: Array<{
        dayOffset: number;
        title: string;
        taskType: string;
        subjectName: string;
        chapterName: string;
        estimatedMinutes: number;
      }>;
    };

    const allowedTypes = new Set(['chapter_study', 'revision', 'practice', 'mock_test']);
    return {
      planTitle: parsed.planTitle?.trim() || `${params.targetGoal} AI Study Plan`,
      tasks: (parsed.tasks ?? []).slice(0, 14).map((t) => ({
        dayOffset: Math.max(0, Math.min(13, Math.round(t.dayOffset || 0))),
        title: t.title,
        taskType: (allowedTypes.has(t.taskType) ? t.taskType : 'chapter_study') as
          | 'chapter_study'
          | 'revision'
          | 'practice'
          | 'mock_test',
        subjectName: t.subjectName || params.subjects[0] || 'Core Subject',
        chapterName: t.chapterName || 'Core Syllabus',
        estimatedMinutes: Math.max(15, Math.min(180, Math.round(t.estimatedMinutes || 45))),
      })),
    };
  } catch (err) {
    const mapped = mapGeminiError(err);
    const e = new Error(mapped.message) as Error & { statusCode?: number };
    e.statusCode = mapped.status;
    throw e;
  }
}

export async function runAiCareerAssistant(params: {
  prompt: string;
  grounding: {
    courses: Array<{
      slug: string;
      name: string;
      fullForm: string;
      category: string;
      durationLabel: string;
      eligibility: string;
      verifiedFeeMinNpr: number;
      verifiedFeeMaxNpr: number;
      source: string;
      lastVerifiedDate: string;
    }>;
    colleges: Array<{
      slug: string;
      name: string;
      province: string;
      city: string;
      institutionType: string;
      source: string;
      lastVerifiedDate: string;
    }>;
    entranceExams: Array<{
      slug: string;
      code: string;
      name: string;
      conductingBody: string;
      examPatternSummary: string;
      source: string;
      lastVerifiedDate: string;
    }>;
    scholarships: Array<{
      slug: string;
      title: string;
      provider: string;
      category: string;
      financialBenefits: string;
      applicationDeadline: string;
      source: string;
      lastVerifiedDate: string;
    }>;
    careerPaths: Array<{
      slug: string;
      title: string;
      category: string;
      averageSalaryRangeNpr: string;
      source: string;
      lastVerifiedDate: string;
    }>;
  };
}): Promise<Omit<AiCareerAssistantResponse, 'rateLimitRemaining'>> {
  const ai = getGeminiClient();

  const groundingContext = [
    'VERIFIED NEPAL COURSES:',
    ...params.grounding.courses.map(
      (c) =>
        `- [course:${c.slug}] ${c.name} (${c.fullForm}) | Cat: ${c.category} | Fees NPR ${c.verifiedFeeMinNpr}-${c.verifiedFeeMaxNpr} | Elig: ${c.eligibility} | Source: ${c.source} (${c.lastVerifiedDate})`,
    ),
    'VERIFIED ENTRANCE EXAMS:',
    ...params.grounding.entranceExams.map(
      (e) =>
        `- [entrance:${e.slug}] ${e.code} (${e.name}) by ${e.conductingBody} | ${e.examPatternSummary} | Source: ${e.source} (${e.lastVerifiedDate})`,
    ),
    'VERIFIED COLLEGES:',
    ...params.grounding.colleges.map(
      (col) =>
        `- [college:${col.slug}] ${col.name} (${col.city}, ${col.province}, ${col.institutionType}) | Source: ${col.source} (${col.lastVerifiedDate})`,
    ),
    'VERIFIED SCHOLARSHIPS:',
    ...params.grounding.scholarships.map(
      (s) =>
        `- [scholarship:${s.slug}] ${s.title} (${s.category}) by ${s.provider} | Benefit: ${s.financialBenefits} | Window: ${s.applicationDeadline} | Source: ${s.source} (${s.lastVerifiedDate})`,
    ),
    'VERIFIED CAREER PATHS:',
    ...params.grounding.careerPaths.map(
      (cp) =>
        `- [career:${cp.slug}] ${cp.title} (${cp.category}) | Salary: ${cp.averageSalaryRangeNpr} | Source: ${cp.source} (${cp.lastVerifiedDate})`,
    ),
  ].join('\n');

  try {
    const { response } = await generateStructuredContent(
      ai,
      `${groundingContext}\n\nStudent Question: ${params.prompt}`,
      {
        systemInstruction:
          'You are Hamro Education Career & Admissions Advisor for Nepal. Answer strictly using the verified Nepal courses, colleges, entrance exams, scholarships, and career paths provided above. Cite exact slugs that appear in the context so the UI can link students directly to verified records. Never invent fee amounts, seat counts, or college names outside the verified context.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            guidance: { type: Type.STRING },
            keyRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            citedCourseSlugs: { type: Type.ARRAY, items: { type: Type.STRING } },
            citedEntranceSlugs: { type: Type.ARRAY, items: { type: Type.STRING } },
            citedScholarshipSlugs: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['guidance', 'keyRecommendations'],
        },
      },
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      guidance?: string;
      keyRecommendations?: string[];
      citedCourseSlugs?: string[];
      citedEntranceSlugs?: string[];
      citedScholarshipSlugs?: string[];
    };

    const citedRecords: AiCareerCitation[] = [];
    for (const slug of parsed.citedCourseSlugs ?? []) {
      const c = params.grounding.courses.find((item) => item.slug === slug);
      if (c) {
        citedRecords.push({
          type: 'course',
          title: `${c.name} — ${c.fullForm}`,
          route: `/explore/courses/${c.slug}`,
          source: c.source,
          lastVerifiedDate: c.lastVerifiedDate,
        });
      }
    }
    for (const slug of parsed.citedEntranceSlugs ?? []) {
      const ex = params.grounding.entranceExams.find((item) => item.slug === slug);
      if (ex) {
        citedRecords.push({
          type: 'entrance',
          title: `${ex.code} — ${ex.name}`,
          route: `/entrance/${ex.slug}`,
          source: ex.source,
          lastVerifiedDate: ex.lastVerifiedDate,
        });
      }
    }
    for (const slug of parsed.citedScholarshipSlugs ?? []) {
      const sc = params.grounding.scholarships.find((item) => item.slug === slug);
      if (sc) {
        citedRecords.push({
          type: 'scholarship',
          title: sc.title,
          route: '/explore/scholarships',
          source: sc.source,
          lastVerifiedDate: sc.lastVerifiedDate,
        });
      }
    }

    return {
      guidance: parsed.guidance?.trim() || 'Unable to generate guidance.',
      keyRecommendations: Array.isArray(parsed.keyRecommendations)
        ? parsed.keyRecommendations.slice(0, 5)
        : [],
      citedRecords: citedRecords.slice(0, 6),
      disclaimer:
        'AI-Generated Guidance Notice: This educational recommendation is generated by AI using Hamro Education’s verified Nepal catalog, and is not an official university admission decision. Always confirm final seats, eligibility, and deadlines directly with official IOE, MEC, TU, KU, PU, and Purbanchal University notices.',
    };
  } catch (err) {
    const mapped = mapGeminiError(err);
    const e = new Error(mapped.message) as Error & { statusCode?: number };
    e.statusCode = mapped.status;
    throw e;
  }
}
