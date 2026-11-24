export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  consume(key: string, maxRequests: number, windowMs: number, nowMs = Date.now()): RateLimitDecision {
    const cutoff = nowMs - windowMs;
    const prev = this.buckets.get(key) ?? [];
    const active = prev.filter((ts) => ts > cutoff);

    if (active.length >= maxRequests) {
      const oldest = active[0] ?? nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
      this.buckets.set(key, active);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    active.push(nowMs);
    this.buckets.set(key, active);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - active.length),
      retryAfterSeconds: 0,
    };
  }
}

export function validateAiPromptText(
  raw: unknown,
  opts?: { minLength?: number; maxLength?: number; fieldName?: string },
): { valid: true; text: string } | { valid: false; error: string } {
  const minLength = opts?.minLength ?? 2;
  const maxLength = opts?.maxLength ?? 2000;
  const fieldName = opts?.fieldName ?? 'prompt';

  if (typeof raw !== 'string') {
    return { valid: false, error: `${fieldName} must be a text string.` };
  }

  // Strip ASCII control chars except newline and tab
  const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (cleaned.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters long.`,
    };
  }
  if (cleaned.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must not exceed ${maxLength} characters.`,
    };
  }
  return { valid: true, text: cleaned };
}

export interface CommunityModerationCheck {
  clean: boolean;
  violations: string[];
  blockedReason?: string;
}

const PROFANITY_PATTERNS: RegExp[] = [
  /\b(fuck|fucking|shit|bitch|asshole|bastard|dickhead|motherfucker|slut|whore)\b/i,
  /\b(idiot|moron|stupid\s+loser|kill\s+yourself)\b/i,
  /\b(muji|chikne|randi|khate|machikne)\b/i,
];

const SPAM_PATTERNS: RegExp[] = [
  /(.)\1{9,}/, // 10+ repeated characters
  /\b(buy\s+followers|free\s+crypto|whatsapp\s+me|telegram\s+me|click\s+here\s+to\s+win)\b/i,
];

const EMAIL_PII_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_PII_REGEX = /(?:\+?977[-\s]?)?(?:98|97|96)\d{8}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

export function moderateCommunityText(text: string): CommunityModerationCheck {
  const trimmed = text.trim();
  const violations: string[] = [];

  if (!trimmed) {
    return {
      clean: false,
      violations: ['empty_content'],
      blockedReason: 'Post or comment content cannot be empty.',
    };
  }

  if (PROFANITY_PATTERNS.some((re) => re.test(trimmed))) {
    violations.push('profanity_or_abuse');
  }

  if (SPAM_PATTERNS.some((re) => re.test(trimmed))) {
    violations.push('spam_pattern');
  }

  const urlCount = (trimmed.match(/https?:\/\/\S+/gi) ?? []).length;
  if (urlCount > 2) {
    violations.push('excessive_links');
  }

  if (EMAIL_PII_REGEX.test(trimmed)) {
    violations.push('personal_email_pii');
  }

  if (PHONE_PII_REGEX.test(trimmed)) {
    violations.push('personal_phone_pii');
  }

  if (violations.length === 0) {
    return { clean: true, violations: [] };
  }

  if (violations.includes('profanity_or_abuse')) {
    return {
      clean: false,
      violations,
      blockedReason:
        'Youth Safety Filter: Profanity, harassment, or abusive language is blocked in Hamro Education community rooms.',
    };
  }

  if (violations.includes('personal_email_pii') || violations.includes('personal_phone_pii')) {
    return {
      clean: false,
      violations,
      blockedReason:
        'Youth Safety Privacy Guard: Do not share phone numbers or personal email addresses in public discussions.',
    };
  }

  return {
    clean: false,
    violations,
    blockedReason:
      'Automated Spam Filter: Suspicious links or repetitive promotional patterns are not allowed.',
  };
}

export function formatYouthSafeCommunityAuthor(params: {
  fullName: string;
  displayName?: string | null;
  roleSlugs: string[];
  userId: number;
  gradeOrTrack?: string | null;
}): {
  displayHandle: string;
  roleLabel: string;
  isEducator: boolean;
  trackLabel: string;
} {
  const educatorRoles = new Set([
    'teacher',
    'academic_reviewer',
    'content_manager',
    'question_bank_manager',
    'examination_manager',
    'moderator',
    'administrator',
    'super_administrator',
  ]);
  const isEducator = params.roleSlugs.some((r) => educatorRoles.has(r));

  let roleLabel = 'Student';
  if (params.roleSlugs.includes('super_administrator') || params.roleSlugs.includes('administrator')) {
    roleLabel = 'Academic Admin';
  } else if (params.roleSlugs.includes('academic_reviewer')) {
    roleLabel = 'Academic Reviewer';
  } else if (params.roleSlugs.includes('teacher')) {
    roleLabel = 'Verified Teacher';
  } else if (params.roleSlugs.includes('moderator')) {
    roleLabel = 'Safety Moderator';
  }

  const rawName = (params.displayName || params.fullName || 'Learner').trim();
  const safeBase = rawName.includes('@') ? rawName.split('@')[0] : rawName;
  const parts = safeBase.split(/\s+/).filter(Boolean);

  // Youth safety: always mask surnames/identities for school-age learners; show first + initial only
  let displayHandle: string;
  if (isEducator) {
    displayHandle = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : safeBase;
  } else if (parts.length >= 2) {
    displayHandle = `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
  } else {
    const single = parts[0] || 'Scholar';
    displayHandle = single.length <= 2 ? `Scholar #${params.userId}` : `${single.slice(0, 12)} #${params.userId}`;
  }

  return {
    displayHandle,
    roleLabel,
    isEducator,
    trackLabel: isEducator ? roleLabel : params.gradeOrTrack?.trim() || 'Nepal Learner',
  };
}

export function canMarkTeacherVerified(permissions: string[], roleSlugs: string[]): boolean {
  return (
    permissions.includes('system:admin') ||
    permissions.includes('curriculum:review') ||
    permissions.includes('curriculum:write') ||
    roleSlugs.includes('teacher') ||
    roleSlugs.includes('academic_reviewer') ||
    roleSlugs.includes('administrator') ||
    roleSlugs.includes('super_administrator')
  );
}

export function canModerateCommunity(permissions: string[], roleSlugs: string[]): boolean {
  return (
    permissions.includes('system:admin') ||
    permissions.includes('moderation:act') ||
    roleSlugs.includes('moderator') ||
    roleSlugs.includes('administrator') ||
    roleSlugs.includes('super_administrator')
  );
}

export const AI_QUESTION_SOURCE_LABEL = 'AI-Generated — Pending Academic Review' as const;

export function enforceAiQuestionDraftGuardrail<
  T extends { status?: string; source?: string; aiGenerated?: boolean },
>(
  draft: T,
): Omit<T, 'status' | 'source' | 'aiGenerated' | 'reviewer'> & {
  status: 'Draft';
  source: 'AI-Generated — Pending Academic Review';
  aiGenerated: true;
  reviewer: string;
} {
  return {
    ...draft,
    status: 'Draft',
    source: AI_QUESTION_SOURCE_LABEL,
    aiGenerated: true,
    reviewer: 'Pending Academic Review',
  };
}

export const YOUTH_SAFETY_RULES: string[] = [
  'Student profiles hide emails, phone numbers, and exact school or home addresses.',
  'Automated profanity, abuse, spam, and personal contact-info filters scan every post and reply.',
  'Any learner can report inappropriate or inaccurate content in one click for moderator action.',
  'Teacher-Verified badges are restricted strictly to authenticated Teacher and Academic Reviewer roles.',
];
