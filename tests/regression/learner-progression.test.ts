import { describe, expect, it } from 'vitest';

import { LearnerService } from '../../apps/api/src/learner/service.js';
import { MemoryLearnerStore } from '../../apps/api/src/learner/store.js';
import {
  COURSE_ID,
  FORM_QUIZ,
  SEC_INTRO,
  SEC_QUIZ,
  actor,
  correctQuizAnswers,
  createFixturePorts,
} from '../../apps/api/src/learner/test-fixtures.js';

/**
 * Locked progression contract: sequential unlock + form gate before section complete.
 */
describe('learner progression regression', () => {
  it('walks intro → quiz attempt → quiz complete under sequential rules', async () => {
    const service = new LearnerService({
      store: new MemoryLearnerStore(),
      courses: createFixturePorts().courses,
      memberships: createFixturePorts().memberships,
    });

    const { enrollment } = await service.enroll(actor(), COURSE_ID);
    await service.completeSection(actor(), enrollment.id, SEC_INTRO);
    await service.submitFormAttempt(actor(), enrollment.id, FORM_QUIZ, correctQuizAnswers());
    const { progress } = await service.completeSection(actor(), enrollment.id, SEC_QUIZ);

    expect(progress.completedSectionIds).toEqual([SEC_INTRO, SEC_QUIZ]);
    expect(progress.percent).toBe(67);
  });
});
