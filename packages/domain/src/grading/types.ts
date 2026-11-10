import type { OptionId, QuestionId } from '../ids.js';

/** Learner-submitted answer values keyed by question id and type. */
export type AnswerValue =
  | { questionId: QuestionId; type: 'short_text'; value: string }
  | { questionId: QuestionId; type: 'long_text'; value: string }
  | { questionId: QuestionId; type: 'single_select'; optionId: OptionId }
  | { questionId: QuestionId; type: 'multi_select'; optionIds: OptionId[] }
  | { questionId: QuestionId; type: 'boolean'; value: boolean }
  | { questionId: QuestionId; type: 'number'; value: number };

export type QuestionGradeStatus = 'correct' | 'incorrect' | 'pending' | 'ungraded';

export interface QuestionGrade {
  questionId: QuestionId;
  status: QuestionGradeStatus;
  /** Optional fine-grained scoring; auto-gradable questions use 1 or 0. */
  points?: number;
}

/**
 * Result of pure form auto-grading.
 * `score` is the fraction of auto-gradable points earned (null when none exist).
 * `passed` is null while any question remains `pending` and the auto-gradable
 * portion has not already failed the pass rule.
 */
export interface FormGradeResult {
  grades: QuestionGrade[];
  score: number | null;
  passed: boolean | null;
}

export type GradeFormErrorCode = 'validation';

export interface GradeFormError {
  code: GradeFormErrorCode;
  message: string;
  details?: {
    issues: Array<{ path: string; message: string }>;
  };
}

export type GradeFormOutcome =
  { ok: true; result: FormGradeResult } | { ok: false; error: GradeFormError };
