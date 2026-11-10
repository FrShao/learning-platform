import { z } from 'zod';

/** Shared / reusable field schemas for authoring tools. */

export const orgIdSchema = z.string().min(1).describe('Organization id');
export const courseIdSchema = z.string().min(1).describe('Course id');
export const branchNameSchema = z
  .string()
  .min(1)
  .default('main')
  .describe('Branch name (default main)');

export const treeOpSchema = z
  .object({
    op: z.enum([
      'upsert_section',
      'delete_section',
      'reorder_sections',
      'upsert_block',
      'delete_block',
      'reorder_blocks',
    ]),
  })
  .passthrough();

export const listCoursesInput = {
  org_id: orgIdSchema.optional().describe('Org id; falls back to LP_ORG_ID'),
};

export const getCourseInput = {
  course_id: courseIdSchema,
};

export const createCourseInput = {
  org_id: orgIdSchema.optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
};

export const checkoutBranchInput = {
  course_id: courseIdSchema,
  branch: branchNameSchema,
};

export const getWorkingTreeInput = {
  course_id: courseIdSchema,
  branch: branchNameSchema,
};

export const applyTreeOpsInput = {
  course_id: courseIdSchema,
  branch: branchNameSchema,
  ops: z.array(treeOpSchema).min(1),
};

export const addSectionInput = {
  course_id: courseIdSchema,
  branch: branchNameSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative().optional(),
  section_id: z.string().min(1).optional(),
};

export const addBlockBase = {
  course_id: courseIdSchema,
  branch: branchNameSchema,
  section_id: z.string().min(1),
  block_id: z.string().min(1).optional(),
};

export const addTextBlockInput = {
  ...addBlockBase,
  markdown: z.string().min(1),
};

export const addImageBlockInput = {
  ...addBlockBase,
  asset_id: z.string().min(1).optional(),
  url: z.string().url().optional(),
  alt: z.string().optional(),
};

export const addGraphBlockInput = {
  ...addBlockBase,
  spec: z.record(z.string(), z.unknown()),
};

export const addFormBlockInput = {
  ...addBlockBase,
  title: z.string().optional(),
  questions: z.array(z.record(z.string(), z.unknown())).min(1),
  pass_rule: z.enum(['all_correct', 'min_score']).optional(),
  min_score: z.number().optional(),
};

export const commitCourseInput = {
  course_id: courseIdSchema,
  branch: branchNameSchema,
  message: z.string().min(1),
};

export const createBranchInput = {
  course_id: courseIdSchema,
  name: z.string().min(1),
  from_commit_id: z.string().min(1),
};

export const publishCourseInput = {
  course_id: courseIdSchema,
  commit_id: z.string().min(1),
};

export const uploadAssetInput = {
  org_id: orgIdSchema.optional(),
  filename: z.string().min(1),
  content_type: z.string().optional(),
  content_base64: z.string().optional(),
  url: z.string().url().optional(),
};

/** Canonical tool names from plan §6. */
export const TOOL_NAMES = [
  'list_courses',
  'get_course',
  'create_course',
  'checkout_branch',
  'get_working_tree',
  'apply_tree_ops',
  'add_section',
  'add_text_block',
  'add_image_block',
  'add_graph_block',
  'add_form_block',
  'commit_course',
  'create_branch',
  'publish_course',
  'upload_asset',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  list_courses: 'List courses for an organization',
  get_course: 'Get course metadata and branches',
  create_course: 'Create a course (initializes branch main)',
  checkout_branch: 'Ensure a working tree exists for a branch',
  get_working_tree: 'Get the dirty working tree for a branch',
  apply_tree_ops: 'Apply partial tree ops (PATCH working tree)',
  add_section: 'Convenience: upsert a section via tree ops',
  add_text_block: 'Convenience: upsert a text block in a section',
  add_image_block: 'Convenience: upsert an image block in a section',
  add_graph_block: 'Convenience: upsert a graph/chart block in a section',
  add_form_block: 'Convenience: upsert a form/assessment block in a section',
  commit_course: 'Commit the working tree on a branch',
  create_branch: 'Create a named branch from a commit',
  publish_course: 'Publish a specific commit',
  upload_asset: 'Upload or ingest an asset (JSON stub for multipart)',
};
