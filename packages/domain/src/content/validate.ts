import type { ContentBlock, FormSpec, GraphSpec, Option, PassRule, Question } from './types.js';

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult = { ok: true } | { ok: false; issues: ValidationIssue[] };

function fail(path: string, message: string): ValidationResult {
  return { ok: false, issues: [{ path, message }] };
}

function collect(issues: ValidationIssue[]): ValidationResult {
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validateOptions(options: Option[], path: string, issues: ValidationIssue[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(options) || options.length < 2) {
    issues.push({ path: `${path}.options`, message: 'options must contain at least 2 entries' });
    return ids;
  }
  for (let i = 0; i < options.length; i += 1) {
    const option = options[i];
    const optionPath = `${path}.options[${i}]`;
    if (!option || typeof option !== 'object') {
      issues.push({ path: optionPath, message: 'option must be an object' });
      continue;
    }
    if (!isNonEmptyString(option.id)) {
      issues.push({ path: `${optionPath}.id`, message: 'option id is required' });
    } else if (ids.has(option.id)) {
      issues.push({ path: `${optionPath}.id`, message: `duplicate option id "${option.id}"` });
    } else {
      ids.add(option.id);
    }
    if (typeof option.label !== 'string' || option.label.length === 0) {
      issues.push({ path: `${optionPath}.label`, message: 'option label is required' });
    }
  }
  return ids;
}

function validatePassRule(passRule: PassRule, path: string, issues: ValidationIssue[]): void {
  if (passRule.mode === 'all_correct') {
    return;
  }
  if (passRule.mode === 'min_score') {
    if (typeof passRule.min !== 'number' || Number.isNaN(passRule.min)) {
      issues.push({ path: `${path}.min`, message: 'min must be a number' });
      return;
    }
    if (passRule.min < 0 || passRule.min > 1) {
      issues.push({ path: `${path}.min`, message: 'min must be between 0 and 1 inclusive' });
    }
    return;
  }
  issues.push({ path: `${path}.mode`, message: 'passRule.mode must be all_correct or min_score' });
}

/**
 * Validate a FormSpec against domain invariants (question uniqueness, select options, pass rules).
 */
export function validateFormSpec(form: FormSpec, basePath = 'form'): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!form || typeof form !== 'object') {
    return fail(basePath, 'form must be an object');
  }

  if (form.title !== undefined && typeof form.title !== 'string') {
    issues.push({ path: `${basePath}.title`, message: 'title must be a string when provided' });
  }

  if (!Array.isArray(form.questions) || form.questions.length < 1) {
    issues.push({
      path: `${basePath}.questions`,
      message: 'questions must contain at least 1 entry',
    });
    return collect(issues);
  }

  if (form.passRule !== undefined) {
    validatePassRule(form.passRule, `${basePath}.passRule`, issues);
  }

  const questionIds = new Set<string>();
  for (let i = 0; i < form.questions.length; i += 1) {
    const question = form.questions[i];
    const path = `${basePath}.questions[${i}]`;
    if (!question || typeof question !== 'object') {
      issues.push({ path, message: 'question must be an object' });
      continue;
    }
    if (!isNonEmptyString(question.id)) {
      issues.push({ path: `${path}.id`, message: 'question id is required' });
    } else if (questionIds.has(question.id)) {
      issues.push({ path: `${path}.id`, message: `duplicate question id "${question.id}"` });
    } else {
      questionIds.add(question.id);
    }
    if (typeof question.prompt !== 'string' || question.prompt.length === 0) {
      issues.push({ path: `${path}.prompt`, message: 'prompt is required' });
    }
    issues.push(...validateQuestionFields(question, path));
  }

  return collect(issues);
}

function validateQuestionFields(question: Question, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  switch (question.type) {
    case 'short_text': {
      if (question.expected !== undefined && typeof question.expected !== 'string') {
        issues.push({ path: `${path}.expected`, message: 'expected must be a string when set' });
      }
      if (question.caseSensitive !== undefined && typeof question.caseSensitive !== 'boolean') {
        issues.push({
          path: `${path}.caseSensitive`,
          message: 'caseSensitive must be a boolean when set',
        });
      }
      break;
    }
    case 'long_text': {
      if (question.rubric !== undefined && typeof question.rubric !== 'string') {
        issues.push({ path: `${path}.rubric`, message: 'rubric must be a string when set' });
      }
      break;
    }
    case 'single_select': {
      const optionIds = validateOptions(question.options, path, issues);
      if (!isNonEmptyString(question.correctOptionId)) {
        issues.push({ path: `${path}.correctOptionId`, message: 'correctOptionId is required' });
      } else if (optionIds.size > 0 && !optionIds.has(question.correctOptionId)) {
        issues.push({
          path: `${path}.correctOptionId`,
          message: 'correctOptionId must refer to an option id',
        });
      }
      break;
    }
    case 'multi_select': {
      const optionIds = validateOptions(question.options, path, issues);
      if (!Array.isArray(question.correctOptionIds)) {
        issues.push({
          path: `${path}.correctOptionIds`,
          message: 'correctOptionIds must be an array',
        });
        break;
      }
      if (question.correctOptionIds.length < 1) {
        issues.push({
          path: `${path}.correctOptionIds`,
          message: 'correctOptionIds must contain at least 1 id',
        });
      }
      const seen = new Set<string>();
      for (const id of question.correctOptionIds) {
        if (!isNonEmptyString(id)) {
          issues.push({
            path: `${path}.correctOptionIds`,
            message: 'correctOptionIds entries must be non-empty strings',
          });
          continue;
        }
        if (seen.has(id)) {
          issues.push({
            path: `${path}.correctOptionIds`,
            message: `duplicate correctOptionId "${id}"`,
          });
        }
        seen.add(id);
        if (optionIds.size > 0 && !optionIds.has(id)) {
          issues.push({
            path: `${path}.correctOptionIds`,
            message: `correctOptionId "${id}" must refer to an option id`,
          });
        }
      }
      break;
    }
    case 'boolean': {
      if (typeof question.correct !== 'boolean') {
        issues.push({ path: `${path}.correct`, message: 'correct must be a boolean' });
      }
      break;
    }
    case 'number': {
      if (typeof question.correct !== 'number' || Number.isNaN(question.correct)) {
        issues.push({ path: `${path}.correct`, message: 'correct must be a number' });
      }
      if (question.tolerance !== undefined) {
        if (typeof question.tolerance !== 'number' || Number.isNaN(question.tolerance)) {
          issues.push({ path: `${path}.tolerance`, message: 'tolerance must be a number' });
        } else if (question.tolerance < 0) {
          issues.push({ path: `${path}.tolerance`, message: 'tolerance must be >= 0' });
        }
      }
      break;
    }
    default: {
      const exhaustive: never = question;
      void exhaustive;
      issues.push({ path: `${path}.type`, message: 'unknown question type' });
    }
  }

  return issues;
}

/**
 * Validate a GraphSpec (chart or mermaid diagram).
 */
export function validateGraphSpec(spec: GraphSpec, basePath = 'spec'): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!spec || typeof spec !== 'object') {
    return fail(basePath, 'spec must be an object');
  }

  if (spec.kind === 'chart') {
    const charts = new Set(['line', 'bar', 'pie', 'scatter']);
    if (!charts.has(spec.chart)) {
      issues.push({
        path: `${basePath}.chart`,
        message: 'chart must be line, bar, pie, or scatter',
      });
    }
    if (spec.data === undefined) {
      issues.push({ path: `${basePath}.data`, message: 'data is required for chart graphs' });
    }
    return collect(issues);
  }

  if (spec.kind === 'diagram') {
    if (spec.format !== 'mermaid') {
      issues.push({ path: `${basePath}.format`, message: 'diagram format must be mermaid' });
    }
    if (typeof spec.source !== 'string' || spec.source.length === 0) {
      issues.push({ path: `${basePath}.source`, message: 'diagram source must be non-empty' });
    }
    return collect(issues);
  }

  return fail(`${basePath}.kind`, 'graph kind must be chart or diagram');
}

/**
 * Validate a ContentBlock discriminant and required fields.
 */
export function validateContentBlock(block: ContentBlock, basePath = 'block'): ValidationResult {
  if (!block || typeof block !== 'object') {
    return fail(basePath, 'block must be an object');
  }
  if (!isNonEmptyString(block.id)) {
    return fail(`${basePath}.id`, 'block id is required');
  }

  switch (block.type) {
    case 'text': {
      if (typeof block.markdown !== 'string') {
        return fail(`${basePath}.markdown`, 'markdown must be a string');
      }
      return { ok: true };
    }
    case 'image': {
      const issues: ValidationIssue[] = [];
      if (!isNonEmptyString(block.assetId)) {
        issues.push({ path: `${basePath}.assetId`, message: 'assetId is required' });
      }
      if (block.alt !== undefined && typeof block.alt !== 'string') {
        issues.push({ path: `${basePath}.alt`, message: 'alt must be a string when set' });
      }
      if (block.caption !== undefined && typeof block.caption !== 'string') {
        issues.push({ path: `${basePath}.caption`, message: 'caption must be a string when set' });
      }
      return collect(issues);
    }
    case 'graph':
      return validateGraphSpec(block.spec, `${basePath}.spec`);
    case 'form':
      return validateFormSpec(block.form, `${basePath}.form`);
    default: {
      const exhaustive: never = block;
      void exhaustive;
      return fail(`${basePath}.type`, 'unknown content block type');
    }
  }
}
