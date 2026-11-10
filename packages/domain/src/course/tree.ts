import { DomainError, type ContentBlock, type CourseTree, type Section } from './types.js';

/** Empty course tree used for new courses / empty branches. */
export function emptyCourseTree(): CourseTree {
  return { sections: [] };
}

/**
 * Deep-clone a course tree via JSON (trees are JSONB-safe plain data).
 */
export function cloneCourseTree(tree: CourseTree): CourseTree {
  return structuredClone(tree);
}

/**
 * Validate CourseTree invariants: unique section/block ids and section slugs,
 * non-negative unique orders preferred, known block discriminants.
 */
export function validateCourseTree(tree: CourseTree): void {
  if (!tree || !Array.isArray(tree.sections)) {
    throw new DomainError('validation', 'Course tree must have a sections array');
  }

  const sectionIds = new Set<string>();
  const sectionSlugs = new Set<string>();
  const blockIds = new Set<string>();
  const orders = new Set<number>();

  for (const section of tree.sections) {
    validateSectionShape(section);

    if (sectionIds.has(section.id)) {
      throw new DomainError('validation', `Duplicate section id: ${section.id}`);
    }
    sectionIds.add(section.id);

    if (sectionSlugs.has(section.slug)) {
      throw new DomainError('validation', `Duplicate section slug: ${section.slug}`);
    }
    sectionSlugs.add(section.slug);

    if (!Number.isInteger(section.order) || section.order < 0) {
      throw new DomainError('validation', `Invalid section order for ${section.id}`);
    }
    if (orders.has(section.order)) {
      throw new DomainError('validation', `Duplicate section order: ${section.order}`);
    }
    orders.add(section.order);

    for (const block of section.blocks) {
      validateBlockShape(block);
      if (blockIds.has(block.id)) {
        throw new DomainError('validation', `Duplicate block id: ${block.id}`);
      }
      blockIds.add(block.id);
    }
  }
}

function validateSectionShape(section: Section): void {
  if (!section.id || typeof section.id !== 'string') {
    throw new DomainError('validation', 'Section id is required');
  }
  if (!section.slug || typeof section.slug !== 'string') {
    throw new DomainError('validation', `Section ${section.id} slug is required`);
  }
  if (!section.title || typeof section.title !== 'string') {
    throw new DomainError('validation', `Section ${section.id} title is required`);
  }
  if (!Array.isArray(section.blocks)) {
    throw new DomainError('validation', `Section ${section.id} blocks must be an array`);
  }
}

function validateBlockShape(block: ContentBlock): void {
  if (!block.id || typeof block.id !== 'string') {
    throw new DomainError('validation', 'Block id is required');
  }
  switch (block.type) {
    case 'text':
      if (typeof block.markdown !== 'string') {
        throw new DomainError('validation', `Text block ${block.id} requires markdown`);
      }
      break;
    case 'image':
      if (typeof block.assetId !== 'string' || block.assetId.length === 0) {
        throw new DomainError('validation', `Image block ${block.id} requires assetId`);
      }
      break;
    case 'graph':
      validateGraphSpec(block);
      break;
    case 'form':
      validateFormSpec(block);
      break;
    default: {
      const _exhaustive: never = block;
      throw new DomainError('validation', `Unknown block type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function validateGraphSpec(block: Extract<ContentBlock, { type: 'graph' }>): void {
  const { spec } = block;
  if (!spec || typeof spec !== 'object') {
    throw new DomainError('validation', `Graph block ${block.id} requires spec`);
  }
  if (spec.kind === 'chart') {
    const charts = new Set(['line', 'bar', 'pie', 'scatter']);
    if (!charts.has(spec.chart)) {
      throw new DomainError('validation', `Graph block ${block.id} has invalid chart kind`);
    }
    if (spec.data === undefined) {
      throw new DomainError('validation', `Chart graph ${block.id} requires data`);
    }
    return;
  }
  if (spec.kind === 'diagram') {
    if (spec.format !== 'mermaid') {
      throw new DomainError('validation', `Diagram graph ${block.id} must use mermaid`);
    }
    if (typeof spec.source !== 'string' || spec.source.length === 0) {
      throw new DomainError('validation', `Diagram graph ${block.id} requires non-empty source`);
    }
    return;
  }
  throw new DomainError('validation', `Graph block ${block.id} has unknown kind`);
}

function validateFormSpec(block: Extract<ContentBlock, { type: 'form' }>): void {
  const { form } = block;
  if (!form || !Array.isArray(form.questions)) {
    throw new DomainError('validation', `Form block ${block.id} requires questions array`);
  }
  if (form.questions.length < 1) {
    throw new DomainError('validation', `Form block ${block.id} must have at least one question`);
  }
  const questionIds = new Set<string>();
  for (const q of form.questions) {
    if (!q.id || !q.prompt || !q.type) {
      throw new DomainError('validation', `Form block ${block.id} has an invalid question`);
    }
    if (questionIds.has(q.id)) {
      throw new DomainError('validation', `Duplicate question id ${q.id} in form ${block.id}`);
    }
    questionIds.add(q.id);

    if (q.type === 'single_select' || q.type === 'multi_select') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new DomainError('validation', `Question ${q.id} must have at least two options`);
      }
      const optionIds = new Set(q.options.map((o) => o.id));
      if (optionIds.size !== q.options.length) {
        throw new DomainError('validation', `Question ${q.id} has duplicate option ids`);
      }
      if (q.type === 'single_select' && !optionIds.has(q.correctOptionId)) {
        throw new DomainError('validation', `Question ${q.id} correctOptionId is invalid`);
      }
      if (q.type === 'multi_select') {
        for (const id of q.correctOptionIds) {
          if (!optionIds.has(id)) {
            throw new DomainError('validation', `Question ${q.id} has invalid correctOptionIds`);
          }
        }
      }
    }
  }
  if (form.passRule?.mode === 'min_score') {
    if (typeof form.passRule.min !== 'number' || form.passRule.min < 0 || form.passRule.min > 1) {
      throw new DomainError('validation', `Form ${block.id} passRule.min must be 0..1`);
    }
  }
}

/**
 * Rewrite section.order to match array index (0-based contiguous).
 */
export function normalizeSectionOrders(tree: CourseTree): CourseTree {
  return {
    sections: tree.sections.map((section, index) => ({
      ...section,
      order: index,
    })),
  };
}
