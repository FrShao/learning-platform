import { LearnerError } from './errors.js';
import { gradeFormAttempt } from './graders.js';
import {
  DEFAULT_ORG_SETTINGS,
  type CoursePublishedReader,
  type LearnerActor,
  type OrgMembershipReader,
} from './ports.js';
import {
  computePercent,
  findFormBlock,
  findSection,
  isSectionUnlocked,
  nextSectionId,
  orderedSections,
  sectionFormsSatisfied,
} from './progression.js';
import type { LearnerStore } from './store.js';
import type {
  AnswerValue,
  ContentBlockId,
  CourseId,
  Enrollment,
  EnrollmentId,
  FormAttempt,
  LearnerProgress,
  PublishedCourseView,
  SectionId,
} from './types.js';

export interface LearnerServiceDeps {
  store: LearnerStore;
  courses: CoursePublishedReader;
  memberships: OrgMembershipReader;
  clock?: () => Date;
}

export interface EnrollResult {
  enrollment: Enrollment;
  progress: LearnerProgress;
}

export class LearnerService {
  private readonly store: LearnerStore;
  private readonly courses: CoursePublishedReader;
  private readonly memberships: OrgMembershipReader;
  private readonly clock: () => Date;

  constructor(deps: LearnerServiceDeps) {
    this.store = deps.store;
    this.courses = deps.courses;
    this.memberships = deps.memberships;
    this.clock = deps.clock ?? (() => new Date());
  }

  async enroll(actor: LearnerActor, courseId: CourseId): Promise<EnrollResult> {
    const course = await this.courses.getCourse(courseId);
    if (!course || course.deletedAt !== null) {
      throw new LearnerError('not_found', 'Course not found');
    }
    if (!course.publishedCommitId) {
      throw new LearnerError('conflict', 'Course has no published version');
    }

    await this.requireMembership(course.orgId, actor.userId);

    const existing = await this.store.findActiveEnrollment(courseId, actor.userId);
    if (existing) {
      const progress = await this.store.getProgress(existing.id);
      if (!progress) {
        throw new LearnerError('conflict', 'Enrollment exists without progress');
      }
      throw new LearnerError('conflict', 'Already enrolled', {
        details: { enrollmentId: existing.id },
      });
    }

    const published = await this.courses.getPublished(courseId);
    if (!published) {
      throw new LearnerError('conflict', 'Published tree unavailable');
    }

    const first = orderedSections(published.tree)[0]?.id ?? null;
    return this.store.createEnrollment({
      courseId,
      userId: actor.userId,
      orgId: course.orgId,
      publishedCommitId: published.publishedCommitId,
      firstSectionId: first,
      now: this.clock(),
    });
  }

  async getPublished(actor: LearnerActor, courseId: CourseId): Promise<PublishedCourseView> {
    const course = await this.courses.getCourse(courseId);
    if (!course || course.deletedAt !== null) {
      throw new LearnerError('not_found', 'Course not found');
    }
    await this.requireMembership(course.orgId, actor.userId);

    const published = await this.courses.getPublished(courseId);
    if (!published) {
      throw new LearnerError('not_found', 'Course has no published version');
    }
    return published;
  }

  async getProgress(
    actor: LearnerActor,
    enrollmentId: EnrollmentId,
  ): Promise<{
    enrollment: Enrollment;
    progress: LearnerProgress;
  }> {
    const { enrollment, progress } = await this.requireOwnedEnrollment(actor, enrollmentId);
    return { enrollment, progress };
  }

  async submitFormAttempt(
    actor: LearnerActor,
    enrollmentId: EnrollmentId,
    formBlockId: ContentBlockId,
    answers: AnswerValue[],
  ): Promise<FormAttempt> {
    const { enrollment, progress } = await this.requireOwnedEnrollment(actor, enrollmentId);
    const settings = await this.orgSettings(enrollment.orgId);

    const published = await this.courses.getPublished(enrollment.courseId);
    if (!published) {
      throw new LearnerError('not_found', 'Published tree unavailable');
    }

    // Progress is pinned to the commit it was started against (republish policy: keep).
    if (published.publishedCommitId !== progress.publishedCommitId) {
      // Still grade against the progress-pinned snapshot when available via published port.
      // If the live published commit moved, require the tree for the progress commit.
      // Course port returns current published only; mismatch → conflict until remap lands.
      throw new LearnerError(
        'conflict',
        'Course was republished; progress is pinned to a prior commit',
        {
          details: {
            progressCommitId: progress.publishedCommitId,
            publishedCommitId: published.publishedCommitId,
          },
        },
      );
    }

    const located = findFormBlock(published.tree, formBlockId);
    if (!located) {
      throw new LearnerError('not_found', 'Form block not found in published tree');
    }

    if (
      !isSectionUnlocked(
        published.tree,
        progress.completedSectionIds,
        located.section.id,
        settings.enforceSequentialProgress,
      )
    ) {
      throw new LearnerError('forbidden', 'Section is locked until prior sections are completed');
    }

    if (!Array.isArray(answers)) {
      throw new LearnerError('validation', 'answers must be an array');
    }

    const graded = gradeFormAttempt(located.block.form, answers, this.clock());
    return this.store.createFormAttempt({
      enrollmentId,
      sectionId: located.section.id,
      formBlockId,
      publishedCommitId: progress.publishedCommitId,
      answers,
      score: graded.score,
      passed: graded.passed,
      grades: graded.grades,
      gradedAt: graded.gradedAt,
      now: this.clock(),
    });
  }

  async completeSection(
    actor: LearnerActor,
    enrollmentId: EnrollmentId,
    sectionId: SectionId,
  ): Promise<LearnerProgress> {
    const { enrollment, progress } = await this.requireOwnedEnrollment(actor, enrollmentId);
    const settings = await this.orgSettings(enrollment.orgId);

    const published = await this.courses.getPublished(enrollment.courseId);
    if (!published) {
      throw new LearnerError('not_found', 'Published tree unavailable');
    }
    if (published.publishedCommitId !== progress.publishedCommitId) {
      throw new LearnerError(
        'conflict',
        'Course was republished; progress is pinned to a prior commit',
        {
          details: {
            progressCommitId: progress.publishedCommitId,
            publishedCommitId: published.publishedCommitId,
          },
        },
      );
    }

    const section = findSection(published.tree, sectionId);
    if (!section) {
      throw new LearnerError('not_found', 'Section not found in published tree');
    }

    if (
      !isSectionUnlocked(
        published.tree,
        progress.completedSectionIds,
        sectionId,
        settings.enforceSequentialProgress,
      )
    ) {
      throw new LearnerError('forbidden', 'Section is locked until prior sections are completed');
    }

    if (progress.completedSectionIds.includes(sectionId)) {
      return progress;
    }

    const attempts = await this.store.listFormAttempts(enrollmentId);
    if (!sectionFormsSatisfied(section, attempts, progress.publishedCommitId)) {
      throw new LearnerError(
        'conflict',
        'All form blocks in the section must have a passing attempt',
      );
    }

    const completedSectionIds = [...progress.completedSectionIds, sectionId];
    const updated: LearnerProgress = {
      ...progress,
      completedSectionIds,
      percent: computePercent(published.tree, completedSectionIds),
      currentSectionId: nextSectionId(published.tree, completedSectionIds),
      updatedAt: this.clock(),
    };
    return this.store.saveProgress(updated);
  }

  private async requireMembership(orgId: string, userId: string): Promise<void> {
    const membership = await this.memberships.getMembership(orgId, userId);
    if (!membership) {
      throw new LearnerError('forbidden', 'Not a member of this organization');
    }
  }

  private async orgSettings(orgId: string) {
    try {
      return await this.memberships.getOrgSettings(orgId);
    } catch {
      return DEFAULT_ORG_SETTINGS;
    }
  }

  private async requireOwnedEnrollment(
    actor: LearnerActor,
    enrollmentId: EnrollmentId,
  ): Promise<{ enrollment: Enrollment; progress: LearnerProgress }> {
    const enrollment = await this.store.getEnrollment(enrollmentId);
    if (!enrollment || enrollment.revokedAt !== null) {
      throw new LearnerError('not_found', 'Enrollment not found');
    }
    if (enrollment.userId !== actor.userId) {
      throw new LearnerError('forbidden', 'Enrollment belongs to another user');
    }
    const progress = await this.store.getProgress(enrollmentId);
    if (!progress) {
      throw new LearnerError('not_found', 'Progress not found');
    }
    return { enrollment, progress };
  }
}
