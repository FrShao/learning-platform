import { describe, expect, it } from 'vitest';

import { isValidBranchName, isValidCourseSlug, normalizeCourseSlug } from './slug.js';

describe('course slug helpers', () => {
  it('normalizes course slugs', () => {
    expect(normalizeCourseSlug('  Intro Course  ')).toBe('intro-course');
  });

  it('validates course slugs', () => {
    expect(isValidCourseSlug('ab')).toBe(true);
    expect(isValidCourseSlug('a')).toBe(false);
    expect(isValidCourseSlug('Good-Course')).toBe(true);
  });

  it('validates branch names', () => {
    expect(isValidBranchName('main')).toBe(true);
    expect(isValidBranchName('draft/lesson-3')).toBe(true);
    expect(isValidBranchName('/bad')).toBe(false);
    expect(isValidBranchName('bad/')).toBe(false);
  });
});
