/**
 * Learner form grading adapter over `@lp/domain` pure graders.
 * Keeps a stable `gradeFormAttempt` surface for the learner service
 * (including `gradedAt`) while validation and scoring live in domain.
 */

import {
  gradeForm,
  type AnswerValue as DomainAnswerValue,
  type FormSpec as DomainFormSpec,
  type QuestionGrade as DomainQuestionGrade,
} from '@lp/domain';

import { LearnerError } from './errors.js';
import type { AnswerValue, FormSpec, QuestionGrade } from './types.js';

export interface FormGradeResult {
  grades: QuestionGrade[];
  /** 0..1 over auto-gradable questions; null if none auto-gradable. */
  score: number | null;
  /**
   * true/false when fully resolved; null when pending long_text leaves
   * pass undecided (and the auto-gradable portion has not already failed).
   */
  passed: boolean | null;
  gradedAt: Date | null;
}

/**
 * Grade a form attempt against its FormSpec using domain auto-graders.
 */
export function gradeFormAttempt(
  form: FormSpec,
  answers: AnswerValue[],
  now: Date = new Date(),
): FormGradeResult {
  const outcome = gradeForm(form as DomainFormSpec, answers as DomainAnswerValue[]);
  if (!outcome.ok) {
    const details = outcome.error.details as Record<string, unknown> | undefined;
    throw new LearnerError('validation', outcome.error.message, details ? { details } : undefined);
  }

  const { grades, score, passed } = outcome.result;
  return {
    grades: grades as DomainQuestionGrade[] as QuestionGrade[],
    score,
    passed,
    gradedAt: passed === null ? null : now,
  };
}
