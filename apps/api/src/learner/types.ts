/** Learner enrollment, progress, and form-attempt types (domain-models §5). */

export type UserId = string;
export type OrgId = string;
export type CourseId = string;
export type CourseCommitId = string;
export type EnrollmentId = string;
export type FormAttemptId = string;
export type SectionId = string;
export type ContentBlockId = string;
export type QuestionId = string;
export type OptionId = string;

export type OrgRole = 'owner' | 'admin' | 'author' | 'learner';

export interface OrgSettings {
  enforceSequentialProgress: boolean;
  republishProgressPolicy: 'keep' | 'reset';
}

export interface CourseTree {
  sections: Section[];
}

export interface Section {
  id: SectionId;
  slug: string;
  title: string;
  order: number;
  blocks: ContentBlock[];
}

export type ContentBlock = TextBlock | ImageBlock | GraphBlock | FormBlock;

export interface TextBlock {
  id: ContentBlockId;
  type: 'text';
  markdown: string;
}

export interface ImageBlock {
  id: ContentBlockId;
  type: 'image';
  assetId: string;
  alt?: string;
  caption?: string;
}

export interface GraphBlock {
  id: ContentBlockId;
  type: 'graph';
  spec: unknown;
}

export interface FormBlock {
  id: ContentBlockId;
  type: 'form';
  form: FormSpec;
}

export interface FormSpec {
  title?: string;
  questions: Question[];
  passRule?: PassRule;
}

export type PassRule = { mode: 'all_correct' } | { mode: 'min_score'; min: number };

export type Question =
  | ShortTextQuestion
  | LongTextQuestion
  | SingleSelectQuestion
  | MultiSelectQuestion
  | BooleanQuestion
  | NumberQuestion;

export interface QuestionBase {
  id: QuestionId;
  prompt: string;
}

export interface ShortTextQuestion extends QuestionBase {
  type: 'short_text';
  expected?: string;
  caseSensitive?: boolean;
}

export interface LongTextQuestion extends QuestionBase {
  type: 'long_text';
  rubric?: string;
}

export interface SingleSelectQuestion extends QuestionBase {
  type: 'single_select';
  options: Option[];
  correctOptionId: OptionId;
}

export interface MultiSelectQuestion extends QuestionBase {
  type: 'multi_select';
  options: Option[];
  correctOptionIds: OptionId[];
}

export interface BooleanQuestion extends QuestionBase {
  type: 'boolean';
  correct: boolean;
}

export interface NumberQuestion extends QuestionBase {
  type: 'number';
  correct: number;
  tolerance?: number;
}

export interface Option {
  id: OptionId;
  label: string;
}

export type AnswerValue =
  | { questionId: QuestionId; type: 'short_text'; value: string }
  | { questionId: QuestionId; type: 'long_text'; value: string }
  | { questionId: QuestionId; type: 'single_select'; optionId: OptionId }
  | { questionId: QuestionId; type: 'multi_select'; optionIds: OptionId[] }
  | { questionId: QuestionId; type: 'boolean'; value: boolean }
  | { questionId: QuestionId; type: 'number'; value: number };

export type QuestionGradeStatus = 'correct' | 'incorrect' | 'pending' | 'ungraded';

export interface QuestionGrade {
  questionId: QuestionId;
  status: QuestionGradeStatus;
  points?: number;
}

export interface Enrollment {
  id: EnrollmentId;
  courseId: CourseId;
  userId: UserId;
  /** Denormalized from course; null for personal courses. */
  orgId: OrgId | null;
  enrolledAt: Date;
  revokedAt: Date | null;
}

export interface LearnerProgress {
  enrollmentId: EnrollmentId;
  publishedCommitId: CourseCommitId;
  completedSectionIds: SectionId[];
  currentSectionId: SectionId | null;
  percent: number;
  updatedAt: Date;
}

export interface FormAttempt {
  id: FormAttemptId;
  enrollmentId: EnrollmentId;
  sectionId: SectionId;
  formBlockId: ContentBlockId;
  publishedCommitId: CourseCommitId;
  answers: AnswerValue[];
  score: number | null;
  passed: boolean | null;
  grades: QuestionGrade[];
  gradedAt: Date | null;
  createdAt: Date;
}

export interface PublishedCourseView {
  courseId: CourseId;
  orgId: OrgId | null;
  title: string;
  slug: string;
  publishedCommitId: CourseCommitId;
  tree: CourseTree;
}

export interface CourseSummary {
  id: CourseId;
  orgId: OrgId | null;
  ownerUserId?: UserId | null;
  slug: string;
  title: string;
  publishedCommitId: CourseCommitId | null;
  deletedAt: Date | null;
}

export type ApiErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'conflict';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}
