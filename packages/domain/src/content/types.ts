import type { AssetId, ContentBlockId, OptionId, QuestionId, SectionId } from '../ids.js';

/** Ordered course content tree stored in snapshots and working trees. */
export interface CourseTree {
  sections: Section[];
}

export interface Section {
  id: SectionId;
  slug: string;
  title: string;
  /** 0-based progression order. */
  order: number;
  blocks: ContentBlock[];
}

export type ContentBlockType = 'text' | 'image' | 'graph' | 'form';

export type ContentBlock = TextBlock | ImageBlock | GraphBlock | FormBlock;

export interface BlockBase {
  id: ContentBlockId;
}

export interface TextBlock extends BlockBase {
  type: 'text';
  markdown: string;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  assetId: AssetId;
  alt?: string;
  caption?: string;
}

export interface GraphBlock extends BlockBase {
  type: 'graph';
  spec: GraphSpec;
}

export interface FormBlock extends BlockBase {
  type: 'form';
  form: FormSpec;
}

export type ChartKind = 'line' | 'bar' | 'pie' | 'scatter';
export type GraphKind = 'chart' | 'diagram';
export type DiagramFormat = 'mermaid';

export type GraphSpec = ChartGraphSpec | DiagramGraphSpec;

export interface ChartGraphSpec {
  kind: 'chart';
  chart: ChartKind;
  data: unknown;
  options?: unknown;
}

export interface DiagramGraphSpec {
  kind: 'diagram';
  format: 'mermaid';
  source: string;
}

export type PassRuleMode = 'all_correct' | 'min_score';

export type PassRule = { mode: 'all_correct' } | { mode: 'min_score'; min: number };

export interface FormSpec {
  title?: string;
  questions: Question[];
  passRule?: PassRule;
}

export type QuestionType =
  'short_text' | 'long_text' | 'single_select' | 'multi_select' | 'boolean' | 'number';

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
  /** When omitted, the question is manual / unscored in v1. */
  expected?: string;
  /** Default false. */
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
  /** Absolute tolerance; default 0. */
  tolerance?: number;
}

export interface Option {
  id: OptionId;
  label: string;
}

/** Default pass rule when FormSpec.passRule is omitted. */
export const DEFAULT_PASS_RULE: PassRule = { mode: 'all_correct' };
