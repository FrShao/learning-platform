import { describe, expect, it } from 'vitest';

import type { FormSpec } from '../content/types.js';

import { gradeForm, gradeFormOrThrow } from './grade-form.js';

const mixedForm: FormSpec = {
  title: 'Checkpoint',
  questions: [
    {
      id: 'q1',
      type: 'boolean',
      prompt: 'True?',
      correct: true,
    },
    {
      id: 'q2',
      type: 'number',
      prompt: 'Answer',
      correct: 10,
      tolerance: 0.5,
    },
    {
      id: 'q3',
      type: 'long_text',
      prompt: 'Explain',
    },
  ],
};

describe('gradeForm', () => {
  it('returns score and passed for all_correct when every auto-gradable answer is correct and no pending', () => {
    const form: FormSpec = {
      questions: [
        {
          id: 'a',
          type: 'single_select',
          prompt: 'Pick',
          options: [
            { id: 'x', label: 'X' },
            { id: 'y', label: 'Y' },
          ],
          correctOptionId: 'y',
        },
        {
          id: 'b',
          type: 'multi_select',
          prompt: 'Pick many',
          options: [
            { id: '1', label: '1' },
            { id: '2', label: '2' },
            { id: '3', label: '3' },
          ],
          correctOptionIds: ['1', '3'],
        },
      ],
    };

    const outcome = gradeForm(form, [
      { questionId: 'a', type: 'single_select', optionId: 'y' },
      { questionId: 'b', type: 'multi_select', optionIds: ['3', '1'] },
    ]);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.score).toBe(1);
    expect(outcome.result.passed).toBe(true);
    expect(outcome.result.grades).toHaveLength(2);
  });

  it('keeps passed null when long_text is pending and auto portion would pass', () => {
    const outcome = gradeForm(mixedForm, [
      { questionId: 'q1', type: 'boolean', value: true },
      { questionId: 'q2', type: 'number', value: 10.2 },
      { questionId: 'q3', type: 'long_text', value: 'Because…' },
    ]);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.score).toBe(1);
    expect(outcome.result.passed).toBeNull();
    expect(outcome.result.grades.find((g) => g.questionId === 'q3')?.status).toBe('pending');
  });

  it('returns passed false immediately when auto-gradable portion fails despite pending long_text', () => {
    const outcome = gradeForm(mixedForm, [
      { questionId: 'q1', type: 'boolean', value: false },
      { questionId: 'q2', type: 'number', value: 10 },
      { questionId: 'q3', type: 'long_text', value: '…' },
    ]);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.score).toBe(0.5);
    expect(outcome.result.passed).toBe(false);
  });

  it('applies min_score pass rule over auto-gradable fraction', () => {
    const form: FormSpec = {
      passRule: { mode: 'min_score', min: 0.5 },
      questions: [
        { id: 'n1', type: 'number', prompt: '1', correct: 1 },
        { id: 'n2', type: 'number', prompt: '2', correct: 2 },
        { id: 'n3', type: 'number', prompt: '3', correct: 3 },
        { id: 'essay', type: 'long_text', prompt: 'essay' },
      ],
    };

    const passAuto = gradeForm(form, [
      { questionId: 'n1', type: 'number', value: 1 },
      { questionId: 'n2', type: 'number', value: 2 },
      { questionId: 'n3', type: 'number', value: 0 },
      { questionId: 'essay', type: 'long_text', value: 'text' },
    ]);
    expect(passAuto.ok).toBe(true);
    if (!passAuto.ok) return;
    expect(passAuto.result.score).toBeCloseTo(2 / 3, 10);
    expect(passAuto.result.passed).toBeNull();

    const failAuto = gradeForm(form, [
      { questionId: 'n1', type: 'number', value: 1 },
      { questionId: 'n2', type: 'number', value: 0 },
      { questionId: 'n3', type: 'number', value: 0 },
      { questionId: 'essay', type: 'long_text', value: 'text' },
    ]);
    expect(failAuto.ok).toBe(true);
    if (!failAuto.ok) return;
    expect(failAuto.result.score).toBeCloseTo(1 / 3, 10);
    expect(failAuto.result.passed).toBe(false);
  });

  it('ignores unscored short_text in score and pass evaluation', () => {
    const form: FormSpec = {
      questions: [
        { id: 'scored', type: 'boolean', prompt: '?', correct: true },
        { id: 'free', type: 'short_text', prompt: 'notes' },
      ],
    };

    const outcome = gradeForm(form, [
      { questionId: 'scored', type: 'boolean', value: true },
      { questionId: 'free', type: 'short_text', value: 'hello' },
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.score).toBe(1);
    expect(outcome.result.passed).toBe(true);
    expect(outcome.result.grades.find((g) => g.questionId === 'free')?.status).toBe('ungraded');
  });

  it('rejects invalid forms and unknown answer question ids', () => {
    const bad = gradeForm({ questions: [] }, []);
    expect(bad.ok).toBe(false);

    const unknown = gradeForm(
      {
        questions: [{ id: 'only', type: 'boolean', prompt: '?', correct: true }],
      },
      [{ questionId: 'missing', type: 'boolean', value: true }],
    );
    expect(unknown.ok).toBe(false);
  });

  it('gradeFormOrThrow returns the result or throws', () => {
    const result = gradeFormOrThrow(
      {
        questions: [{ id: 'b', type: 'boolean', prompt: '?', correct: false }],
      },
      [{ questionId: 'b', type: 'boolean', value: false }],
    );
    expect(result.passed).toBe(true);

    expect(() => gradeFormOrThrow({ questions: [] }, [])).toThrow(/invalid/i);
  });
});
