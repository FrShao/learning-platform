import { randomUUID } from 'node:crypto';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { LearningPlatformApi } from '../api/client.js';
import { ApiClientError, type TreeOp } from '../api/types.js';

export interface ToolContext {
  api: LearningPlatformApi;
  defaultOrgId: string | undefined;
}

function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(err: unknown): CallToolResult {
  if (err instanceof ApiClientError) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                code: err.code,
                message: err.message,
                status: err.status,
                details: err.details,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: { code: 'internal', message } }),
      },
    ],
  };
}

function requireOrgId(orgId: string | undefined, defaultOrgId: string | undefined): string {
  const resolved = orgId ?? defaultOrgId;
  if (!resolved) {
    throw new Error('org_id is required (pass org_id or set LP_ORG_ID)');
  }
  return resolved;
}

function newId(): string {
  return randomUUID();
}

function branchOrMain(branch: string | undefined): string {
  return branch ?? 'main';
}

export async function listCourses(
  ctx: ToolContext,
  args: { org_id: string | undefined },
): Promise<CallToolResult> {
  try {
    const orgId = requireOrgId(args.org_id, ctx.defaultOrgId);
    return jsonResult(await ctx.api.listCourses(orgId));
  } catch (err) {
    return errorResult(err);
  }
}

export async function getCourse(
  ctx: ToolContext,
  args: { course_id: string },
): Promise<CallToolResult> {
  try {
    const [course, branches] = await Promise.all([
      ctx.api.getCourse(args.course_id),
      ctx.api.getCourseBranches(args.course_id),
    ]);
    return jsonResult({ course, branches });
  } catch (err) {
    return errorResult(err);
  }
}

export async function createCourse(
  ctx: ToolContext,
  args: {
    org_id: string | undefined;
    slug: string;
    title: string;
    description: string | undefined;
  },
): Promise<CallToolResult> {
  try {
    const orgId = requireOrgId(args.org_id, ctx.defaultOrgId);
    const body: { slug: string; title: string; description?: string } = {
      slug: args.slug,
      title: args.title,
    };
    if (args.description !== undefined) {
      body.description = args.description;
    }
    return jsonResult(await ctx.api.createCourse(orgId, body));
  } catch (err) {
    return errorResult(err);
  }
}

export async function checkoutBranch(
  ctx: ToolContext,
  args: { course_id: string; branch: string | undefined },
): Promise<CallToolResult> {
  try {
    return jsonResult(await ctx.api.checkoutBranch(args.course_id, branchOrMain(args.branch)));
  } catch (err) {
    return errorResult(err);
  }
}

export async function getWorkingTree(
  ctx: ToolContext,
  args: { course_id: string; branch: string | undefined },
): Promise<CallToolResult> {
  try {
    return jsonResult(await ctx.api.getWorkingTree(args.course_id, branchOrMain(args.branch)));
  } catch (err) {
    return errorResult(err);
  }
}

export async function applyTreeOps(
  ctx: ToolContext,
  args: { course_id: string; branch: string | undefined; ops: TreeOp[] },
): Promise<CallToolResult> {
  try {
    return jsonResult(
      await ctx.api.applyTreeOps(args.course_id, branchOrMain(args.branch), args.ops),
    );
  } catch (err) {
    return errorResult(err);
  }
}

export async function addSection(
  ctx: ToolContext,
  args: {
    course_id: string;
    branch: string | undefined;
    slug: string;
    title: string;
    order: number | undefined;
    section_id: string | undefined;
  },
): Promise<CallToolResult> {
  const op: TreeOp = {
    op: 'upsert_section',
    section: {
      id: args.section_id ?? newId(),
      slug: args.slug,
      title: args.title,
      order: args.order ?? 0,
    },
  };
  return applyTreeOps(ctx, {
    course_id: args.course_id,
    branch: args.branch,
    ops: [op],
  });
}

export async function addTextBlock(
  ctx: ToolContext,
  args: {
    course_id: string;
    branch: string | undefined;
    section_id: string;
    block_id: string | undefined;
    markdown: string;
  },
): Promise<CallToolResult> {
  const op: TreeOp = {
    op: 'upsert_block',
    section_id: args.section_id,
    block: {
      id: args.block_id ?? newId(),
      type: 'text',
      markdown: args.markdown,
    },
  };
  return applyTreeOps(ctx, {
    course_id: args.course_id,
    branch: args.branch,
    ops: [op],
  });
}

export async function addImageBlock(
  ctx: ToolContext,
  args: {
    course_id: string;
    branch: string | undefined;
    section_id: string;
    block_id: string | undefined;
    asset_id: string | undefined;
    url: string | undefined;
    alt: string | undefined;
  },
): Promise<CallToolResult> {
  if (!args.asset_id && !args.url) {
    return errorResult(new Error('add_image_block requires asset_id or url'));
  }
  const block: Record<string, unknown> = {
    id: args.block_id ?? newId(),
    type: 'image',
  };
  if (args.asset_id !== undefined) block['asset_id'] = args.asset_id;
  if (args.url !== undefined) block['url'] = args.url;
  if (args.alt !== undefined) block['alt'] = args.alt;

  const op: TreeOp = {
    op: 'upsert_block',
    section_id: args.section_id,
    block,
  };
  return applyTreeOps(ctx, {
    course_id: args.course_id,
    branch: args.branch,
    ops: [op],
  });
}

export async function addGraphBlock(
  ctx: ToolContext,
  args: {
    course_id: string;
    branch: string | undefined;
    section_id: string;
    block_id: string | undefined;
    spec: Record<string, unknown>;
  },
): Promise<CallToolResult> {
  const op: TreeOp = {
    op: 'upsert_block',
    section_id: args.section_id,
    block: {
      id: args.block_id ?? newId(),
      type: 'graph',
      spec: args.spec,
    },
  };
  return applyTreeOps(ctx, {
    course_id: args.course_id,
    branch: args.branch,
    ops: [op],
  });
}

export async function addFormBlock(
  ctx: ToolContext,
  args: {
    course_id: string;
    branch: string | undefined;
    section_id: string;
    block_id: string | undefined;
    title: string | undefined;
    questions: Array<Record<string, unknown>>;
    pass_rule: 'all_correct' | 'min_score' | undefined;
    min_score: number | undefined;
  },
): Promise<CallToolResult> {
  const block: Record<string, unknown> = {
    id: args.block_id ?? newId(),
    type: 'form',
    questions: args.questions,
  };
  if (args.title !== undefined) block['title'] = args.title;
  if (args.pass_rule !== undefined) block['pass_rule'] = args.pass_rule;
  if (args.min_score !== undefined) block['min_score'] = args.min_score;

  const op: TreeOp = {
    op: 'upsert_block',
    section_id: args.section_id,
    block,
  };
  return applyTreeOps(ctx, {
    course_id: args.course_id,
    branch: args.branch,
    ops: [op],
  });
}

export async function commitCourse(
  ctx: ToolContext,
  args: { course_id: string; branch: string | undefined; message: string },
): Promise<CallToolResult> {
  try {
    return jsonResult(
      await ctx.api.commitCourse(args.course_id, branchOrMain(args.branch), args.message),
    );
  } catch (err) {
    return errorResult(err);
  }
}

export async function createBranch(
  ctx: ToolContext,
  args: { course_id: string; name: string; from_commit_id: string },
): Promise<CallToolResult> {
  try {
    return jsonResult(
      await ctx.api.createBranch(args.course_id, {
        name: args.name,
        from_commit_id: args.from_commit_id,
      }),
    );
  } catch (err) {
    return errorResult(err);
  }
}

export async function publishCourse(
  ctx: ToolContext,
  args: { course_id: string; commit_id: string },
): Promise<CallToolResult> {
  try {
    return jsonResult(await ctx.api.publishCourse(args.course_id, args.commit_id));
  } catch (err) {
    return errorResult(err);
  }
}

export async function uploadAsset(
  ctx: ToolContext,
  args: {
    org_id: string | undefined;
    filename: string;
    content_type: string | undefined;
    content_base64: string | undefined;
    url: string | undefined;
  },
): Promise<CallToolResult> {
  try {
    if (!args.content_base64 && !args.url) {
      throw new Error('upload_asset requires content_base64 or url');
    }
    const orgId = requireOrgId(args.org_id, ctx.defaultOrgId);
    const body: {
      filename: string;
      content_type?: string;
      content_base64?: string;
      url?: string;
    } = { filename: args.filename };
    if (args.content_type !== undefined) body.content_type = args.content_type;
    if (args.content_base64 !== undefined) body.content_base64 = args.content_base64;
    if (args.url !== undefined) body.url = args.url;
    return jsonResult(await ctx.api.uploadAsset(orgId, body));
  } catch (err) {
    return errorResult(err);
  }
}
