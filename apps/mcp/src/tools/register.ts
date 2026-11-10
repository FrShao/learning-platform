import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { LearningPlatformApi } from '../api/client.js';
import type { TreeOp } from '../api/types.js';

import * as handlers from './handlers.js';
import {
  addFormBlockInput,
  addGraphBlockInput,
  addImageBlockInput,
  addSectionInput,
  addTextBlockInput,
  applyTreeOpsInput,
  checkoutBranchInput,
  commitCourseInput,
  createBranchInput,
  createCourseInput,
  getCourseInput,
  getWorkingTreeInput,
  listCoursesInput,
  publishCourseInput,
  TOOL_DESCRIPTIONS,
  TOOL_NAMES,
  uploadAssetInput,
} from './schemas.js';

export interface RegisterToolsOptions {
  api: LearningPlatformApi;
  defaultOrgId?: string;
}

/**
 * Register plan §6 authoring tools on an MCP server instance.
 */
export function registerAuthoringTools(server: McpServer, options: RegisterToolsOptions): void {
  const ctx: handlers.ToolContext = {
    api: options.api,
    defaultOrgId: options.defaultOrgId,
  };

  server.registerTool(
    'list_courses',
    { description: TOOL_DESCRIPTIONS.list_courses, inputSchema: listCoursesInput },
    async (args) =>
      handlers.listCourses(ctx, {
        org_id: args.org_id,
      }),
  );

  server.registerTool(
    'get_course',
    { description: TOOL_DESCRIPTIONS.get_course, inputSchema: getCourseInput },
    async (args) => handlers.getCourse(ctx, { course_id: args.course_id }),
  );

  server.registerTool(
    'create_course',
    { description: TOOL_DESCRIPTIONS.create_course, inputSchema: createCourseInput },
    async (args) =>
      handlers.createCourse(ctx, {
        org_id: args.org_id,
        slug: args.slug,
        title: args.title,
        description: args.description,
      }),
  );

  server.registerTool(
    'checkout_branch',
    { description: TOOL_DESCRIPTIONS.checkout_branch, inputSchema: checkoutBranchInput },
    async (args) =>
      handlers.checkoutBranch(ctx, {
        course_id: args.course_id,
        branch: args.branch,
      }),
  );

  server.registerTool(
    'get_working_tree',
    { description: TOOL_DESCRIPTIONS.get_working_tree, inputSchema: getWorkingTreeInput },
    async (args) =>
      handlers.getWorkingTree(ctx, {
        course_id: args.course_id,
        branch: args.branch,
      }),
  );

  server.registerTool(
    'apply_tree_ops',
    { description: TOOL_DESCRIPTIONS.apply_tree_ops, inputSchema: applyTreeOpsInput },
    async (args) =>
      handlers.applyTreeOps(ctx, {
        course_id: args.course_id,
        branch: args.branch,
        ops: args.ops as TreeOp[],
      }),
  );

  server.registerTool(
    'add_section',
    { description: TOOL_DESCRIPTIONS.add_section, inputSchema: addSectionInput },
    async (args) =>
      handlers.addSection(ctx, {
        course_id: args.course_id,
        branch: args.branch,
        slug: args.slug,
        title: args.title,
        order: args.order,
        section_id: args.section_id,
      }),
  );

  server.registerTool(
    'add_text_block',
    { description: TOOL_DESCRIPTIONS.add_text_block, inputSchema: addTextBlockInput },
    async (args) =>
      handlers.addTextBlock(ctx, {
        course_id: args.course_id,
        branch: args.branch,
        section_id: args.section_id,
        block_id: args.block_id,
        markdown: args.markdown,
      }),
  );

  server.registerTool(
    'add_image_block',
    { description: TOOL_DESCRIPTIONS.add_image_block, inputSchema: addImageBlockInput },
    async (args) =>
      handlers.addImageBlock(ctx, {
        course_id: args.course_id,
        branch: args.branch,
        section_id: args.section_id,
        block_id: args.block_id,
        asset_id: args.asset_id,
        url: args.url,
        alt: args.alt,
      }),
  );

  server.registerTool(
    'add_graph_block',
    { description: TOOL_DESCRIPTIONS.add_graph_block, inputSchema: addGraphBlockInput },
    async (args) =>
      handlers.addGraphBlock(ctx, {
        course_id: args.course_id,
        branch: args.branch,
        section_id: args.section_id,
        block_id: args.block_id,
        spec: args.spec,
      }),
  );

  server.registerTool(
    'add_form_block',
    { description: TOOL_DESCRIPTIONS.add_form_block, inputSchema: addFormBlockInput },
    async (args) =>
      handlers.addFormBlock(ctx, {
        course_id: args.course_id,
        branch: args.branch,
        section_id: args.section_id,
        block_id: args.block_id,
        title: args.title,
        questions: args.questions,
        pass_rule: args.pass_rule,
        min_score: args.min_score,
      }),
  );

  server.registerTool(
    'commit_course',
    { description: TOOL_DESCRIPTIONS.commit_course, inputSchema: commitCourseInput },
    async (args) =>
      handlers.commitCourse(ctx, {
        course_id: args.course_id,
        branch: args.branch,
        message: args.message,
      }),
  );

  server.registerTool(
    'create_branch',
    { description: TOOL_DESCRIPTIONS.create_branch, inputSchema: createBranchInput },
    async (args) =>
      handlers.createBranch(ctx, {
        course_id: args.course_id,
        name: args.name,
        from_commit_id: args.from_commit_id,
      }),
  );

  server.registerTool(
    'publish_course',
    { description: TOOL_DESCRIPTIONS.publish_course, inputSchema: publishCourseInput },
    async (args) =>
      handlers.publishCourse(ctx, {
        course_id: args.course_id,
        commit_id: args.commit_id,
      }),
  );

  server.registerTool(
    'upload_asset',
    { description: TOOL_DESCRIPTIONS.upload_asset, inputSchema: uploadAssetInput },
    async (args) =>
      handlers.uploadAsset(ctx, {
        org_id: args.org_id,
        filename: args.filename,
        content_type: args.content_type,
        content_base64: args.content_base64,
        url: args.url,
      }),
  );
}

/** Expose registered tool names for contract tests. */
export function listRegisteredToolNames(): readonly string[] {
  return TOOL_NAMES;
}
