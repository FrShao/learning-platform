/**
 * Thin form auto-grader stubs for learner attempt flows.
 *
 * Follow-up: replace with `@lp/domain` graders once the content/grading package
 * lands on this branch. Keep call sites importing from this module (or re-export)
 * so the swap stays local.
 */

import type {
  AnswerValue,
  FormSpec,
  Question,
  QuestionGrade,
  QuestionGradeStatus,
} from './types.js';

export interface FormGradeResult {
  grades: QuestionGrade[];
  /** 0..1 over auto-gradable questions; null if none auto-gradable. */
  score: number | null;
  /**
   * true/false when fully resolved; null when long_text (or unscored short_text)
   * leaves pass undecided.
   */
  passed: boolean | null;
  gradedAt: Date | null;
}

/**
 * Grade a form attempt against its FormSpec.
 */
export function gradeFormAttempt(
  form: FormSpec,
  answers: AnswerValue[],
  now: Date = new Date(),
): FormGradeResult {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const grades: QuestionGrade[] = [];
  let autoPoints = 0;
  let autoTotal = 0;
  let pending = false;

  for (const question of form.questions) {
    const answer = byQuestion.get(question.id);
    const grade = gradeQuestion(question, answer);
    grades.push(grade);

    if (grade.status === 'pending' || grade.status === 'ungraded') {
      pending = true;
      continue;
    }

    autoTotal += 1;
    if (grade.status === 'correct') {
      autoPoints += 1;
    }
  }

  const score = autoTotal === 0 ? null : autoPoints / autoTotal;
  const passRule = form.passRule ?? { mode: 'all_correct' as const };

  let passed: boolean | null;
  if (pending) {
    passed = null;
  } else if (autoTotal === 0) {
    // No auto-gradable questions and nothing pending → treat as passed.
    passed = true;
  } else if (passRule.mode === 'all_correct') {
    passed = autoPoints === autoTotal;
  } else {
    passed = (score ?? 0) >= passRule.min;
  }

  return {
    grades,
    score,
    passed,
    gradedAt: pending ? null : now,
  };
}

function gradeQuestion(question: Question, answer: AnswerValue | undefined): QuestionGrade {
  switch (question.type) {
    case 'short_text': {
      if (!answer || answer.type !== 'short_text') {
        if (question.expected === undefined) {
          return { questionId: question.id, status: 'ungraded' };
        }
        return { questionId: question.id, status: 'incorrect', points: 0 };
      }
      if (question.expected === undefined) {
        return { questionId: question.id, status: 'ungraded' };
      }
      const expected = question.caseSensitive ? question.expected : question.expected.toLowerCase();
      const actual = question.caseSensitive ? answer.value : answer.value.toLowerCase();
      return statusGrade(question.id, actual === expected);
    }
    case 'long_text':
      return { questionId: question.id, status: 'pending' };
    case 'single_select': {
      if (!answer || answer.type !== 'single_select') {
        return { questionId: question.id, status: 'incorrect', points: 0 };
      }
      return statusGrade(question.id, answer.optionId === question.correctOptionId);
    }
    case 'multi_select': {
      if (!answer || answer.type !== 'multi_select') {
        return { questionId: question.id, status: 'incorrect', points: 0 };
      }
      const expected = new Set(question.correctOptionIds);
      const actual = new Set(answer.optionIds);
      const equal = expected.size === actual.size && [...expected].every((id) => actual.has(id));
      return statusGrade(question.id, equal);
    }
    case 'boolean': {
      if (!answer || answer.type !== 'boolean') {
        return { questionId: question.id, status: 'incorrect', points: 0 };
      }
      return statusGrade(question.id, answer.value === question.correct);
    }
    case 'number': {
      if (!answer || answer.type !== 'number') {
        return { questionId: question.id, status: 'incorrect', points: 0 };
      }
      const tol = question.tolerance ?? 0;
      const ok = Math.abs(answer.value - question.correct) <= tol;
      return statusGrade(question.id, ok);
    }
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}

function statusGrade(questionId: string, correct: boolean): QuestionGrade {
  const status: QuestionGradeStatus = correct ? 'correct' : 'incorrect';
  return { questionId, status, points: correct ? 1 : 0 };
}
