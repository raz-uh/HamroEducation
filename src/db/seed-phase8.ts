import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  contentSources,
  notifications,
  systemSettings,
} from './schema.ts';

let phase8Seeded = false;

export async function ensurePhase8Seeded(): Promise<void> {
  if (phase8Seeded) return;

  // 1. Seed Nepal Verified Content Sources
  await db
    .insert(contentSources)
    .values([
      {
        slug: 'nepal-cdc-sanothimi',
        name: 'Curriculum Development Centre (CDC), Sanothimi',
        authorityType: 'curriculum_board',
        countryCode: 'NP',
        officialUrl: 'https://moecdc.gov.np',
        verificationNotes: 'Official Grades 1–10 national curriculum, textbooks, and SEE specification grid.',
        isTrusted: true,
      },
      {
        slug: 'neb-nepal',
        name: 'National Examinations Board (NEB), Nepal',
        authorityType: 'curriculum_board',
        countryCode: 'NP',
        officialUrl: 'https://neb.gov.np',
        verificationNotes: 'Official SEE (Grade 10) and +2 (Grades 11–12) syllabus, model sets, and board guidelines.',
        isTrusted: true,
      },
      {
        slug: 'tu-ioe',
        name: 'Tribhuvan University — Institute of Engineering (IOE)',
        authorityType: 'entrance_board',
        countryCode: 'NP',
        officialUrl: 'https://entrance.ioe.edu.np',
        verificationNotes: 'Official BE/BArch entrance syllabus, CBT standards, and constituent campus admissions.',
        isTrusted: true,
      },
      {
        slug: 'tu-iost',
        name: 'Tribhuvan University — IOST (BSc CSIT & BIT)',
        authorityType: 'entrance_board',
        countryCode: 'NP',
        officialUrl: 'https://iost.tu.edu.np',
        verificationNotes: 'Official BSc CSIT and BIT entrance curriculum, question blueprints, and seat matrix.',
        isTrusted: true,
      },
      {
        slug: 'mec-nepal',
        name: 'Medical Education Commission (MEC), Nepal',
        authorityType: 'entrance_board',
        countryCode: 'NP',
        officialUrl: 'https://mec.gov.np',
        verificationNotes: 'MECEE-BL national medical & health sciences common entrance syllabus and scholarship rules.',
        isTrusted: true,
      },
      {
        slug: 'tu-fom-cmat',
        name: 'TU Faculty of Management (CMAT)',
        authorityType: 'university',
        countryCode: 'NP',
        officialUrl: 'https://tudoms.org',
        verificationNotes: 'Central Management Admission Test standards for BBA, BBM, BIM, and BHM programs.',
        isTrusted: true,
      },
      {
        slug: 'ku-pu-purbanchal',
        name: 'KU / Pokhara / Purbanchal University Boards',
        authorityType: 'university',
        countryCode: 'NP',
        officialUrl: 'https://ku.edu.np',
        verificationNotes: 'KUCAT, PU, and Purbanchal University academic & fee verification bulletins.',
        isTrusted: true,
      },
      {
        slug: 'hamro-faculty-original',
        name: 'Hamro Education Academic Faculty (Reviewed)',
        authorityType: 'faculty_authored',
        countryCode: 'NP',
        officialUrl: null,
        verificationNotes: 'Original notes, numericals, and practice banks reviewed by Nepal subject educators.',
        isTrusted: true,
      },
    ])
    .onConflictDoNothing({ target: contentSources.slug });

  // 2. Seed Nepal-Scoped System Settings (No multi-country switcher UI)
  await db
    .insert(systemSettings)
    .values([
      {
        settingKey: 'active_country_profile',
        category: 'nepal_scope',
        label: 'Active Platform Country & Calendar',
        valueJson: {
          countryCode: 'NP',
          countryName: 'Nepal',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          academicSessionBs: '2083 B.S.',
        },
        description:
          'Active deployment profile locked to Nepal (CDC, NEB, TU, KU, PU, Purbanchal & MEC standards).',
        countryCode: 'NP',
      },
      {
        settingKey: 'editorial_ai_guardrails',
        category: 'governance',
        label: 'Editorial Review & AI Draft Guardrails',
        valueJson: {
          requireAcademicReviewForAi: true,
          blockDirectAiPublish: true,
          requireSourceOnPublish: true,
          aiRateLimitPer5Min: 15,
        },
        description:
          'Forces AI-generated questions into Draft status and requires Academic Reviewer sign-off + verified source before publishing.',
        countryCode: 'NP',
      },
      {
        settingKey: 'youth_safety_moderation',
        category: 'safety',
        label: 'Youth Safety & Community Guardrails',
        valueJson: {
          autoFilterPiiAndProfanity: true,
          maskStudentSurnamesPublicly: true,
          allowPeerReporting: true,
        },
        description:
          'Protects school & +2 learners by masking surnames, blocking PII/profanity, and logging moderator actions.',
        countryCode: 'NP',
      },
      {
        settingKey: 'registration_and_exams',
        category: 'platform',
        label: 'Student Registration & Exam Defaults',
        valueJson: {
          allowSelfRegistration: true,
          defaultRoleSlug: 'registered_student',
          defaultExamAttemptLimit: 5,
          enforceServerSideExamTimer: true,
        },
        description:
          'Controls public student sign-up role assignment and default server-validated mock exam constraints.',
        countryCode: 'NP',
      },
    ])
    .onConflictDoNothing({ target: systemSettings.settingKey });

  // 3. Seed Initial Nepal Student Announcements if empty
  const existingNotifs = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications);
  if ((existingNotifs[0]?.count ?? 0) === 0) {
    await db.insert(notifications).values([
      {
        audienceRole: 'all_students',
        title: 'SEE 2083 Preparation & Daily 5-Question Challenge Live',
        message:
          'Grade 10 SEE Compulsory Mathematics, Science & Technology, and Optional Mathematics chapter packs and timed mock exams are ready under School Learning & Exams.',
        category: 'exam_alert',
        isPublished: true,
      },
      {
        audienceRole: 'all_students',
        title: 'Bachelor Entrance Mock Tests Updated for IOE, MECEE-BL, BSc CSIT & CMAT',
        message:
          'Practice full negative-marked mock simulations aligned with 2083 B.S. Nepal entrance grids. Review wrong answers inside your Mistake Book.',
        category: 'announcement',
        isPublished: true,
      },
      {
        audienceRole: 'educators',
        title: 'Academic Review Workflow Notice for Faculty & AI Question Drafts',
        message:
          'All AI-assisted and bulk CSV imported questions enter Draft status and require Academic Review approval with a verified Nepal board source before publishing.',
        category: 'review_notice',
        isPublished: true,
      },
    ]);
  }

  // 4. Seed Initial Audit Log entry if empty
  const existingAudits = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs);
  if ((existingAudits[0]?.count ?? 0) === 0) {
    await db.insert(auditLogs).values({
      actorId: null,
      actorEmail: 'system@hamro.edu.np',
      actorRole: 'super_administrator',
      action: 'SYSTEM_GOVERNANCE_INITIALIZED',
      targetEntity: 'system_settings',
      targetId: 'NP',
      summary: 'Initialized Nepal-scoped governance defaults, verified content sources, and 6-stage audit trail.',
      metadata: {
        countryCode: 'NP',
        lifecycleStages: ['Draft', 'Review', 'Correction', 'Approved', 'Published', 'Archived'],
      },
    });
  }

  phase8Seeded = true;
}
