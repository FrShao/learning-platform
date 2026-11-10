import { describe, expect, it } from 'vitest';

import { LearnerError } from './errors.js';
import { LearnerService } from './service.js';
import { MemoryLearnerStore } from './store.js';
import {
  COURSE_ID,
  FORM_FINAL,
  FORM_QUIZ,
  OTHER_USER_ID,
  ORG_ID,
  SEC_FINAL,
  SEC_INTRO,
  SEC_QUIZ,
  USER_ID,
  actor,
  correctQuizAnswers,
  createFixturePorts,
  wrongQuizAnswers,
} from './test-fixtures.js';

function buildService(
  ports = createFixturePorts(),
  store = new MemoryLearnerStore(),
): LearnerService {
  return new LearnerService({
    store,
    courses: ports.courses,
    memberships: ports.memberships,
    clock: () => new Date('2026-11-10T12:00:00.000Z'),
  });
}

describe('learner enrollment and published read', () => {
  it('enrolls a member against the published commit and seeds progress', async () => {
    const service = buildService();
    const result = await service.enroll(actor(), COURSE_ID);

    expect(result.enrollment.courseId).toBe(COURSE_ID);
    expect(result.enrollment.userId).toBe(USER_ID);
    expect(result.enrollment.orgId).toBe(ORG_ID);
    expect(result.progress.percent).toBe(0);
    expect(result.progress.currentSectionId).toBe(SEC_INTRO);
    expect(result.progress.completedSectionIds).toEqual([]);
  });

  it('rejects enroll when the course is unpublished', async () => {
    const service = buildService(createFixturePorts({ publishedCommitId: null }));
    await expect(service.enroll(actor(), COURSE_ID)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('rejects enroll for non-members', async () => {
    const service = buildService(createFixturePorts({ members: [] }));
    await expect(service.enroll(actor(), COURSE_ID)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('returns the published tree only', async () => {
    const service = buildService();
    const published = await service.getPublished(actor(), COURSE_ID);
    expect(published.tree.sections).toHaveLength(3);
    expect(published.publishedCommitId).toBeTruthy();
  });

  it('conflicts on duplicate enroll', async () => {
    const service = buildService();
    await service.enroll(actor(), COURSE_ID);
    await expect(service.enroll(actor(), COURSE_ID)).rejects.toMatchObject({
      code: 'conflict',
    });
  });
});

describe('progression and form attempt flows', () => {
  it('completes a form-free section, then requires a passing form attempt', async () => {
    const service = buildService();
    const { enrollment } = await service.enroll(actor(), COURSE_ID);

    const afterIntro = await service.completeSection(actor(), enrollment.id, SEC_INTRO);
    expect(afterIntro.completedSectionIds).toEqual([SEC_INTRO]);
    expect(afterIntro.percent).toBe(33);
    expect(afterIntro.currentSectionId).toBe(SEC_QUIZ);

    await expect(service.completeSection(actor(), enrollment.id, SEC_QUIZ)).rejects.toMatchObject({
      code: 'conflict',
    });

    const failing = await service.submitFormAttempt(
      actor(),
      enrollment.id,
      FORM_QUIZ,
      wrongQuizAnswers(),
    );
    expect(failing.passed).toBe(false);

    await expect(service.completeSection(actor(), enrollment.id, SEC_QUIZ)).rejects.toMatchObject({
      code: 'conflict',
    });

    const passing = await service.submitFormAttempt(
      actor(),
      enrollment.id,
      FORM_QUIZ,
      correctQuizAnswers(),
    );
    expect(passing.passed).toBe(true);

    const afterQuiz = await service.completeSection(actor(), enrollment.id, SEC_QUIZ);
    expect(afterQuiz.completedSectionIds).toEqual([SEC_INTRO, SEC_QUIZ]);
    expect(afterQuiz.percent).toBe(67);
    expect(afterQuiz.currentSectionId).toBe(SEC_FINAL);
  });

  it('blocks attempts and completion on locked later sections', async () => {
    const service = buildService();
    const { enrollment } = await service.enroll(actor(), COURSE_ID);

    await expect(
      service.submitFormAttempt(actor(), enrollment.id, FORM_QUIZ, correctQuizAnswers()),
    ).rejects.toMatchObject({ code: 'forbidden' });

    await expect(service.completeSection(actor(), enrollment.id, SEC_QUIZ)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('allows out-of-order access when sequential progress is disabled', async () => {
    const ports = createFixturePorts({
      settings: {
        enforceSequentialProgress: false,
        republishProgressPolicy: 'keep',
      },
    });
    const service = buildService(ports);
    const { enrollment } = await service.enroll(actor(), COURSE_ID);

    const attempt = await service.submitFormAttempt(
      actor(),
      enrollment.id,
      FORM_QUIZ,
      correctQuizAnswers(),
    );
    expect(attempt.passed).toBe(true);
  });

  it('keeps section incomplete while long_text grading is pending', async () => {
    const ports = createFixturePorts({
      settings: {
        enforceSequentialProgress: false,
        republishProgressPolicy: 'keep',
      },
    });
    const service = buildService(ports);
    const { enrollment } = await service.enroll(actor(), COURSE_ID);

    const attempt = await service.submitFormAttempt(actor(), enrollment.id, FORM_FINAL, [
      { questionId: 'q_long', type: 'long_text', value: 'My essay' },
    ]);
    expect(attempt.passed).toBeNull();
    expect(attempt.grades[0]?.status).toBe('pending');

    await expect(service.completeSection(actor(), enrollment.id, SEC_FINAL)).rejects.toBeInstanceOf(
      LearnerError,
    );
  });

  it('forbids reading another user enrollment progress', async () => {
    const ports = createFixturePorts({
      members: [
        { orgId: ORG_ID, userId: USER_ID, role: 'learner' },
        { orgId: ORG_ID, userId: OTHER_USER_ID, role: 'learner' },
      ],
    });
    const service = buildService(ports);
    const { enrollment } = await service.enroll(actor(USER_ID), COURSE_ID);

    await expect(service.getProgress(actor(OTHER_USER_ID), enrollment.id)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('is idempotent when completing an already completed section', async () => {
    const service = buildService();
    const { enrollment } = await service.enroll(actor(), COURSE_ID);
    const first = await service.completeSection(actor(), enrollment.id, SEC_INTRO);
    const second = await service.completeSection(actor(), enrollment.id, SEC_INTRO);
    expect(second.completedSectionIds).toEqual(first.completedSectionIds);
    expect(second.percent).toBe(first.percent);
  });
});
