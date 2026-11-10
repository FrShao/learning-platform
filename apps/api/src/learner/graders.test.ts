import { describe, expect, it } from 'vitest';

import { gradeFormAttempt } from './graders.js';
import { correctQuizAnswers, sampleForm, wrongQuizAnswers } from './test-fixtures.js';

describe('gradeFormAttempt', () => {
  it('passes all_correct when every auto-gradable answer is right', () => {
    const result = gradeFormAttempt(sampleForm(), correctQuizAnswers());
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.grades.every((g) => g.status === 'correct')).toBe(true);
    expect(result.gradedAt).toBeInstanceOf(Date);
  });

  it('fails all_correct when any answer is wrong', () => {
    const result = gradeFormAttempt(sampleForm(), wrongQuizAnswers());
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('honors min_score pass rule', () => {
    const form = sampleForm({ passRule: { mode: 'min_score', min: 0.2 } });
    const answers = wrongQuizAnswers().map((a, i) =>
      i === 0 ? { questionId: 'q_bool', type: 'boolean' as const, value: true } : a,
    );
    const result = gradeFormAttempt(form, answers);
    expect(result.score).toBe(0.2);
    expect(result.passed).toBe(true);
  });

  it('leaves passed null when long_text is pending', () => {
    const form = sampleForm({
      questions: [
        {
          id: 'q_long',
          type: 'long_text',
          prompt: 'Explain',
        },
        {
          id: 'q_bool',
          type: 'boolean',
          prompt: 'True?',
          correct: true,
        },
      ],
    });
    const result = gradeFormAttempt(form, [
      { questionId: 'q_long', type: 'long_text', value: 'because' },
      { questionId: 'q_bool', type: 'boolean', value: true },
    ]);
    expect(result.grades.find((g) => g.questionId === 'q_long')?.status).toBe('pending');
    expect(result.passed).toBeNull();
    expect(result.gradedAt).toBeNull();
  });

  it('marks short_text without expected as ungraded and blocks pass', () => {
    const form = sampleForm({
      questions: [{ id: 'q1', type: 'short_text', prompt: 'Thoughts?' }],
    });
    const result = gradeFormAttempt(form, [
      { questionId: 'q1', type: 'short_text', value: 'hello' },
    ]);
    expect(result.grades[0]?.status).toBe('ungraded');
    expect(result.passed).toBeNull();
  });

  it('applies number tolerance', () => {
    const form = sampleForm({
      questions: [{ id: 'q_n', type: 'number', prompt: 'n', correct: 5, tolerance: 1 }],
    });
    expect(gradeFormAttempt(form, [{ questionId: 'q_n', type: 'number', value: 5.9 }]).passed).toBe(
      true,
    );
    expect(gradeFormAttempt(form, [{ questionId: 'q_n', type: 'number', value: 7 }]).passed).toBe(
      false,
    );
  });
});
