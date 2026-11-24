import type { QuestionWorkflowStatus } from '../db/schema.ts';
import type { AdminModuleId, EditorialLifecycleStage } from '../types/api.ts';

export const EDITORIAL_LIFECYCLE_STAGES: EditorialLifecycleStage[] = [
  'Draft',
  'Review',
  'Correction',
  'Approved',
  'Published',
  'Archived',
];

export const NEPAL_PLATFORM_DEFAULTS = {
  countryCode: 'NP',
  countryName: 'Nepal',
  timezone: 'Asia/Kathmandu',
  currencyCode: 'NPR',
} as const;

export function normalizeLifecycleStage(status: string): EditorialLifecycleStage {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'draft') return 'Draft';
  if (s === 'in_review' || s === 'review' || s === 'academic review') return 'Review';
  if (s === 'correction' || s === 'changes_requested') return 'Correction';
  if (s === 'approved' || s === 'approval') return 'Approved';
  if (s === 'published') return 'Published';
  if (s === 'archived') return 'Archived';
  return 'Draft';
}

export function toResourceStatusDb(
  stage: EditorialLifecycleStage,
): 'draft' | 'in_review' | 'correction' | 'approved' | 'published' | 'archived' {
  switch (stage) {
    case 'Draft':
      return 'draft';
    case 'Review':
      return 'in_review';
    case 'Correction':
      return 'correction';
    case 'Approved':
      return 'approved';
    case 'Published':
      return 'published';
    case 'Archived':
      return 'archived';
  }
}

export function toQuestionStatusDb(stage: EditorialLifecycleStage): QuestionWorkflowStatus {
  switch (stage) {
    case 'Draft':
      return 'Draft';
    case 'Review':
      return 'Academic Review';
    case 'Correction':
      return 'Correction';
    case 'Approved':
      return 'Approval';
    case 'Published':
      return 'Published';
    case 'Archived':
      return 'Archived';
  }
}

export interface EditorialTransitionCheckInput {
  currentStatus: string;
  nextStage: EditorialLifecycleStage;
  aiGenerated?: boolean;
  hasVerifiedSource: boolean;
  userPermissions: string[];
  userRoles: string[];
}

export function validateEditorialTransition(input: EditorialTransitionCheckInput): {
  allowed: boolean;
  reason?: string;
} {
  const currentStage = normalizeLifecycleStage(input.currentStatus);
  const { nextStage, aiGenerated, hasVerifiedSource, userPermissions, userRoles } = input;

  const isReviewer =
    userPermissions.includes('curriculum:review') ||
    userPermissions.includes('system:admin') ||
    userRoles.includes('academic_reviewer') ||
    userRoles.includes('administrator') ||
    userRoles.includes('super_administrator');

  const isPublisher =
    isReviewer ||
    userPermissions.includes('curriculum:publish') ||
    userRoles.includes('content_manager');

  const isAuthor =
    isPublisher ||
    userPermissions.includes('curriculum:write') ||
    userPermissions.includes('questions:manage') ||
    userPermissions.includes('exams:manage');

  if (!isAuthor) {
    return {
      allowed: false,
      reason: 'Insufficient editorial permissions to update lifecycle status.',
    };
  }

  if (nextStage === 'Approved') {
    if (!isReviewer) {
      return {
        allowed: false,
        reason: 'Only an Academic Reviewer or Administrator can mark items Approved.',
      };
    }
  }

  if (nextStage === 'Published') {
    if (!hasVerifiedSource) {
      return {
        allowed: false,
        reason: 'A verified source reference is required before publishing content.',
      };
    }
    if (aiGenerated) {
      if (!isReviewer) {
        return {
          allowed: false,
          reason:
            'AI-generated content requires Academic Reviewer or Administrator sign-off before publishing.',
        };
      }
      if (currentStage === 'Draft' || currentStage === 'Correction') {
        return {
          allowed: false,
          reason:
            'Unverified AI-generated items cannot jump directly from Draft/Correction to Published. Move through Review and Approved first.',
        };
      }
    } else if (!isPublisher) {
      return {
        allowed: false,
        reason: 'Publishing requires Academic Reviewer, Content Manager, or Administrator permission.',
      };
    }
  }

  if (nextStage === 'Archived' && !isPublisher) {
    return {
      allowed: false,
      reason: 'Archiving requires Content Manager, Academic Reviewer, or Administrator permission.',
    };
  }

  return { allowed: true };
}

export function getAllowedAdminModules(
  permissions: string[],
  roleSlugs: string[],
): AdminModuleId[] {
  const set = new Set<AdminModuleId>();
  const isRootOrAdmin =
    permissions.includes('system:admin') ||
    roleSlugs.includes('super_administrator') ||
    roleSlugs.includes('administrator');

  if (isRootOrAdmin) {
    return [
      'overview',
      'users',
      'roles',
      'curriculum',
      'content',
      'questions',
      'exams',
      'entrance',
      'explorer',
      'moderation',
      'announcements',
      'analytics',
      'settings',
      'audit_logs',
    ];
  }

  if (roleSlugs.includes('institutional_administrator')) {
    set.add('overview');
    set.add('users');
    set.add('roles');
    set.add('curriculum');
    set.add('content');
    set.add('announcements');
    set.add('analytics');
  }
  if (roleSlugs.includes('moderator') || permissions.includes('moderation:act')) {
    set.add('overview');
    set.add('users');
    set.add('moderation');
    set.add('announcements');
  }
  if (roleSlugs.includes('examination_manager') || permissions.includes('exams:manage')) {
    set.add('overview');
    set.add('questions');
    set.add('exams');
    set.add('analytics');
  }
  if (roleSlugs.includes('question_bank_manager') || permissions.includes('questions:manage')) {
    set.add('overview');
    set.add('questions');
    set.add('analytics');
  }
  if (roleSlugs.includes('career_information_manager') || permissions.includes('careers:manage')) {
    set.add('overview');
    set.add('entrance');
    set.add('explorer');
  }
  if (roleSlugs.includes('content_manager') || permissions.includes('curriculum:publish')) {
    set.add('overview');
    set.add('curriculum');
    set.add('content');
    set.add('announcements');
  }
  if (roleSlugs.includes('academic_reviewer') || permissions.includes('curriculum:review')) {
    set.add('overview');
    set.add('content');
    set.add('questions');
    set.add('analytics');
  }
  if (roleSlugs.includes('teacher') || permissions.includes('curriculum:write')) {
    set.add('overview');
    set.add('curriculum');
    set.add('content');
    set.add('questions');
  }

  const ORDER: AdminModuleId[] = [
    'overview',
    'users',
    'roles',
    'curriculum',
    'content',
    'questions',
    'exams',
    'entrance',
    'explorer',
    'moderation',
    'announcements',
    'analytics',
    'settings',
    'audit_logs',
  ];
  return ORDER.filter((m) => set.has(m));
}

export function normalizePromptFingerprint(prompt: string): string {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

export function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export interface ParsedCsvQuestionRow {
  rowNumber: number;
  academicLevel: string;
  examination: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  questionType: 'single_mcq' | 'multiple_mcq' | 'true_false' | 'numerical';
  difficulty: 'easy' | 'medium' | 'hard';
  prompt: string;
  options: Array<{ optionKey: string; optionText: string; isCorrect: boolean }>;
  correctAnswer: {
    optionKeys?: string[];
    booleanValue?: boolean;
    numericValue?: number;
    tolerance?: number;
  };
  explanation: string;
  marks: number;
  negativeMarks: number;
  source: string;
}

export function parseQuestionImportCsv(csvText: string): {
  validRows: ParsedCsvQuestionRow[];
  errors: Array<{ rowNumber: number; message: string }>;
} {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, message: 'CSV must include a header row and at least one question row.' }],
    };
  }

  const headers = matrix[0].map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  );

  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));
  const iExam = idx(['examination', 'exam']);
  const iLevel = idx(['academic_level', 'level']);
  const iSubject = idx(['subject', 'subject_name']);
  const iChapter = idx(['chapter', 'chapter_name']);
  const iTopic = idx(['topic', 'topic_name']);
  const iType = idx(['question_type', 'type']);
  const iDiff = idx(['difficulty']);
  const iPrompt = idx(['prompt', 'question', 'question_content']);
  const iOptA = idx(['option_a', 'a']);
  const iOptB = idx(['option_b', 'b']);
  const iOptC = idx(['option_c', 'c']);
  const iOptD = idx(['option_d', 'd']);
  const iAns = idx(['correct_answer', 'answer']);
  const iExp = idx(['explanation', 'solution']);
  const iMarks = idx(['marks']);
  const iNeg = idx(['negative_marks', 'negative']);
  const iSource = idx(['source']);

  if (iSubject === -1 || iPrompt === -1 || iAns === -1) {
    return {
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          message:
            'Missing required CSV headers. Required: subject, prompt, correct_answer (plus optional examination, chapter, topic, option_a..d, explanation, source).',
        },
      ],
    };
  }

  const validRows: ParsedCsvQuestionRow[] = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    const rowNumber = r + 1;
    const get = (col: number) => (col >= 0 && col < row.length ? row[col].trim() : '');

    const subjectName = get(iSubject);
    const prompt = get(iPrompt);
    const rawAns = get(iAns);
    const explanation = get(iExp) || 'Verified syllabus solution pending detailed review.';
    const examination = get(iExam) || 'SEE';
    const academicLevel = get(iLevel) || 'Secondary & Higher Secondary';
    const chapterName = get(iChapter) || 'Core Chapter';
    const topicName = get(iTopic) || 'Core Topic';
    const source = get(iSource) || 'Faculty CSV Import';

    if (subjectName.length < 2 || prompt.length < 5 || !rawAns) {
      errors.push({
        rowNumber,
        message: 'Row missing valid subject, prompt (min 5 chars), or correct_answer.',
      });
      continue;
    }

    const rawType = (get(iType) || 'single_mcq').toLowerCase();
    const questionType: ParsedCsvQuestionRow['questionType'] =
      rawType === 'multiple_mcq' || rawType === 'true_false' || rawType === 'numerical'
        ? rawType
        : 'single_mcq';

    const rawDiff = (get(iDiff) || 'medium').toLowerCase();
    const difficulty: ParsedCsvQuestionRow['difficulty'] =
      rawDiff === 'easy' || rawDiff === 'hard' ? rawDiff : 'medium';

    const marksParsed = Number(get(iMarks));
    const marks = Number.isFinite(marksParsed) && marksParsed > 0 ? marksParsed : 1;
    const negParsed = Number(get(iNeg));
    const negativeMarks = Number.isFinite(negParsed) && negParsed >= 0 ? negParsed : 0;

    if (questionType === 'numerical') {
      const numericValue = Number(rawAns);
      if (!Number.isFinite(numericValue)) {
        errors.push({ rowNumber, message: 'Numerical question requires a numeric correct_answer.' });
        continue;
      }
      validRows.push({
        rowNumber,
        academicLevel,
        examination,
        subjectName,
        chapterName,
        topicName,
        questionType,
        difficulty,
        prompt,
        options: [],
        correctAnswer: { numericValue, tolerance: 0.05 },
        explanation,
        marks,
        negativeMarks,
        source,
      });
      continue;
    }

    if (questionType === 'true_false') {
      const boolVal = rawAns.toLowerCase() === 'true' || rawAns.toLowerCase() === 't';
      validRows.push({
        rowNumber,
        academicLevel,
        examination,
        subjectName,
        chapterName,
        topicName,
        questionType,
        difficulty,
        prompt,
        options: [],
        correctAnswer: { booleanValue: boolVal },
        explanation,
        marks,
        negativeMarks,
        source,
      });
      continue;
    }

    const optPairs = [
      { key: 'A', text: get(iOptA) },
      { key: 'B', text: get(iOptB) },
      { key: 'C', text: get(iOptC) },
      { key: 'D', text: get(iOptD) },
    ].filter((o) => o.text.length > 0);

    if (optPairs.length < 2) {
      errors.push({
        rowNumber,
        message: 'MCQ rows require at least option_a and option_b.',
      });
      continue;
    }

    const answerKeys = rawAns
      .split(/[|;,]/)
      .map((k) => k.trim().toUpperCase())
      .filter((k) => optPairs.some((o) => o.key === k));

    if (answerKeys.length === 0) {
      errors.push({
        rowNumber,
        message: `correct_answer '${rawAns}' does not match provided option keys (${optPairs.map((o) => o.key).join(', ')}).`,
      });
      continue;
    }

    validRows.push({
      rowNumber,
      academicLevel,
      examination,
      subjectName,
      chapterName,
      topicName,
      questionType,
      difficulty,
      prompt,
      options: optPairs.map((o) => ({
        optionKey: o.key,
        optionText: o.text,
        isCorrect: answerKeys.includes(o.key),
      })),
      correctAnswer: {
        optionKeys: questionType === 'single_mcq' ? [answerKeys[0]] : answerKeys,
      },
      explanation,
      marks,
      negativeMarks,
      source,
    });
  }

  return { validRows, errors };
}

export function detectDuplicateQuestions(
  incomingRows: ParsedCsvQuestionRow[],
  existingPrompts: string[],
): {
  uniqueRows: ParsedCsvQuestionRow[];
  duplicates: Array<{ rowNumber: number; prompt: string; reason: string }>;
} {
  const existingSet = new Set(existingPrompts.map(normalizePromptFingerprint).filter(Boolean));
  const batchSet = new Set<string>();
  const uniqueRows: ParsedCsvQuestionRow[] = [];
  const duplicates: Array<{ rowNumber: number; prompt: string; reason: string }> = [];

  for (const row of incomingRows) {
    const fp = normalizePromptFingerprint(row.prompt);
    if (existingSet.has(fp)) {
      duplicates.push({
        rowNumber: row.rowNumber,
        prompt: row.prompt,
        reason: 'Matches an existing question already stored in the Question Bank.',
      });
      continue;
    }
    if (batchSet.has(fp)) {
      duplicates.push({
        rowNumber: row.rowNumber,
        prompt: row.prompt,
        reason: 'Duplicate question prompt repeated inside this CSV import batch.',
      });
      continue;
    }
    batchSet.add(fp);
    uniqueRows.push(row);
  }

  return { uniqueRows, duplicates };
}
