import { cloneCourseTree, normalizeSectionOrders, validateCourseTree } from './tree.js';
import {
  DomainError,
  type ContentBlock,
  type CourseTree,
  type Section,
  type TreePatch,
  type TreePatchOp,
} from './types.js';

/**
 * Apply tree patch operations transactionally (in order) to a dirty tree.
 * Returns a new tree; does not mutate the input.
 */
export function applyTreePatch(tree: CourseTree, patch: TreePatch): CourseTree {
  if (!patch || !Array.isArray(patch.ops)) {
    throw new DomainError('validation', 'Tree patch must include an ops array');
  }

  let next = cloneCourseTree(tree);
  for (const op of patch.ops) {
    next = applyOp(next, op);
  }
  next = normalizeSectionOrders(next);
  validateCourseTree(next);
  return next;
}

function applyOp(tree: CourseTree, op: TreePatchOp): CourseTree {
  switch (op.op) {
    case 'upsert_section':
      return upsertSection(tree, op.section);
    case 'delete_section':
      return deleteSection(tree, op.sectionId);
    case 'reorder_sections':
      return reorderSections(tree, op.sectionIds);
    case 'upsert_block':
      return upsertBlock(tree, op.sectionId, op.block);
    case 'delete_block':
      return deleteBlock(tree, op.sectionId, op.blockId);
    case 'reorder_blocks':
      return reorderBlocks(tree, op.sectionId, op.blockIds);
    default: {
      const _exhaustive: never = op;
      throw new DomainError('validation', `Unknown tree op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function upsertSection(
  tree: CourseTree,
  sectionInput: Omit<Section, 'blocks'> & { blocks?: ContentBlock[] },
): CourseTree {
  const { id, slug, title, order } = sectionInput;
  if (!id || !slug || !title || typeof order !== 'number') {
    throw new DomainError('validation', 'upsert_section requires id, slug, title, and order');
  }

  const existingIndex = tree.sections.findIndex((s) => s.id === id);
  const blocks =
    sectionInput.blocks ?? (existingIndex >= 0 ? (tree.sections[existingIndex]?.blocks ?? []) : []);

  const section: Section = { id, slug, title, order, blocks };

  if (existingIndex >= 0) {
    const sections = [...tree.sections];
    sections[existingIndex] = section;
    return { sections };
  }

  return { sections: [...tree.sections, section] };
}

function deleteSection(tree: CourseTree, sectionId: string): CourseTree {
  const index = tree.sections.findIndex((s) => s.id === sectionId);
  if (index < 0) {
    throw new DomainError('validation', `Section not found: ${sectionId}`);
  }
  return { sections: tree.sections.filter((s) => s.id !== sectionId) };
}

function reorderSections(tree: CourseTree, sectionIds: string[]): CourseTree {
  assertPermutation(
    tree.sections.map((s) => s.id),
    sectionIds,
    'sectionIds',
  );
  const byId = new Map(tree.sections.map((s) => [s.id, s]));
  const sections = sectionIds.map((id, index) => {
    const section = byId.get(id);
    if (!section) {
      throw new DomainError('validation', `Section not found during reorder: ${id}`);
    }
    return { ...section, order: index };
  });
  return { sections };
}

function upsertBlock(tree: CourseTree, sectionId: string, block: ContentBlock): CourseTree {
  const sectionIndex = tree.sections.findIndex((s) => s.id === sectionId);
  if (sectionIndex < 0) {
    throw new DomainError('validation', `Section not found: ${sectionId}`);
  }
  const section = tree.sections[sectionIndex]!;
  const blockIndex = section.blocks.findIndex((b) => b.id === block.id);
  const blocks = [...section.blocks];
  if (blockIndex >= 0) {
    blocks[blockIndex] = block;
  } else {
    blocks.push(block);
  }
  const sections = [...tree.sections];
  sections[sectionIndex] = { ...section, blocks };
  return { sections };
}

function deleteBlock(tree: CourseTree, sectionId: string, blockId: string): CourseTree {
  const sectionIndex = tree.sections.findIndex((s) => s.id === sectionId);
  if (sectionIndex < 0) {
    throw new DomainError('validation', `Section not found: ${sectionId}`);
  }
  const section = tree.sections[sectionIndex]!;
  if (!section.blocks.some((b) => b.id === blockId)) {
    throw new DomainError('validation', `Block not found: ${blockId}`);
  }
  const sections = [...tree.sections];
  sections[sectionIndex] = {
    ...section,
    blocks: section.blocks.filter((b) => b.id !== blockId),
  };
  return { sections };
}

function reorderBlocks(tree: CourseTree, sectionId: string, blockIds: string[]): CourseTree {
  const sectionIndex = tree.sections.findIndex((s) => s.id === sectionId);
  if (sectionIndex < 0) {
    throw new DomainError('validation', `Section not found: ${sectionId}`);
  }
  const section = tree.sections[sectionIndex]!;
  assertPermutation(
    section.blocks.map((b) => b.id),
    blockIds,
    'blockIds',
  );
  const byId = new Map(section.blocks.map((b) => [b.id, b]));
  const blocks = blockIds.map((id) => {
    const block = byId.get(id);
    if (!block) {
      throw new DomainError('validation', `Block not found during reorder: ${id}`);
    }
    return block;
  });
  const sections = [...tree.sections];
  sections[sectionIndex] = { ...section, blocks };
  return { sections };
}

function assertPermutation(existing: string[], next: string[], label: string): void {
  if (existing.length !== next.length) {
    throw new DomainError('validation', `${label} must be a permutation of existing ids`);
  }
  const existingSet = new Set(existing);
  const nextSet = new Set(next);
  if (existingSet.size !== existing.length || nextSet.size !== next.length) {
    throw new DomainError('validation', `${label} contains duplicates`);
  }
  for (const id of next) {
    if (!existingSet.has(id)) {
      throw new DomainError('validation', `${label} is not a permutation of existing ids`);
    }
  }
}
