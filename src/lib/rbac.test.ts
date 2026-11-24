import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_CATALOG,
  canAssignRole,
  canManageTargetUserAccount,
  canRevokeRole,
  hasAnyRole,
  hasPermission,
  isValidEmail,
  isValidPasswordStrength,
} from './rbac';

test('ROLE_CATALOG includes all 12 Section 15 roles', () => {
  const names = ROLE_CATALOG.map((r) => r.name);
  const expected = [
    'Guest',
    'Registered Student',
    'Teacher',
    'Academic Reviewer',
    'Content Manager',
    'Question Bank Manager',
    'Examination Manager',
    'Career Information Manager',
    'Moderator',
    'Administrator',
    'Super Administrator',
    'Institutional Administrator',
  ];
  assert.equal(ROLE_CATALOG.length, 12);
  for (const name of expected) {
    assert.ok(names.includes(name), `Missing role: ${name}`);
  }
});

test('hasPermission grants wildcard to system:admin and checks specific permissions', () => {
  assert.equal(hasPermission(['system:admin'], 'users:assign_role'), true);
  assert.equal(hasPermission(['curriculum:read', 'curriculum:write'], ['curriculum:read', 'curriculum:write']), true);
  assert.equal(hasPermission(['curriculum:read'], 'curriculum:write'), false);
});

test('hasAnyRole evaluates role membership cleanly', () => {
  assert.equal(hasAnyRole(['teacher', 'registered_student'], ['teacher', 'administrator']), true);
  assert.equal(hasAnyRole(['guest'], ['administrator', 'super_administrator']), false);
});

test('canAssignRole enforces strict RBAC hierarchy and institution boundaries', () => {
  // Super Administrator can assign any role
  assert.equal(
    canAssignRole({
      actorRoles: ['super_administrator'],
      targetRoleSlug: 'administrator',
      actorInstitutionIds: [],
      targetInstitutionId: null,
    }).allowed,
    true,
  );

  // Administrator cannot elevate to Super Administrator
  const adminToSuper = canAssignRole({
    actorRoles: ['administrator'],
    targetRoleSlug: 'super_administrator',
    actorInstitutionIds: [],
    targetInstitutionId: null,
  });
  assert.equal(adminToSuper.allowed, false);

  // Administrator can assign Content Manager
  assert.equal(
    canAssignRole({
      actorRoles: ['administrator'],
      targetRoleSlug: 'content_manager',
      actorInstitutionIds: [],
      targetInstitutionId: null,
    }).allowed,
    true,
  );

  // Institutional Admin can assign Teacher within own institution only
  assert.equal(
    canAssignRole({
      actorRoles: ['institutional_administrator'],
      targetRoleSlug: 'teacher',
      actorInstitutionIds: [42],
      targetInstitutionId: 42,
    }).allowed,
    true,
  );

  assert.equal(
    canAssignRole({
      actorRoles: ['institutional_administrator'],
      targetRoleSlug: 'teacher',
      actorInstitutionIds: [42],
      targetInstitutionId: 99,
    }).allowed,
    false,
  );

  assert.equal(
    canAssignRole({
      actorRoles: ['institutional_administrator'],
      targetRoleSlug: 'administrator',
      actorInstitutionIds: [42],
      targetInstitutionId: 42,
    }).allowed,
    false,
  );

  // Student cannot assign roles
  assert.equal(
    canAssignRole({
      actorRoles: ['registered_student'],
      targetRoleSlug: 'teacher',
      actorInstitutionIds: [1],
      targetInstitutionId: 1,
    }).allowed,
    false,
  );
});

test('password and email validators reject weak credentials', () => {
  assert.equal(isValidPasswordStrength('short1').valid, false);
  assert.equal(isValidPasswordStrength('onlyletters').valid, false);
  assert.equal(isValidPasswordStrength('12345678').valid, false);
  assert.equal(isValidPasswordStrength('HamroEdu2026').valid, true);

  assert.equal(isValidEmail('student@hamro.edu.np'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});

test('canRevokeRole enforces super-admin protection and institutional tenant boundaries', () => {
  assert.equal(
    canRevokeRole({
      actorRoles: ['administrator'],
      targetRoleSlug: 'super_administrator',
      actorInstitutionIds: [],
      targetInstitutionId: null,
    }).allowed,
    false,
  );

  assert.equal(
    canRevokeRole({
      actorRoles: ['super_administrator'],
      targetRoleSlug: 'super_administrator',
      actorInstitutionIds: [],
      targetInstitutionId: null,
    }).allowed,
    true,
  );

  assert.equal(
    canRevokeRole({
      actorRoles: ['institutional_administrator'],
      targetRoleSlug: 'teacher',
      actorInstitutionIds: [12],
      targetInstitutionId: 12,
    }).allowed,
    true,
  );

  assert.equal(
    canRevokeRole({
      actorRoles: ['institutional_administrator'],
      targetRoleSlug: 'teacher',
      actorInstitutionIds: [12],
      targetInstitutionId: 99,
    }).allowed,
    false,
  );

  assert.equal(
    canRevokeRole({
      actorRoles: ['institutional_administrator'],
      targetRoleSlug: 'administrator',
      actorInstitutionIds: [12],
      targetInstitutionId: 12,
    }).allowed,
    false,
  );
});

test('canManageTargetUserAccount enforces moderator, institutional admin, and super-admin safeguards', () => {
  // Administrator cannot suspend Super Administrator
  assert.equal(
    canManageTargetUserAccount({
      actorRoles: ['administrator'],
      actorInstitutionIds: [],
      targetRoles: ['super_administrator'],
      targetInstitutionId: null,
      requestedStatus: 'suspended',
    }).allowed,
    false,
  );

  // Moderator can suspend student accounts, but not staff or profile fields
  assert.equal(
    canManageTargetUserAccount({
      actorRoles: ['moderator'],
      actorInstitutionIds: [],
      targetRoles: ['registered_student'],
      targetInstitutionId: null,
      requestedStatus: 'suspended',
    }).allowed,
    true,
  );

  assert.equal(
    canManageTargetUserAccount({
      actorRoles: ['moderator'],
      actorInstitutionIds: [],
      targetRoles: ['teacher'],
      targetInstitutionId: 5,
      requestedStatus: 'suspended',
    }).allowed,
    false,
  );

  assert.equal(
    canManageTargetUserAccount({
      actorRoles: ['moderator'],
      actorInstitutionIds: [],
      targetRoles: ['registered_student'],
      targetInstitutionId: null,
      requestedFullName: 'Tampered Name',
    }).allowed,
    false,
  );

  // Institutional admin can only manage users within their institution and without higher roles
  assert.equal(
    canManageTargetUserAccount({
      actorRoles: ['institutional_administrator'],
      actorInstitutionIds: [7],
      targetRoles: ['teacher'],
      targetInstitutionId: 7,
      requestedStatus: 'suspended',
    }).allowed,
    true,
  );

  assert.equal(
    canManageTargetUserAccount({
      actorRoles: ['institutional_administrator'],
      actorInstitutionIds: [7],
      targetRoles: ['teacher'],
      targetInstitutionId: 8,
      requestedStatus: 'suspended',
    }).allowed,
    false,
  );

  assert.equal(
    canManageTargetUserAccount({
      actorRoles: ['institutional_administrator'],
      actorInstitutionIds: [7],
      targetRoles: ['examination_manager'],
      targetInstitutionId: 7,
      requestedStatus: 'suspended',
    }).allowed,
    false,
  );
});

