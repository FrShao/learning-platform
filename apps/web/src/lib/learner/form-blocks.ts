import type { CourseBlockDto, FormSpecDto, PassRuleDto, QuestionDto } from '@/lib/api/types';

/** Normalize published form blocks (nested `form` or legacy flat fields). */
export function resolveFormSpec(block: Extract<CourseBlockDto, { type: 'form' }>): FormSpecDto {
  if (block.form && Array.isArray(block.form.questions)) {
    const resolved: FormSpecDto = {
      questions: block.form.questions,
    };
    const title = block.form.title ?? block.title;
    if (title !== undefined) resolved.title = title;
    const passRule = block.form.passRule ?? flattenPassRule(block);
    if (passRule !== undefined) resolved.passRule = passRule;
    return resolved;
  }

  const questions = Array.isArray(block.questions) ? block.questions : [];
  const resolved: FormSpecDto = {
    questions: questions as QuestionDto[],
  };
  if (block.title !== undefined) resolved.title = block.title;
  const passRule = flattenPassRule(block);
  if (passRule !== undefined) resolved.passRule = passRule;
  return resolved;
}

function flattenPassRule(
  block: Extract<CourseBlockDto, { type: 'form' }>,
): PassRuleDto | undefined {
  if (block.form?.passRule) return block.form.passRule;
  if (typeof block.passRule === 'object' && block.passRule) return block.passRule;
  if (block.passRule === 'min_score') {
    return { mode: 'min_score', min: block.minScore ?? 1 };
  }
  if (block.passRule === 'all_correct') {
    return { mode: 'all_correct' };
  }
  return undefined;
}

export function passRuleLabel(rule: PassRuleDto | undefined): string {
  if (!rule || rule.mode === 'all_correct') return 'All auto-gradable answers must be correct';
  return `Score at least ${Math.round(rule.min * 100)}% on auto-gradable questions`;
}

export function describeGraphBlock(block: Extract<CourseBlockDto, { type: 'graph' }>): string {
  if (typeof block.source === 'string' && block.source.length > 0) {
    return block.source;
  }
  if (block.spec && typeof block.spec === 'object') {
    const spec = block.spec as { kind?: string; format?: string; source?: string; chart?: string };
    if (typeof spec.source === 'string') return spec.source;
    return JSON.stringify(block.spec, null, 2);
  }
  return 'Graph preview unavailable';
}
