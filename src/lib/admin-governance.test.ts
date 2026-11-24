import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CSV_IMPORT_MAX_CHARS,
  CSV_IMPORT_MAX_DATA_ROWS,
  detectDuplicateQuestions,
  EDITORIAL_LIFECYCLE_STAGES,
  getAllowedAdminModules,
  NEPAL_PLATFORM_DEFAULTS,
  normalizeLifecycleStage,
  parseQuestionImportCsv,
  validateEditorialTransition,
  validateSafeSvgMarkup,
} from './admin-governance.ts';

test('EDITORIAL_LIFECYCLE_STAGES covers all 6 Section 14.3 stages and normalizes legacy values', () => {
  assert.deepEqual(EDITORIAL_LIFECYCLE_STAGES, [
    'Draft',
    'Review',
    'Correction',
    'Approved',
    'Published',
    'Archived',
  ]);
  assert.equal(normalizeLifecycleStage('in_review'), 'Review');
  assert.equal(normalizeLifecycleStage('Academic Review'), 'Review');
  assert.equal(normalizeLifecycleStage('Approval'), 'Approved');
  assert.equal(normalizeLifecycleStage('published'), 'Published');
  assert.equal(normalizeLifecycleStage('Archived'), 'Archived');
});

test('validateEditorialTransition strictly blocks unverified/AI-generated direct publishing', () => {
  // Teacher cannot publish directly
  const teacherPublish = validateEditorialTransition({
    currentStatus: 'Review',
    nextStage: 'Published',
    aiGenerated: false,
    hasVerifiedSource: true,
    userPermissions: ['curriculum:write'],
    userRoles: ['teacher'],
  });
  assert.equal(teacherPublish.allowed, false);

  // Missing verified source blocks publish even for admin
  const noSourcePublish = validateEditorialTransition({
    currentStatus: 'Approved',
    nextStage: 'Published',
    aiGenerated: false,
    hasVerifiedSource: false,
    userPermissions: ['system:admin'],
    userRoles: ['super_administrator'],
  });
  assert.equal(noSourcePublish.allowed, false);

  // AI-generated item cannot skip from Draft straight to Published even for Reviewer
  const aiSkipPublish = validateEditorialTransition({
    currentStatus: 'Draft',
    nextStage: 'Published',
    aiGenerated: true,
    hasVerifiedSource: true,
    userPermissions: ['curriculum:review'],
    userRoles: ['academic_reviewer'],
  });
  assert.equal(aiSkipPublish.allowed, false);

  // AI-generated item CAN move Draft -> Review, then Review -> Approved, then Approved -> Published by Academic Reviewer
  assert.equal(
    validateEditorialTransition({
      currentStatus: 'Draft',
      nextStage: 'Review',
      aiGenerated: true,
      hasVerifiedSource: true,
      userPermissions: ['questions:manage'],
      userRoles: ['question_bank_manager'],
    }).allowed,
    true,
  );
  assert.equal(
    validateEditorialTransition({
      currentStatus: 'Review',
      nextStage: 'Approved',
      aiGenerated: true,
      hasVerifiedSource: true,
      userPermissions: ['curriculum:review'],
      userRoles: ['academic_reviewer'],
    }).allowed,
    true,
  );
  assert.equal(
    validateEditorialTransition({
      currentStatus: 'Approved',
      nextStage: 'Published',
      aiGenerated: true,
      hasVerifiedSource: true,
      userPermissions: ['curriculum:review'],
      userRoles: ['academic_reviewer'],
    }).allowed,
    true,
  );
});

test('parseQuestionImportCsv parses RFC-4180 CSV rows and detectDuplicateQuestions catches DB and intra-batch duplicates', () => {
  const csv = [
    'examination,subject,chapter,topic,question_type,difficulty,prompt,option_a,option_b,option_c,option_d,correct_answer,explanation,marks,negative_marks,source',
    'SEE,Science & Technology,Force & Motion,Gravitation,single_mcq,medium,"What is the SI unit of universal gravitational constant G?","N m^2 kg^-2","N kg^-2","m s^-2","J kg^-1",A,"Derived from F = G m1 m2 / r^2.",1,0,Nepal CDC Grade 10',
    'IOE,Physics,Mechanics,Torque,single_mcq,medium,"What is the SI unit of torque?","N·m","kg/m","W","Pa",A,"Torque equals r x F.",2,0.2,IOE Past Paper',
    'SEE,Science & Technology,Force & Motion,Gravitation,single_mcq,medium,"what is the si unit of universal gravitational constant g","N m^2 kg^-2","N kg^-2","m s^-2","J kg^-1",A,"Duplicate inside CSV",1,0,Nepal CDC Grade 10',
    'MECEE-BL,Chemistry,Solutions,Molarity,numerical,hard,"Calculate molarity when 1 mole NaCl is dissolved in 0.5 L solution.",,,,,2,"M = moles / liters = 1 / 0.5 = 2 M.",1,0.25,MECEE-BL Model',
  ].join('\n');

  const parsed = parseQuestionImportCsv(csv);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.validRows.length, 4);
  assert.equal(parsed.validRows[3].questionType, 'numerical');
  assert.equal(parsed.validRows[3].correctAnswer.numericValue, 2);

  const deduped = detectDuplicateQuestions(parsed.validRows, [
    'What is the SI unit of torque?',
  ]);
  assert.equal(deduped.uniqueRows.length, 2);
  assert.equal(deduped.duplicates.length, 2);
  assert.match(deduped.duplicates[0].reason, /existing question/i);
  assert.match(deduped.duplicates[1].reason, /inside this CSV/i);
});

test('getAllowedAdminModules enforces strict RBAC module visibility across roles and Nepal defaults', () => {
  assert.deepEqual(getAllowedAdminModules(['curriculum:read'], ['registered_student']), []);
  assert.deepEqual(getAllowedAdminModules(['curriculum:read'], ['guest']), []);

  const moderatorMods = getAllowedAdminModules(['moderation:act', 'users:read'], ['moderator']);
  assert.equal(moderatorMods.includes('moderation'), true);
  assert.equal(moderatorMods.includes('settings'), false);
  assert.equal(moderatorMods.includes('roles'), false);

  const examMgrMods = getAllowedAdminModules(['exams:manage', 'questions:manage'], ['examination_manager']);
  assert.equal(examMgrMods.includes('exams'), true);
  assert.equal(examMgrMods.includes('users'), false);

  const superAdminMods = getAllowedAdminModules(['system:admin'], ['super_administrator']);
  assert.equal(superAdminMods.length, 14);
  assert.equal(NEPAL_PLATFORM_DEFAULTS.countryCode, 'NP');
  assert.equal(NEPAL_PLATFORM_DEFAULTS.timezone, 'Asia/Kathmandu');
});

test('parseQuestionImportCsv enforces row/byte limits and strict true_false answers', () => {
  const header =
    'examination,subject,chapter,topic,question_type,difficulty,prompt,option_a,option_b,option_c,option_d,correct_answer,explanation,marks,negative_marks,source';

  // Exceeds CSV_IMPORT_MAX_DATA_ROWS
  const tooManyRows = [
    header,
    ...Array.from({ length: CSV_IMPORT_MAX_DATA_ROWS + 1 }, (_, i) =>
      `SEE,Science,Physics,Motion,true_false,easy,"Statement number ${i + 1} is valid.",,,,,true,Verified,1,0,Nepal CDC`,
    ),
  ].join('\n');
  const rowLimitRes = parseQuestionImportCsv(tooManyRows);
  assert.equal(rowLimitRes.validRows.length, 0);
  assert.match(rowLimitRes.errors[0].message, /maximum/i);

  // Exceeds CSV_IMPORT_MAX_CHARS
  const oversizedRes = parseQuestionImportCsv('x'.repeat(CSV_IMPORT_MAX_CHARS + 10));
  assert.equal(oversizedRes.validRows.length, 0);
  assert.match(oversizedRes.errors[0].message, /limit/i);

  // Invalid boolean value in true_false row is rejected instead of silently treated as false
  const badBoolCsv = [
    header,
    'SEE,Science,Physics,Motion,true_false,easy,"Earth orbits the Sun.",,,,,maybe,Verified,1,0,Nepal CDC',
  ].join('\n');
  const badBoolRes = parseQuestionImportCsv(badBoolCsv);
  assert.equal(badBoolRes.validRows.length, 0);
  assert.equal(badBoolRes.errors.length, 1);
  assert.match(badBoolRes.errors[0].message, /true\/false/i);
});

test('validateSafeSvgMarkup blocks script, foreignObject, and event handlers while allowing clean SVG', () => {
  assert.equal(
    validateSafeSvgMarkup('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" /></svg>').valid,
    true,
  );
  assert.equal(
    validateSafeSvgMarkup('<svg><script>alert(1)</script></svg>').valid,
    false,
  );
  assert.equal(
    validateSafeSvgMarkup('<svg onload="alert(1)"><rect width="10" height="10" /></svg>').valid,
    false,
  );
  assert.equal(
    validateSafeSvgMarkup('<svg><foreignObject><div>xss</div></foreignObject></svg>').valid,
    false,
  );
  assert.equal(
    validateSafeSvgMarkup('<svg><a href="javascript:alert(1)">click</a></svg>').valid,
    false,
  );
});

