import { describe, expect, it } from 'vitest';

import { matchLearnerRoute, stubResolveLearnerActor } from './http.js';

describe('matchLearnerRoute', () => {
  it('matches enroll / published / progress / complete / attempt', () => {
    expect(matchLearnerRoute('POST', '/v1/courses/c1/enroll')).toEqual({
      name: 'enroll',
      params: { courseId: 'c1' },
    });
    expect(matchLearnerRoute('GET', '/v1/courses/c1/published')).toEqual({
      name: 'published',
      params: { courseId: 'c1' },
    });
    expect(matchLearnerRoute('GET', '/v1/enrollments/e1/progress')).toEqual({
      name: 'progress',
      params: { enrollmentId: 'e1' },
    });
    expect(matchLearnerRoute('POST', '/v1/enrollments/e1/sections/s1/complete')).toEqual({
      name: 'complete_section',
      params: { enrollmentId: 'e1', sectionId: 's1' },
    });
    expect(matchLearnerRoute('POST', '/v1/enrollments/e1/forms/b1/attempt')).toEqual({
      name: 'form_attempt',
      params: { enrollmentId: 'e1', blockId: 'b1' },
    });
  });

  it('ignores wrong methods and unrelated paths', () => {
    expect(matchLearnerRoute('GET', '/v1/courses/c1/enroll')).toBeNull();
    expect(matchLearnerRoute('POST', '/v1/courses/c1/published')).toBeNull();
    expect(matchLearnerRoute('GET', '/health')).toBeNull();
  });
});

describe('stubResolveLearnerActor', () => {
  it('reads X-User-Id and Bearer user:<id>', async () => {
    expect(
      await stubResolveLearnerActor({
        get: (n) => (n === 'x-user-id' ? 'u-1' : null),
      }),
    ).toEqual({ kind: 'user', userId: 'u-1' });

    expect(
      await stubResolveLearnerActor({
        get: (n) => (n === 'authorization' ? 'Bearer user:u-2' : null),
      }),
    ).toEqual({ kind: 'user', userId: 'u-2' });

    expect(
      await stubResolveLearnerActor({
        get: () => null,
      }),
    ).toBeNull();
  });
});
