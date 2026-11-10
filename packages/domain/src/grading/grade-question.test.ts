import { describe, expect, it } from 'vitest';

import type {
  BooleanQuestion,
  LongTextQuestion,
  MultiSelectQuestion,
  NumberQuestion,
  ShortTextQuestion,
  SingleSelectQuestion,
} from '../content/types.js';

import { gradeQuestion } from './grade-question.js';

const shortText: ShortTextQuestion = {
  id: 'q_short',
  type: 'short_text',
  prompt: 'Capital of France?',
  expected: 'Paris',
};

const shortTextCase: ShortTextQuestion = {
  id: 'q_short_cs',
  type: 'short_text',
  prompt: 'Case sensitive token',
  expected: 'AbC',
  caseSensitive: true,
};

const shortTextUnscored: ShortTextQuestion = {
  id: 'q_short_free',
  type: 'short_text',
  prompt: 'Your thoughts?',
};

const longText: LongTextQuestion = {
  id: 'q_long',
  type: 'long_text',
  prompt: 'Explain photosynthesis',
  rubric: 'Mention light and chlorophyll',
};

const singleSelect: SingleSelectQuestion = {
  id: 'q_single',
  type: 'single_select',
  prompt: 'Pick one',
  options: [
    { id: 'o1', label: 'A' },
    { id: 'o2', label: 'B' },
  ],
  correctOptionId: 'o2',
};

const multiSelect: MultiSelectQuestion = {
  id: 'q_multi',
  type: 'multi_select',
  prompt: 'Pick all that apply',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  correctOptionIds: ['a', 'c'],
};

const booleanQ: BooleanQuestion = {
  id: 'q_bool',
  type: 'boolean',
  prompt: 'Is the sky blue?',
  correct: true,
};

const numberQ: NumberQuestion = {
  id: 'q_num',
  type: 'number',
  prompt: '2 + 2',
  correct: 4,
};

const numberTol: NumberQuestion = {
  id: 'q_num_tol',
  type: 'number',
  prompt: 'pi approx',
  correct: 3.14,
  tolerance: 0.01,
};

describe('gradeQuestion', () => {
  it('grades short_text with case-insensitive exact match and trim', () => {
    expect(
      gradeQuestion(shortText, { questionId: 'q_short', type: 'short_text', value: '  paris ' }),
    ).toEqual({ questionId: 'q_short', status: 'correct', points: 1 });
    expect(
      gradeQuestion(shortText, { questionId: 'q_short', type: 'short_text', value: 'London' }),
    ).toEqual({ questionId: 'q_short', status: 'incorrect', points: 0 });
  });

  it('respects caseSensitive short_text', () => {
    expect(
      gradeQuestion(shortTextCase, {
        questionId: 'q_short_cs',
        type: 'short_text',
        value: 'AbC',
      }),
    ).toEqual({ questionId: 'q_short_cs', status: 'correct', points: 1 });
    expect(
      gradeQuestion(shortTextCase, {
        questionId: 'q_short_cs',
        type: 'short_text',
        value: 'abc',
      }),
    ).toEqual({ questionId: 'q_short_cs', status: 'incorrect', points: 0 });
  });

  it('marks short_text without expected as ungraded', () => {
    expect(
      gradeQuestion(shortTextUnscored, {
        questionId: 'q_short_free',
        type: 'short_text',
        value: 'anything',
      }),
    ).toEqual({ questionId: 'q_short_free', status: 'ungraded' });
  });

  it('marks long_text as pending', () => {
    expect(
      gradeQuestion(longText, {
        questionId: 'q_long',
        type: 'long_text',
        value: 'Light energy…',
      }),
    ).toEqual({ questionId: 'q_long', status: 'pending' });
  });

  it('grades single_select by option id', () => {
    expect(
      gradeQuestion(singleSelect, {
        questionId: 'q_single',
        type: 'single_select',
        optionId: 'o2',
      }),
    ).toEqual({ questionId: 'q_single', status: 'correct', points: 1 });
    expect(
      gradeQuestion(singleSelect, {
        questionId: 'q_single',
        type: 'single_select',
        optionId: 'o1',
      }),
    ).toEqual({ questionId: 'q_single', status: 'incorrect', points: 0 });
  });

  it('grades multi_select with set equality (order independent)', () => {
    expect(
      gradeQuestion(multiSelect, {
        questionId: 'q_multi',
        type: 'multi_select',
        optionIds: ['c', 'a'],
      }),
    ).toEqual({ questionId: 'q_multi', status: 'correct', points: 1 });
    expect(
      gradeQuestion(multiSelect, {
        questionId: 'q_multi',
        type: 'multi_select',
        optionIds: ['a'],
      }),
    ).toEqual({ questionId: 'q_multi', status: 'incorrect', points: 0 });
    expect(
      gradeQuestion(multiSelect, {
        questionId: 'q_multi',
        type: 'multi_select',
        optionIds: ['a', 'b', 'c'],
      }),
    ).toEqual({ questionId: 'q_multi', status: 'incorrect', points: 0 });
  });

  it('grades boolean and number with optional tolerance', () => {
    expect(gradeQuestion(booleanQ, { questionId: 'q_bool', type: 'boolean', value: true })).toEqual(
      { questionId: 'q_bool', status: 'correct', points: 1 },
    );
    expect(
      gradeQuestion(booleanQ, { questionId: 'q_bool', type: 'boolean', value: false }),
    ).toEqual({ questionId: 'q_bool', status: 'incorrect', points: 0 });

    expect(gradeQuestion(numberQ, { questionId: 'q_num', type: 'number', value: 4 })).toEqual({
      questionId: 'q_num',
      status: 'correct',
      points: 1,
    });
    expect(gradeQuestion(numberQ, { questionId: 'q_num', type: 'number', value: 4.1 })).toEqual({
      questionId: 'q_num',
      status: 'incorrect',
      points: 0,
    });
    expect(
      gradeQuestion(numberTol, { questionId: 'q_num_tol', type: 'number', value: 3.145 }),
    ).toEqual({ questionId: 'q_num_tol', status: 'correct', points: 1 });
    expect(
      gradeQuestion(numberTol, { questionId: 'q_num_tol', type: 'number', value: 3.2 }),
    ).toEqual({ questionId: 'q_num_tol', status: 'incorrect', points: 0 });
  });

  it('treats missing or type-mismatched answers as incorrect for auto-gradable questions', () => {
    expect(gradeQuestion(numberQ, undefined)).toEqual({
      questionId: 'q_num',
      status: 'incorrect',
      points: 0,
    });
    expect(gradeQuestion(numberQ, { questionId: 'q_num', type: 'short_text', value: '4' })).toEqual(
      { questionId: 'q_num', status: 'incorrect', points: 0 },
    );
  });
});
