import { canonicalizeTreeJson } from './content-hash.js';
import type { ContentBlock, CourseTree, Section, TreeDiff, TreeDiffEntry } from './types.js';

/**
 * Diff dirtyTree against a base tree (typically the snapshot of baseCommitId).
 * Empty base is treated as `{ sections: [] }`.
 */
export function diffCourseTrees(base: CourseTree | null, dirty: CourseTree): TreeDiff {
  const before = base ?? { sections: [] };
  const entries: TreeDiffEntry[] = [];

  const baseById = new Map(before.sections.map((s) => [s.id, s]));
  const dirtyById = new Map(dirty.sections.map((s) => [s.id, s]));

  for (const [id, section] of dirtyById) {
    const prior = baseById.get(id);
    if (!prior) {
      entries.push({
        kind: 'section_added',
        sectionId: id,
        after: summarizeSection(section),
      });
      continue;
    }
    if (!sectionMetaEqual(prior, section)) {
      entries.push({
        kind: 'section_changed',
        sectionId: id,
        before: summarizeSection(prior),
        after: summarizeSection(section),
      });
    }
    entries.push(...diffBlocks(prior, section));
  }

  for (const [id, section] of baseById) {
    if (!dirtyById.has(id)) {
      entries.push({
        kind: 'section_removed',
        sectionId: id,
        before: summarizeSection(section),
      });
    }
  }

  return { entries };
}

function diffBlocks(prior: Section, next: Section): TreeDiffEntry[] {
  const entries: TreeDiffEntry[] = [];
  const priorBlocks = new Map(prior.blocks.map((b) => [b.id, b]));
  const nextBlocks = new Map(next.blocks.map((b) => [b.id, b]));

  for (const [id, block] of nextBlocks) {
    const old = priorBlocks.get(id);
    if (!old) {
      entries.push({
        kind: 'block_added',
        sectionId: next.id,
        blockId: id,
        after: block,
      });
      continue;
    }
    if (
      canonicalizeTreeJson({ sections: [{ ...next, blocks: [old] }] }) !==
      canonicalizeTreeJson({ sections: [{ ...next, blocks: [block] }] })
    ) {
      // Compare block JSON only
      if (stableBlockJson(old) !== stableBlockJson(block)) {
        entries.push({
          kind: 'block_changed',
          sectionId: next.id,
          blockId: id,
          before: old,
          after: block,
        });
      }
    }
  }

  for (const [id, block] of priorBlocks) {
    if (!nextBlocks.has(id)) {
      entries.push({
        kind: 'block_removed',
        sectionId: next.id,
        blockId: id,
        before: block,
      });
    }
  }

  return entries;
}

function summarizeSection(section: Section): Record<string, unknown> {
  return {
    id: section.id,
    slug: section.slug,
    title: section.title,
    order: section.order,
    blockCount: section.blocks.length,
  };
}

function sectionMetaEqual(a: Section, b: Section): boolean {
  return a.slug === b.slug && a.title === b.title && a.order === b.order;
}

function stableBlockJson(block: ContentBlock): string {
  return JSON.stringify(block, Object.keys(block).sort());
}
