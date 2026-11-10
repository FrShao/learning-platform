import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  gradeForm,
  validateContentBlock,
  validateFormSpec,
  type AnswerValue,
  type ContentBlock,
  type FormSpec,
  type PassRule,
  type QuestionGradeStatus,
} from '../../packages/domain/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '../fixtures/grading');

function loadJson<T>(name: string): T {
  const raw = readFileSync(join(fixturesDir, name), 'utf8');
  return JSON.parse(raw) as T;
}

type AttemptFixture = {
  id: string;
  description: string;
  passRuleOverride: PassRule | null;
  answers: AnswerValue[];
  expected: {
    score: number | null;
    passed: boolean | null;
    statuses: Record<string, QuestionGradeStatus>;
  };
};

describe('regression: form auto-grading fixtures', () => {
  const baseForm = loadJson<FormSpec>('form-spec-mixed.json');
  const attempts = loadJson<AttemptFixture[]>('attempts.json');

  it('locks the mixed form spec as valid', () => {
    expect(validateFormSpec(baseForm)).toEqual({ ok: true });
  });

  it.each(attempts.map((a) => [a.id, a] as const))(
    'grades attempt %s to the golden result',
    (_id, attempt) => {
      const form: FormSpec =
        attempt.passRuleOverride === null
          ? baseForm
          : { ...baseForm, passRule: attempt.passRuleOverride };

      const outcome = gradeForm(form, attempt.answers);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      if (attempt.expected.score === null) {
        expect(outcome.result.score).toBeNull();
      } else {
        expect(outcome.result.score).toBeCloseTo(attempt.expected.score, 9);
      }
      expect(outcome.result.passed).toBe(attempt.expected.passed);

      const byId = Object.fromEntries(outcome.result.grades.map((g) => [g.questionId, g.status]));
      expect(byId).toEqual(attempt.expected.statuses);
    },
  );
});

describe('regression: content block fixtures', () => {
  it('accepts every locked content block variant', () => {
    const data = loadJson<{ blocks: ContentBlock[] }>('content-blocks.json');
    expect(data.blocks).toHaveLength(5);
    for (const block of data.blocks) {
      expect(validateContentBlock(block)).toEqual({ ok: true });
    }
  });
});
