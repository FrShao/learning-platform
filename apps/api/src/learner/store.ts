import { randomUUID } from 'node:crypto';

import type {
  AnswerValue,
  CourseCommitId,
  CourseId,
  Enrollment,
  EnrollmentId,
  FormAttempt,
  FormAttemptId,
  LearnerProgress,
  OrgId,
  QuestionGrade,
  SectionId,
  UserId,
} from './types.js';

export interface CreateEnrollmentInput {
  courseId: CourseId;
  userId: UserId;
  orgId: OrgId | null;
  publishedCommitId: CourseCommitId;
  firstSectionId: SectionId | null;
  now?: Date;
}

export interface CreateFormAttemptInput {
  enrollmentId: EnrollmentId;
  sectionId: SectionId;
  formBlockId: string;
  publishedCommitId: CourseCommitId;
  answers: AnswerValue[];
  score: number | null;
  passed: boolean | null;
  grades: QuestionGrade[];
  gradedAt: Date | null;
  now?: Date;
}

export interface LearnerStore {
  createEnrollment(input: CreateEnrollmentInput): Promise<{
    enrollment: Enrollment;
    progress: LearnerProgress;
  }>;
  findActiveEnrollment(courseId: CourseId, userId: UserId): Promise<Enrollment | null>;
  getEnrollment(enrollmentId: EnrollmentId): Promise<Enrollment | null>;
  getProgress(enrollmentId: EnrollmentId): Promise<LearnerProgress | null>;
  saveProgress(progress: LearnerProgress): Promise<LearnerProgress>;
  createFormAttempt(input: CreateFormAttemptInput): Promise<FormAttempt>;
  listFormAttempts(enrollmentId: EnrollmentId): Promise<FormAttempt[]>;
}

/**
 * In-memory store for unit tests and local boot until `@lp/db` learner repos land.
 */
export class MemoryLearnerStore implements LearnerStore {
  readonly enrollments = new Map<EnrollmentId, Enrollment>();
  readonly progressByEnrollment = new Map<EnrollmentId, LearnerProgress>();
  readonly attempts = new Map<FormAttemptId, FormAttempt>();

  async createEnrollment(
    input: CreateEnrollmentInput,
  ): Promise<{ enrollment: Enrollment; progress: LearnerProgress }> {
    const existing = await this.findActiveEnrollment(input.courseId, input.userId);
    if (existing) {
      throw new Error('enrollment already exists');
    }
    const now = input.now ?? new Date();
    const enrollment: Enrollment = {
      id: randomUUID(),
      courseId: input.courseId,
      userId: input.userId,
      orgId: input.orgId,
      enrolledAt: now,
      revokedAt: null,
    };
    const progress: LearnerProgress = {
      enrollmentId: enrollment.id,
      publishedCommitId: input.publishedCommitId,
      completedSectionIds: [],
      currentSectionId: input.firstSectionId,
      percent: 0,
      updatedAt: now,
    };
    this.enrollments.set(enrollment.id, enrollment);
    this.progressByEnrollment.set(enrollment.id, progress);
    return { enrollment, progress };
  }

  async findActiveEnrollment(courseId: CourseId, userId: UserId): Promise<Enrollment | null> {
    for (const enrollment of this.enrollments.values()) {
      if (
        enrollment.courseId === courseId &&
        enrollment.userId === userId &&
        enrollment.revokedAt === null
      ) {
        return enrollment;
      }
    }
    return null;
  }

  async getEnrollment(enrollmentId: EnrollmentId): Promise<Enrollment | null> {
    return this.enrollments.get(enrollmentId) ?? null;
  }

  async getProgress(enrollmentId: EnrollmentId): Promise<LearnerProgress | null> {
    return this.progressByEnrollment.get(enrollmentId) ?? null;
  }

  async saveProgress(progress: LearnerProgress): Promise<LearnerProgress> {
    this.progressByEnrollment.set(progress.enrollmentId, progress);
    return progress;
  }

  async createFormAttempt(input: CreateFormAttemptInput): Promise<FormAttempt> {
    const now = input.now ?? new Date();
    const attempt: FormAttempt = {
      id: randomUUID(),
      enrollmentId: input.enrollmentId,
      sectionId: input.sectionId,
      formBlockId: input.formBlockId,
      publishedCommitId: input.publishedCommitId,
      answers: input.answers,
      score: input.score,
      passed: input.passed,
      grades: input.grades,
      gradedAt: input.gradedAt,
      createdAt: now,
    };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async listFormAttempts(enrollmentId: EnrollmentId): Promise<FormAttempt[]> {
    return [...this.attempts.values()].filter((a) => a.enrollmentId === enrollmentId);
  }
}
