import { DEFAULT_PASS_RULE, type FormSpec, type PassRule } from '../content/types.js';
import { validateFormSpec } from '../content/validate.js';

import { isAutoGradable } from './auto-gradable.js';
import { gradeQuestion } from './grade-question.js';
import type { AnswerValue, FormGradeResult, GradeFormOutcome, QuestionGrade } from './types.js';

function indexAnswers(answers: AnswerValue[]): Map<string, AnswerValue> | { error: string } {
  const map = new Map<string, AnswerValue>();
  for (let i = 0; i < answers.length; i += 1) {
    const answer = answers[i];
    if (!answer || typeof answer !== 'object') {
      return { error: `answers[${i}] must be an object` };
    }
    if (typeof answer.questionId !== 'string' || answer.questionId.length === 0) {
      return { error: `answers[${i}].questionId is required` };
    }
    if (map.has(answer.questionId)) {
      return { error: `duplicate answer for questionId "${answer.questionId}"` };
    }
    map.set(answer.questionId, answer);
  }
  return map;
}

function resolvePassRule(form: FormSpec): PassRule {
  return form.passRule ?? DEFAULT_PASS_RULE;
}

function evaluatePass(args: {
  passRule: PassRule;
  score: number | null;
  autoGradableCount: number;
  correctCount: number;
  hasPending: boolean;
}): boolean | null {
  const { passRule, score, autoGradableCount, correctCount, hasPending } = args;

  let autoPassed: boolean;
  if (passRule.mode === 'all_correct') {
    autoPassed = autoGradableCount === 0 ? true : correctCount === autoGradableCount;
  } else {
    // min_score: fraction of auto-gradable points. With zero auto-gradable questions,
    // treat as vacuously meeting the rule (score is null).
    if (autoGradableCount === 0) {
      autoPassed = true;
    } else {
      const fraction = score ?? 0;
      autoPassed = fraction + Number.EPSILON >= passRule.min;
    }
  }

  if (!autoPassed) {
    return false;
  }
  if (hasPending) {
    return null;
  }
  return true;
}

/**
 * Auto-grade a form attempt. Validates the form spec, matches answers by question id,
 * scores auto-gradable questions, and evaluates the pass rule.
 *
 * Pending `long_text` grades keep `passed` null when the auto-gradable portion would
 * otherwise pass. A failed auto-gradable portion yields `passed: false` immediately.
 */
export function gradeForm(form: FormSpec, answers: AnswerValue[]): GradeFormOutcome {
  const formValidation = validateFormSpec(form);
  if (!formValidation.ok) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'form spec is invalid',
        details: { issues: formValidation.issues },
      },
    };
  }

  if (!Array.isArray(answers)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'answers must be an array',
        details: { issues: [{ path: 'answers', message: 'answers must be an array' }] },
      },
    };
  }

  const indexed = indexAnswers(answers);
  if ('error' in indexed) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: indexed.error,
        details: { issues: [{ path: 'answers', message: indexed.error }] },
      },
    };
  }

  const knownIds = new Set(form.questions.map((q) => q.id));
  for (const answer of answers) {
    if (!knownIds.has(answer.questionId)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `unknown questionId "${answer.questionId}"`,
          details: {
            issues: [
              {
                path: 'answers',
                message: `unknown questionId "${answer.questionId}"`,
              },
            ],
          },
        },
      };
    }
  }

  const grades: QuestionGrade[] = [];
  let autoGradableCount = 0;
  let correctCount = 0;
  let hasPending = false;

  for (const question of form.questions) {
    const grade = gradeQuestion(question, indexed.get(question.id));
    grades.push(grade);
    if (grade.status === 'pending') {
      hasPending = true;
    }
    if (isAutoGradable(question)) {
      autoGradableCount += 1;
      if (grade.status === 'correct') {
        correctCount += 1;
      }
    }
  }

  const score =
    autoGradableCount === 0 ? null : Number((correctCount / autoGradableCount).toFixed(10));

  const passed = evaluatePass({
    passRule: resolvePassRule(form),
    score,
    autoGradableCount,
    correctCount,
    hasPending,
  });

  const result: FormGradeResult = { grades, score, passed };
  return { ok: true, result };
}

/**
 * Convenience wrapper that throws on validation failure.
 * Prefer {@link gradeForm} at service boundaries.
 */
export function gradeFormOrThrow(form: FormSpec, answers: AnswerValue[]): FormGradeResult {
  const outcome = gradeForm(form, answers);
  if (!outcome.ok) {
    throw new Error(outcome.error.message);
  }
  return outcome.result;
}
