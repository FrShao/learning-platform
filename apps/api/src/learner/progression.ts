/**
 * Pure progression helpers (plan §7 / domain-models §6).
 */

import type {
  ContentBlockId,
  CourseTree,
  FormAttempt,
  FormBlock,
  Section,
  SectionId,
} from './types.js';

/** Sort sections by order, then id for stable ties. */
export function orderedSections(tree: CourseTree): Section[] {
  return [...tree.sections].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.id.localeCompare(b.id);
  });
}

export function findSection(tree: CourseTree, sectionId: SectionId): Section | undefined {
  return tree.sections.find((s) => s.id === sectionId);
}

export function findFormBlock(
  tree: CourseTree,
  formBlockId: ContentBlockId,
): { section: Section; block: FormBlock } | undefined {
  for (const section of tree.sections) {
    for (const block of section.blocks) {
      if (block.id === formBlockId && block.type === 'form') {
        return { section, block };
      }
    }
  }
  return undefined;
}

export function formBlocksInSection(section: Section): FormBlock[] {
  return section.blocks.filter((b): b is FormBlock => b.type === 'form');
}

/**
 * Section n is unlocked when enforceSequential is false, or all prior sections
 * (by ordered progression) are completed.
 */
export function isSectionUnlocked(
  tree: CourseTree,
  completedSectionIds: readonly SectionId[],
  sectionId: SectionId,
  enforceSequential: boolean,
): boolean {
  const sections = orderedSections(tree);
  const index = sections.findIndex((s) => s.id === sectionId);
  if (index < 0) {
    return false;
  }
  if (!enforceSequential) {
    return true;
  }
  const completed = new Set(completedSectionIds);
  return sections.slice(0, index).every((s) => completed.has(s.id));
}

/**
 * True when every form in the section has at least one passing attempt for the
 * given published commit (or the section has no forms).
 */
export function sectionFormsSatisfied(
  section: Section,
  attempts: readonly FormAttempt[],
  publishedCommitId: string,
): boolean {
  const forms = formBlocksInSection(section);
  if (forms.length === 0) {
    return true;
  }
  return forms.every((form) =>
    attempts.some(
      (a) =>
        a.formBlockId === form.id && a.publishedCommitId === publishedCommitId && a.passed === true,
    ),
  );
}

/** Derive percent complete 0..100 from completed / total sections. */
export function computePercent(
  tree: CourseTree,
  completedSectionIds: readonly SectionId[],
): number {
  const total = tree.sections.length;
  if (total === 0) {
    return 100;
  }
  const completed = new Set(completedSectionIds);
  const count = tree.sections.filter((s) => completed.has(s.id)).length;
  return Math.round((count / total) * 100);
}

/** Next incomplete section in order, or null when all done. */
export function nextSectionId(
  tree: CourseTree,
  completedSectionIds: readonly SectionId[],
): SectionId | null {
  const completed = new Set(completedSectionIds);
  for (const section of orderedSections(tree)) {
    if (!completed.has(section.id)) {
      return section.id;
    }
  }
  return null;
}
