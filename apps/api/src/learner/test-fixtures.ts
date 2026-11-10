import type { CoursePublishedReader, MembershipRecord, OrgMembershipReader } from './ports.js';
import { DEFAULT_ORG_SETTINGS } from './ports.js';
import type {
  CourseSummary,
  CourseTree,
  FormSpec,
  OrgSettings,
  PublishedCourseView,
  UserId,
} from './types.js';

export const ORG_ID = '11111111-1111-4111-8111-111111111111';
export const COURSE_ID = '22222222-2222-4222-8222-222222222222';
export const COMMIT_ID = '33333333-3333-4333-8333-333333333333';
export const USER_ID = '44444444-4444-4444-8444-444444444444';
export const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';

export const SEC_INTRO = 'sec_intro';
export const SEC_QUIZ = 'sec_quiz';
export const SEC_FINAL = 'sec_final';
export const FORM_QUIZ = 'blk_form_quiz';
export const FORM_FINAL = 'blk_form_final';

export function sampleForm(overrides?: Partial<FormSpec>): FormSpec {
  return {
    title: 'Check understanding',
    passRule: { mode: 'all_correct' },
    questions: [
      {
        id: 'q_bool',
        type: 'boolean',
        prompt: 'Is 2+2=4?',
        correct: true,
      },
      {
        id: 'q_num',
        type: 'number',
        prompt: 'Answer',
        correct: 10,
        tolerance: 0.5,
      },
      {
        id: 'q_single',
        type: 'single_select',
        prompt: 'Pick one',
        options: [
          { id: 'o1', label: 'A' },
          { id: 'o2', label: 'B' },
        ],
        correctOptionId: 'o2',
      },
      {
        id: 'q_multi',
        type: 'multi_select',
        prompt: 'Pick all',
        options: [
          { id: 'm1', label: 'X' },
          { id: 'm2', label: 'Y' },
          { id: 'm3', label: 'Z' },
        ],
        correctOptionIds: ['m1', 'm3'],
      },
      {
        id: 'q_short',
        type: 'short_text',
        prompt: 'Capital',
        expected: 'Paris',
        caseSensitive: false,
      },
    ],
    ...overrides,
  };
}

export function sampleTree(): CourseTree {
  return {
    sections: [
      {
        id: SEC_INTRO,
        slug: 'intro',
        title: 'Introduction',
        order: 0,
        blocks: [{ id: 'blk_text', type: 'text', markdown: 'Welcome' }],
      },
      {
        id: SEC_QUIZ,
        slug: 'quiz',
        title: 'Quiz',
        order: 1,
        blocks: [{ id: FORM_QUIZ, type: 'form', form: sampleForm() }],
      },
      {
        id: SEC_FINAL,
        slug: 'final',
        title: 'Final',
        order: 2,
        blocks: [
          {
            id: FORM_FINAL,
            type: 'form',
            form: {
              questions: [
                {
                  id: 'q_long',
                  type: 'long_text',
                  prompt: 'Explain',
                  rubric: 'Clear explanation',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function correctQuizAnswers() {
  return [
    { questionId: 'q_bool', type: 'boolean' as const, value: true },
    { questionId: 'q_num', type: 'number' as const, value: 10.2 },
    { questionId: 'q_single', type: 'single_select' as const, optionId: 'o2' },
    { questionId: 'q_multi', type: 'multi_select' as const, optionIds: ['m3', 'm1'] },
    { questionId: 'q_short', type: 'short_text' as const, value: 'paris' },
  ];
}

export function wrongQuizAnswers() {
  return [
    { questionId: 'q_bool', type: 'boolean' as const, value: false },
    { questionId: 'q_num', type: 'number' as const, value: 99 },
    { questionId: 'q_single', type: 'single_select' as const, optionId: 'o1' },
    { questionId: 'q_multi', type: 'multi_select' as const, optionIds: ['m1'] },
    { questionId: 'q_short', type: 'short_text' as const, value: 'London' },
  ];
}

export function createFixturePorts(options?: {
  settings?: OrgSettings;
  members?: MembershipRecord[];
  publishedCommitId?: string | null;
  tree?: CourseTree;
}): {
  courses: CoursePublishedReader;
  memberships: OrgMembershipReader;
  course: CourseSummary;
  published: PublishedCourseView | null;
} {
  const tree = options?.tree ?? sampleTree();
  const publishedCommitId =
    options?.publishedCommitId === undefined ? COMMIT_ID : options.publishedCommitId;

  const course: CourseSummary = {
    id: COURSE_ID,
    orgId: ORG_ID,
    slug: 'demo',
    title: 'Demo Course',
    publishedCommitId,
    deletedAt: null,
  };

  const published: PublishedCourseView | null =
    publishedCommitId === null
      ? null
      : {
          courseId: COURSE_ID,
          orgId: ORG_ID,
          title: course.title,
          slug: course.slug,
          publishedCommitId,
          tree,
        };

  const members = options?.members ?? [
    { orgId: ORG_ID, userId: USER_ID, role: 'learner' as const },
  ];

  const courses: CoursePublishedReader = {
    async getCourse(id) {
      return id === COURSE_ID ? course : null;
    },
    async getPublished(id) {
      return id === COURSE_ID ? published : null;
    },
  };

  const memberships: OrgMembershipReader = {
    async getMembership(orgId, userId) {
      return members.find((m) => m.orgId === orgId && m.userId === userId) ?? null;
    },
    async getOrgSettings() {
      return options?.settings ?? DEFAULT_ORG_SETTINGS;
    },
  };

  return { courses, memberships, course, published };
}

export function actor(userId: UserId = USER_ID) {
  return { kind: 'user' as const, userId };
}
