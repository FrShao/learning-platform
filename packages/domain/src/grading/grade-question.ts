import type { Question } from '../content/types.js';

import { isAutoGradable } from './auto-gradable.js';
import type { AnswerValue, QuestionGrade } from './types.js';

function setsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const left = new Set(a);
  if (left.size !== a.length) {
    // Duplicate answer ids → not equal to a well-formed correct set.
    return false;
  }
  for (const id of b) {
    if (!left.has(id)) {
      return false;
    }
  }
  return true;
}

function normalizeShortText(value: string, caseSensitive: boolean): string {
  const trimmed = value.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

function gradeWithPoints(
  questionId: string,
  status: QuestionGrade['status'],
  scored: boolean,
): QuestionGrade {
  if (!scored) {
    return { questionId, status };
  }
  return {
    questionId,
    status,
    points: status === 'correct' ? 1 : 0,
  };
}

/**
 * Grade a single question against a learner answer (or missing answer).
 * Type mismatches are treated as incorrect for auto-gradable questions.
 */
export function gradeQuestion(question: Question, answer: AnswerValue | undefined): QuestionGrade {
  if (question.type === 'long_text') {
    return { questionId: question.id, status: 'pending' };
  }

  if (question.type === 'short_text' && question.expected === undefined) {
    return { questionId: question.id, status: 'ungraded' };
  }

  if (answer === undefined || answer.questionId !== question.id) {
    return gradeWithPoints(question.id, 'incorrect', isAutoGradable(question));
  }

  if (answer.type !== question.type) {
    return gradeWithPoints(question.id, 'incorrect', isAutoGradable(question));
  }

  switch (question.type) {
    case 'short_text': {
      const expected = question.expected;
      // expected is defined when auto-gradable; guarded above.
      if (expected === undefined) {
        return { questionId: question.id, status: 'ungraded' };
      }
      if (answer.type !== 'short_text') {
        return gradeWithPoints(question.id, 'incorrect', true);
      }
      const caseSensitive = question.caseSensitive === true;
      const ok =
        normalizeShortText(answer.value, caseSensitive) ===
        normalizeShortText(expected, caseSensitive);
      return gradeWithPoints(question.id, ok ? 'correct' : 'incorrect', true);
    }
    case 'single_select': {
      if (answer.type !== 'single_select') {
        return gradeWithPoints(question.id, 'incorrect', true);
      }
      const ok = answer.optionId === question.correctOptionId;
      return gradeWithPoints(question.id, ok ? 'correct' : 'incorrect', true);
    }
    case 'multi_select': {
      if (answer.type !== 'multi_select') {
        return gradeWithPoints(question.id, 'incorrect', true);
      }
      const ok = setsEqual(answer.optionIds, question.correctOptionIds);
      return gradeWithPoints(question.id, ok ? 'correct' : 'incorrect', true);
    }
    case 'boolean': {
      if (answer.type !== 'boolean') {
        return gradeWithPoints(question.id, 'incorrect', true);
      }
      const ok = answer.value === question.correct;
      return gradeWithPoints(question.id, ok ? 'correct' : 'incorrect', true);
    }
    case 'number': {
      if (answer.type !== 'number') {
        return gradeWithPoints(question.id, 'incorrect', true);
      }
      const tolerance = question.tolerance ?? 0;
      const ok = Math.abs(answer.value - question.correct) <= tolerance;
      return gradeWithPoints(question.id, ok ? 'correct' : 'incorrect', true);
    }
    default: {
      const exhaustive: never = question;
      void exhaustive;
      return { questionId: (question as Question).id, status: 'ungraded' };
    }
  }
}
