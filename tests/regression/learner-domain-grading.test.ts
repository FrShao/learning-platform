import { describe, expect, it } from 'vitest';

import { gradeFormAttempt } from '../../apps/api/src/learner/graders.js';
import { LearnerService } from '../../apps/api/src/learner/service.js';
import { MemoryLearnerStore } from '../../apps/api/src/learner/store.js';
import {
  COURSE_ID,
  FORM_QUIZ,
  actor,
  correctQuizAnswers,
  createFixturePorts,
  sampleForm,
} from '../../apps/api/src/learner/test-fixtures.js';

/**
 * Locked contract: learner attempts must grade through `@lp/domain` semantics
 * (trim short_text, fail-fast on auto portion when long_text is pending).
 */
describe('learner domain grading regression', () => {
  it('trims short_text answers when grading through the learner adapter', () => {
    const form = sampleForm({
      questions: [
        {
          id: 'q_short',
          type: 'short_text',
          prompt: 'Capital',
          expected: 'Paris',
          caseSensitive: false,
        },
      ],
    });
    const result = gradeFormAttempt(form, [
      { questionId: 'q_short', type: 'short_text', value: '  PARIS  ' },
    ]);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails the form when auto-gradable answers fail even if long_text is pending', async () => {
    const ports = createFixturePorts({
      settings: {
        enforceSequentialProgress: false,
        republishProgressPolicy: 'keep',
      },
      tree: {
        sections: [
          {
            id: 'sec_mixed',
            slug: 'mixed',
            title: 'Mixed',
            order: 0,
            blocks: [
              {
                id: FORM_QUIZ,
                type: 'form',
                form: {
                  questions: [
                    { id: 'q_bool', type: 'boolean', prompt: 'True?', correct: true },
                    { id: 'q_long', type: 'long_text', prompt: 'Explain' },
                  ],
                },
              },
            ],
          },
        ],
      },
    });

    const service = new LearnerService({
      store: new MemoryLearnerStore(),
      courses: ports.courses,
      memberships: ports.memberships,
    });

    const { enrollment } = await service.enroll(actor(), COURSE_ID);
    const attempt = await service.submitFormAttempt(actor(), enrollment.id, FORM_QUIZ, [
      { questionId: 'q_bool', type: 'boolean', value: false },
      { questionId: 'q_long', type: 'long_text', value: 'essay' },
    ]);

    expect(attempt.passed).toBe(false);
    expect(attempt.grades.find((g) => g.questionId === 'q_long')?.status).toBe('pending');
  });

  it('accepts the sample quiz fixture answers end-to-end', async () => {
    const ports = createFixturePorts({
      settings: {
        enforceSequentialProgress: false,
        republishProgressPolicy: 'keep',
      },
    });
    const service = new LearnerService({
      store: new MemoryLearnerStore(),
      courses: ports.courses,
      memberships: ports.memberships,
    });
    const { enrollment } = await service.enroll(actor(), COURSE_ID);
    const attempt = await service.submitFormAttempt(
      actor(),
      enrollment.id,
      FORM_QUIZ,
      correctQuizAnswers(),
    );
    expect(attempt.passed).toBe(true);
    expect(attempt.score).toBe(1);
  });
});
