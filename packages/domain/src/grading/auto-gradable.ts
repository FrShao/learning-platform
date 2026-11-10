import type { Question } from '../content/types.js';

/**
 * Return true when a question participates in auto-grading / score.
 * `short_text` without `expected` is unscored; `long_text` is never auto-gradable.
 */
export function isAutoGradable(question: Question): boolean {
  switch (question.type) {
    case 'short_text':
      return question.expected !== undefined;
    case 'long_text':
      return false;
    case 'single_select':
    case 'multi_select':
    case 'boolean':
    case 'number':
      return true;
    default: {
      const exhaustive: never = question;
      void exhaustive;
      return false;
    }
  }
}
