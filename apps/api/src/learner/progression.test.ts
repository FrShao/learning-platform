import { describe, expect, it } from 'vitest';

import {
  computePercent,
  isSectionUnlocked,
  nextSectionId,
  orderedSections,
  sectionFormsSatisfied,
} from './progression.js';
import {
  COMMIT_ID,
  FORM_QUIZ,
  SEC_FINAL,
  SEC_INTRO,
  SEC_QUIZ,
  sampleTree,
} from './test-fixtures.js';
import type { FormAttempt } from './types.js';

describe('orderedSections', () => {
  it('sorts by order then id', () => {
    const ids = orderedSections(sampleTree()).map((s) => s.id);
    expect(ids).toEqual([SEC_INTRO, SEC_QUIZ, SEC_FINAL]);
  });
});

describe('isSectionUnlocked', () => {
  const tree = sampleTree();

  it('unlocks only the first section when sequential and none complete', () => {
    expect(isSectionUnlocked(tree, [], SEC_INTRO, true)).toBe(true);
    expect(isSectionUnlocked(tree, [], SEC_QUIZ, true)).toBe(false);
    expect(isSectionUnlocked(tree, [], SEC_FINAL, true)).toBe(false);
  });

  it('unlocks section n after 0..n-1 complete', () => {
    expect(isSectionUnlocked(tree, [SEC_INTRO], SEC_QUIZ, true)).toBe(true);
    expect(isSectionUnlocked(tree, [SEC_INTRO], SEC_FINAL, true)).toBe(false);
    expect(isSectionUnlocked(tree, [SEC_INTRO, SEC_QUIZ], SEC_FINAL, true)).toBe(true);
  });

  it('unlocks all sections when sequential enforcement is off', () => {
    expect(isSectionUnlocked(tree, [], SEC_FINAL, false)).toBe(true);
  });

  it('returns false for unknown section ids', () => {
    expect(isSectionUnlocked(tree, [], 'sec_missing', true)).toBe(false);
  });
});

describe('sectionFormsSatisfied', () => {
  const tree = sampleTree();
  const quiz = tree.sections.find((s) => s.id === SEC_QUIZ)!;
  const intro = tree.sections.find((s) => s.id === SEC_INTRO)!;

  it('passes sections with no forms', () => {
    expect(sectionFormsSatisfied(intro, [], COMMIT_ID)).toBe(true);
  });

  it('requires a passing attempt for each form on the progress commit', () => {
    expect(sectionFormsSatisfied(quiz, [], COMMIT_ID)).toBe(false);

    const failing: FormAttempt = {
      id: 'a1',
      enrollmentId: 'e1',
      sectionId: SEC_QUIZ,
      formBlockId: FORM_QUIZ,
      publishedCommitId: COMMIT_ID,
      answers: [],
      score: 0,
      passed: false,
      grades: [],
      gradedAt: new Date(),
      createdAt: new Date(),
    };
    expect(sectionFormsSatisfied(quiz, [failing], COMMIT_ID)).toBe(false);

    const pending: FormAttempt = { ...failing, id: 'a2', passed: null };
    expect(sectionFormsSatisfied(quiz, [pending], COMMIT_ID)).toBe(false);

    const passing: FormAttempt = { ...failing, id: 'a3', passed: true };
    expect(sectionFormsSatisfied(quiz, [failing, passing], COMMIT_ID)).toBe(true);
  });

  it('ignores passing attempts for a different published commit', () => {
    const otherCommit: FormAttempt = {
      id: 'a4',
      enrollmentId: 'e1',
      sectionId: SEC_QUIZ,
      formBlockId: FORM_QUIZ,
      publishedCommitId: '99999999-9999-4999-8999-999999999999',
      answers: [],
      score: 1,
      passed: true,
      grades: [],
      gradedAt: new Date(),
      createdAt: new Date(),
    };
    expect(sectionFormsSatisfied(quiz, [otherCommit], COMMIT_ID)).toBe(false);
  });
});

describe('computePercent / nextSectionId', () => {
  const tree = sampleTree();

  it('computes percent from completed sections', () => {
    expect(computePercent(tree, [])).toBe(0);
    expect(computePercent(tree, [SEC_INTRO])).toBe(33);
    expect(computePercent(tree, [SEC_INTRO, SEC_QUIZ, SEC_FINAL])).toBe(100);
  });

  it('returns the next incomplete section', () => {
    expect(nextSectionId(tree, [])).toBe(SEC_INTRO);
    expect(nextSectionId(tree, [SEC_INTRO])).toBe(SEC_QUIZ);
    expect(nextSectionId(tree, [SEC_INTRO, SEC_QUIZ, SEC_FINAL])).toBeNull();
  });
});
