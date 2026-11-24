export type RoleSlug =
  | 'guest'
  | 'registered_student'
  | 'teacher'
  | 'academic_reviewer'
  | 'content_manager'
  | 'question_bank_manager'
  | 'examination_manager'
  | 'career_information_manager'
  | 'moderator'
  | 'administrator'
  | 'super_administrator'
  | 'institutional_administrator';

export interface RoleDefinition {
  slug: RoleSlug;
  name: string;
  description: string;
  hierarchyTier: number;
  scopeType: 'global' | 'country' | 'institution';
  permissions: string[];
}

export interface PermissionDefinition {
  code: string;
  resource: string;
  action: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    code: 'curriculum:read',
    resource: 'curriculum',
    action: 'read',
    description: 'Browse countries, curricula, grades, streams, subjects, chapters, and published topics.',
  },
  {
    code: 'curriculum:write',
    resource: 'curriculum',
    action: 'write',
    description: 'Create and edit curriculum nodes, subjects, chapters, and topics.',
  },
  {
    code: 'curriculum:review',
    resource: 'curriculum',
    action: 'review',
    description: 'Verify academic accuracy and approve or request changes on curriculum topics.',
  },
  {
    code: 'curriculum:publish',
    resource: 'curriculum',
    action: 'publish',
    description: 'Publish or archive curricula and country-level syllabus versions.',
  },
  {
    code: 'questions:manage',
    resource: 'questions',
    action: 'manage',
    description: 'Author, tag, and curate question bank items mapped to curriculum topics.',
  },
  {
    code: 'exams:manage',
    resource: 'exams',
    action: 'manage',
    description: 'Configure mock exams, SEE/NEB test blueprints, schedules, and grading rules.',
  },
  {
    code: 'careers:manage',
    resource: 'careers',
    action: 'manage',
    description: 'Publish career pathways, entrance roadmaps, and scholarship advisories.',
  },
  {
    code: 'moderation:act',
    resource: 'moderation',
    action: 'act',
    description: 'Review flagged community discussions, notes, and user reports.',
  },
  {
    code: 'institutions:read',
    resource: 'institutions',
    action: 'read',
    description: 'View registered schools, colleges, and educational boards.',
  },
  {
    code: 'institutions:manage',
    resource: 'institutions',
    action: 'manage',
    description: 'Register, verify, and configure partner schools and campuses.',
  },
  {
    code: 'users:read',
    resource: 'users',
    action: 'read',
    description: 'View user directory, profiles, and active role assignments.',
  },
  {
    code: 'users:assign_role',
    resource: 'users',
    action: 'assign_role',
    description: 'Grant or revoke platform and institutional RBAC roles.',
  },
  {
    code: 'system:admin',
    resource: 'system',
    action: 'admin',
    description: 'Full platform governance, Super Administrator delegation, and security oversight.',
  },
];

export const ROLE_CATALOG: RoleDefinition[] = [
  {
    slug: 'guest',
    name: 'Guest',
    description: 'Unauthenticated visitor browsing public country curricula and syllabi.',
    hierarchyTier: 10,
    scopeType: 'global',
    permissions: ['curriculum:read', 'institutions:read'],
  },
  {
    slug: 'registered_student',
    name: 'Registered Student',
    description: 'Verified learner enrolled in a country curriculum, grade, and stream.',
    hierarchyTier: 20,
    scopeType: 'country',
    permissions: ['curriculum:read', 'institutions:read'],
  },
  {
    slug: 'teacher',
    name: 'Teacher',
    description: 'Educator authoring lesson drafts, classroom notes, and topic guidance.',
    hierarchyTier: 35,
    scopeType: 'institution',
    permissions: ['curriculum:read', 'curriculum:write', 'institutions:read'],
  },
  {
    slug: 'academic_reviewer',
    name: 'Academic Reviewer',
    description: 'Subject-matter expert auditing syllabus alignment with CDC/NEB or national boards.',
    hierarchyTier: 45,
    scopeType: 'country',
    permissions: ['curriculum:read', 'curriculum:review', 'institutions:read'],
  },
  {
    slug: 'content_manager',
    name: 'Content Manager',
    description: 'Curates subjects, chapters, multilingual topics, and learning objectives.',
    hierarchyTier: 50,
    scopeType: 'country',
    permissions: ['curriculum:read', 'curriculum:write', 'curriculum:publish', 'institutions:read'],
  },
  {
    slug: 'question_bank_manager',
    name: 'Question Bank Manager',
    description: 'Maintains topic-indexed formative and board-exam question banks.',
    hierarchyTier: 55,
    scopeType: 'country',
    permissions: ['curriculum:read', 'questions:manage', 'institutions:read'],
  },
  {
    slug: 'examination_manager',
    name: 'Examination Manager',
    description: 'Oversees timed mock tests, SEE/NEB exam blueprints, and evaluation standards.',
    hierarchyTier: 60,
    scopeType: 'country',
    permissions: ['curriculum:read', 'questions:manage', 'exams:manage', 'institutions:read'],
  },
  {
    slug: 'career_information_manager',
    name: 'Career Information Manager',
    description: 'Manages post-SEE, +2 stream guidance, university entrance, and global career tracks.',
    hierarchyTier: 55,
    scopeType: 'country',
    permissions: ['curriculum:read', 'careers:manage', 'institutions:read'],
  },
  {
    slug: 'moderator',
    name: 'Moderator',
    description: 'Enforces community trust & safety across student/teacher interactions.',
    hierarchyTier: 65,
    scopeType: 'global',
    permissions: ['curriculum:read', 'moderation:act', 'users:read', 'institutions:read'],
  },
  {
    slug: 'institutional_administrator',
    name: 'Institutional Administrator',
    description: 'Manages teachers, students, and academic cohorts for a verified school or college.',
    hierarchyTier: 75,
    scopeType: 'institution',
    permissions: [
      'curriculum:read',
      'curriculum:write',
      'institutions:read',
      'users:read',
      'users:assign_role',
    ],
  },
  {
    slug: 'administrator',
    name: 'Administrator',
    description: 'Operates country curricula, institutions, and non-super-admin role governance.',
    hierarchyTier: 90,
    scopeType: 'global',
    permissions: [
      'curriculum:read',
      'curriculum:write',
      'curriculum:review',
      'curriculum:publish',
      'questions:manage',
      'exams:manage',
      'careers:manage',
      'moderation:act',
      'institutions:read',
      'institutions:manage',
      'users:read',
      'users:assign_role',
    ],
  },
  {
    slug: 'super_administrator',
    name: 'Super Administrator',
    description: 'Root platform authority with unrestricted RBAC delegation and multi-country control.',
    hierarchyTier: 100,
    scopeType: 'global',
    permissions: PERMISSION_CATALOG.map((p) => p.code),
  },
];

export const INSTITUTION_ASSIGNABLE_ROLES: RoleSlug[] = [
  'registered_student',
  'teacher',
  'academic_reviewer',
  'content_manager',
];

export function hasPermission(
  userPermissions: string[],
  required: string | string[],
): boolean {
  if (userPermissions.includes('system:admin')) {
    return true;
  }
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((perm) => userPermissions.includes(perm));
}

export function hasAnyRole(
  userRoles: string[],
  allowedRoles: string[],
): boolean {
  return allowedRoles.some((role) => userRoles.includes(role));
}

export interface RoleAssignmentCheckInput {
  actorRoles: string[];
  targetRoleSlug: string;
  actorInstitutionIds: number[];
  targetInstitutionId: number | null;
}

export function canAssignRole(input: RoleAssignmentCheckInput): {
  allowed: boolean;
  reason?: string;
} {
  const { actorRoles, targetRoleSlug, actorInstitutionIds, targetInstitutionId } = input;

  const validRole = ROLE_CATALOG.some((r) => r.slug === targetRoleSlug);
  if (!validRole) {
    return { allowed: false, reason: `Unknown role: ${targetRoleSlug}` };
  }

  if (actorRoles.includes('super_administrator')) {
    return { allowed: true };
  }

  if (actorRoles.includes('administrator')) {
    if (targetRoleSlug === 'super_administrator') {
      return {
        allowed: false,
        reason: 'Only a Super Administrator can grant the Super Administrator role.',
      };
    }
    return { allowed: true };
  }

  if (actorRoles.includes('institutional_administrator')) {
    if (!INSTITUTION_ASSIGNABLE_ROLES.includes(targetRoleSlug as RoleSlug)) {
      return {
        allowed: false,
        reason: 'Institutional Administrators can only assign student, teacher, reviewer, or content roles.',
      };
    }
    if (!targetInstitutionId || !actorInstitutionIds.includes(targetInstitutionId)) {
      return {
        allowed: false,
        reason: 'Institutional Administrators can only assign roles within their own verified institution.',
      };
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Requires Administrator, Super Administrator, or scoped Institutional Administrator role.',
  };
}

export function getHighestRoleTier(roleSlugs: string[]): number {
  let highest = 0;
  for (const slug of roleSlugs) {
    const found = ROLE_CATALOG.find((r) => r.slug === slug);
    if (found && found.hierarchyTier > highest) {
      highest = found.hierarchyTier;
    }
  }
  return highest;
}

export function canRevokeRole(input: RoleAssignmentCheckInput): {
  allowed: boolean;
  reason?: string;
} {
  const { actorRoles, targetRoleSlug, actorInstitutionIds, targetInstitutionId } = input;

  if (actorRoles.includes('super_administrator')) {
    return { allowed: true };
  }

  if (actorRoles.includes('administrator')) {
    if (targetRoleSlug === 'super_administrator') {
      return {
        allowed: false,
        reason: 'Only a Super Administrator can revoke another Super Administrator.',
      };
    }
    return { allowed: true };
  }

  if (actorRoles.includes('institutional_administrator')) {
    if (!INSTITUTION_ASSIGNABLE_ROLES.includes(targetRoleSlug as RoleSlug)) {
      return {
        allowed: false,
        reason: 'Institutional Administrators can only revoke student, teacher, reviewer, or content roles.',
      };
    }
    if (!targetInstitutionId || !actorInstitutionIds.includes(targetInstitutionId)) {
      return {
        allowed: false,
        reason: 'Institutional Administrators can only revoke roles belonging to their own verified institution.',
      };
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Requires Administrator, Super Administrator, or scoped Institutional Administrator role.',
  };
}

export interface UserAccountGovernanceCheckInput {
  actorRoles: string[];
  actorInstitutionIds: number[];
  targetRoles: string[];
  targetInstitutionId: number | null;
  requestedStatus?: 'active' | 'suspended';
  requestedInstitutionId?: number | null;
  requestedFullName?: string;
}

export function canManageTargetUserAccount(
  input: UserAccountGovernanceCheckInput,
): { allowed: boolean; reason?: string } {
  const {
    actorRoles,
    actorInstitutionIds,
    targetRoles,
    targetInstitutionId,
    requestedStatus,
    requestedInstitutionId,
    requestedFullName,
  } = input;

  if (actorRoles.includes('super_administrator')) {
    return { allowed: true };
  }

  if (actorRoles.includes('administrator')) {
    if (targetRoles.includes('super_administrator')) {
      return {
        allowed: false,
        reason: 'Only a Super Administrator can modify or suspend a Super Administrator account.',
      };
    }
    return { allowed: true };
  }

  if (actorRoles.includes('institutional_administrator')) {
    const hasProtectedTargetRole = targetRoles.some(
      (slug) => !INSTITUTION_ASSIGNABLE_ROLES.includes(slug as RoleSlug),
    );
    if (hasProtectedTargetRole) {
      return {
        allowed: false,
        reason: 'Institutional Administrators cannot modify platform administrators, moderators, or exam managers.',
      };
    }

    const inActorInstitution =
      targetInstitutionId !== null && actorInstitutionIds.includes(targetInstitutionId);
    const onboardingToActorInstitution =
      targetInstitutionId === null &&
      typeof requestedInstitutionId === 'number' &&
      actorInstitutionIds.includes(requestedInstitutionId);

    if (!inActorInstitution && !onboardingToActorInstitution) {
      return {
        allowed: false,
        reason: 'Institutional Administrators can only manage accounts affiliated with their own institution.',
      };
    }

    if (
      requestedInstitutionId !== undefined &&
      requestedInstitutionId !== null &&
      !actorInstitutionIds.includes(requestedInstitutionId)
    ) {
      return {
        allowed: false,
        reason: 'Institutional Administrators cannot reassign users to another institution.',
      };
    }

    return { allowed: true };
  }

  if (actorRoles.includes('moderator')) {
    if (requestedInstitutionId !== undefined || requestedFullName !== undefined) {
      return {
        allowed: false,
        reason: 'Moderators cannot change institutional affiliations or profile names.',
      };
    }
    const targetIsStaffOrAdmin = targetRoles.some(
      (slug) => slug !== 'registered_student' && slug !== 'guest',
    );
    if (targetIsStaffOrAdmin || requestedStatus === undefined) {
      return {
        allowed: false,
        reason: 'Moderators may only suspend or reactivate student accounts.',
      };
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Insufficient governance privileges to modify user accounts.',
  };
}

export function isValidPasswordStrength(password: string): {
  valid: boolean;
  reason?: string;
} {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, reason: 'Password must not exceed 128 characters.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      reason: 'Password must include at least one letter and one number.',
    };
  }
  return { valid: true };
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 254;
}
