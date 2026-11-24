import { asc, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  discussionComments,
  discussionGroups,
  discussionPosts,
  users,
} from './schema.ts';

export async function ensurePhase7Seeded(): Promise<void> {
  const existingGroups = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(discussionGroups);

  if ((existingGroups[0]?.count ?? 0) === 0) {
    await db
      .insert(discussionGroups)
      .values([
        {
          slug: 'class-10-see-board',
          name: 'Class 10 / SEE Board Prep',
          groupType: 'class',
          academicLevel: 'Class 10 / SEE',
          subjectName: 'All SEE Subjects',
          description:
            'Peer study doubts, CDC chapter clarifications, and past-paper strategies for SEE candidates across all 7 provinces.',
          memberCount: 1420,
          isModerated: true,
        },
        {
          slug: 'class-11-neb-foundation',
          name: 'Class 11 NEB Foundation',
          groupType: 'class',
          academicLevel: 'Class 11',
          subjectName: 'Science & Management',
          description:
            'Transition discussions from SEE to +2 Science, Management, Humanities, and Education.',
          memberCount: 980,
          isModerated: true,
        },
        {
          slug: 'class-12-neb-board',
          name: 'Class 12 NEB Final Board',
          groupType: 'class',
          academicLevel: 'Class 12',
          subjectName: 'NEB Board & Practicals',
          description:
            'Final board numerical solving, viva guidelines, and bachelor transition planning.',
          memberCount: 1640,
          isModerated: true,
        },
        {
          slug: 'subject-physics-numericals',
          name: 'Physics & Numericals Board',
          groupType: 'subject',
          academicLevel: 'Class 11–12 & Entrance',
          subjectName: 'Physics',
          description:
            'Mechanics, Optics, Electromagnetism, and Modern Physics derivation and step-by-step problem help.',
          memberCount: 1150,
          isModerated: true,
        },
        {
          slug: 'subject-mathematics-calculus',
          name: 'Mathematics & Calculus Hub',
          groupType: 'subject',
          academicLevel: 'SEE to Bachelor Entrance',
          subjectName: 'Mathematics',
          description:
            'Algebra, Trigonometry, Coordinate Geometry, Derivatives, and Vectors problem solving.',
          memberCount: 1290,
          isModerated: true,
        },
        {
          slug: 'subject-chemistry-biology',
          name: 'Chemistry & Biology Forum',
          groupType: 'subject',
          academicLevel: 'Class 11–12 & MECEE-BL',
          subjectName: 'Chemistry & Biology',
          description:
            'Organic mechanisms, stoichiometry, human physiology, and botanical taxonomy discussions.',
          memberCount: 870,
          isModerated: true,
        },
        {
          slug: 'subject-accountancy-economics',
          name: 'Accountancy & Economics Circle',
          groupType: 'subject',
          academicLevel: 'SEE, +2 Management & CMAT',
          subjectName: 'Accountancy & Economics',
          description:
            'Final accounts, company shares, financial ratios, and macroeconomics discussions.',
          memberCount: 740,
          isModerated: true,
        },
        {
          slug: 'entrance-ioe-engineering',
          name: 'IOE Engineering Entrance Prep',
          groupType: 'entrance',
          academicLevel: 'Bachelor Entrance',
          subjectName: 'IOE / KUCAT-CBT',
          description:
            '140-mark CBT strategy, Pulchowk/Thapathali/WRC cutoff trends, and rapid PCM problem solving.',
          memberCount: 1380,
          isModerated: true,
        },
        {
          slug: 'entrance-mecee-medical',
          name: 'MECEE-BL Medical & Health Prep',
          groupType: 'entrance',
          academicLevel: 'Bachelor Entrance',
          subjectName: 'MECEE-BL',
          description:
            '200-MCQ pace management, negative marking avoidance, and MEC 75% public scholarship guidance.',
          memberCount: 1090,
          isModerated: true,
        },
        {
          slug: 'entrance-it-management',
          name: 'BSc CSIT, BIT & CMAT Group',
          groupType: 'entrance',
          academicLevel: 'Bachelor Entrance',
          subjectName: 'IT & Management Entrances',
          description:
            'TU IOST BSc CSIT/BIT, FOHSS BCA, and TU CMAT quantitative/verbal reasoning study circle.',
          memberCount: 1120,
          isModerated: true,
        },
      ])
      .onConflictDoNothing({ target: discussionGroups.slug });
  }

  const existingPosts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(discussionPosts);

  if ((existingPosts[0]?.count ?? 0) === 0) {
    const firstUsers = await db.select().from(users).orderBy(asc(users.id)).limit(1);
    const seedAuthor = firstUsers[0];
    if (!seedAuthor) {
      return;
    }

    const groups = await db.select().from(discussionGroups);
    const groupBySlug = new Map(groups.map((g) => [g.slug, g]));

    const physicsGroup = groupBySlug.get('subject-physics-numericals');
    const seeGroup = groupBySlug.get('class-10-see-board');
    const ioeGroup = groupBySlug.get('entrance-ioe-engineering');
    const csitGroup = groupBySlug.get('entrance-it-management');

    if (!physicsGroup || !seeGroup || !ioeGroup || !csitGroup) {
      return;
    }

    const insertedPosts = await db
      .insert(discussionPosts)
      .values([
        {
          groupId: physicsGroup.id,
          authorId: seedAuthor.id,
          title: 'How do we find the direction of torque vs angular momentum in rotational dynamics?',
          body: 'In NEB Class 12 Physics Chapter 1, I keep confusing when angular momentum is conserved during a figure skater spinning. Can someone break down τ = dL/dt with units?',
          postType: 'question',
          tags: ['Class 12', 'Physics', 'Rotational Dynamics'],
          upvoteCount: 14,
          commentCount: 1,
          isAnswered: true,
          hasTeacherVerified: true,
          moderationStatus: 'active',
        },
        {
          groupId: seeGroup.id,
          authorId: seedAuthor.id,
          title: 'Compound Interest half-yearly vs quarterly formula shortcut for SEE Maths',
          body: 'What is the cleanest way to remember R/2 and 2T for semi-annual compounding without making exponent errors in 4-mark CDC numericals?',
          postType: 'question',
          tags: ['SEE', 'Compulsory Math', 'Compound Interest'],
          upvoteCount: 19,
          commentCount: 1,
          isAnswered: true,
          hasTeacherVerified: true,
          moderationStatus: 'active',
        },
        {
          groupId: ioeGroup.id,
          authorId: seedAuthor.id,
          title: 'When is guessing worth the 10% negative marking in IOE CBT?',
          body: 'For 2-mark Physics numericals with 4 choices, if I can eliminate 2 options, does expected value become positive?',
          postType: 'question',
          tags: ['IOE', 'Strategy', 'Negative Marking'],
          upvoteCount: 9,
          commentCount: 0,
          isAnswered: false,
          hasTeacherVerified: false,
          moderationStatus: 'active',
        },
        {
          groupId: csitGroup.id,
          authorId: seedAuthor.id,
          title: 'BSc CSIT vs BIT eligibility difference for +2 Biology stream students',
          body: 'If a Class 12 student took Biology instead of 100-mark Mathematics, can they still appear in TU IOST BSc CSIT entrance?',
          postType: 'question',
          tags: ['BSc CSIT', 'BIT', 'Eligibility'],
          upvoteCount: 11,
          commentCount: 0,
          isAnswered: false,
          hasTeacherVerified: false,
          moderationStatus: 'active',
        },
      ])
      .returning();

    const p1 = insertedPosts[0];
    const p2 = insertedPosts[1];

    if (p1 && p2) {
      await db.insert(discussionComments).values([
        {
          postId: p1.id,
          authorId: seedAuthor.id,
          body: 'Use the right-hand curl rule from position vector r to force F for torque τ = r × F. Because τ = dL/dt, when net external torque is zero (τ_ext = 0), angular momentum L = Iω remains constant—so decreasing moment of inertia I increases angular speed ω.',
          isTeacherVerified: true,
          verifiedById: seedAuthor.id,
          verifiedByName: 'Academic Review Faculty',
          verifiedAt: new Date(),
          upvoteCount: 12,
          moderationStatus: 'active',
        },
        {
          postId: p2.id,
          authorId: seedAuthor.id,
          body: 'Think of periods per year (n): for semi-annual n = 2, so divide annual rate R by 2 and multiply years T by 2: A = P(1 + R/200)^(2T). For quarterly n = 4: A = P(1 + R/400)^(4T). Always verify the time unit is in years before substituting.',
          isTeacherVerified: true,
          verifiedById: seedAuthor.id,
          verifiedByName: 'SEE Mathematics Faculty',
          verifiedAt: new Date(),
          upvoteCount: 16,
          moderationStatus: 'active',
        },
      ]);
    }
  }
}
