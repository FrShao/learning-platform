/** Wire types aligned with plan §5 (`/v1`, snake_case JSON). */

export type TreeOp =
  | {
      op: 'upsert_section';
      section: {
        id: string;
        slug: string;
        title: string;
        order: number;
        blocks?: unknown[];
      };
    }
  | { op: 'delete_section'; section_id: string }
  | { op: 'reorder_sections'; section_ids: string[] }
  | { op: 'upsert_block'; section_id: string; block: Record<string, unknown> }
  | { op: 'delete_block'; section_id: string; block_id: string }
  | { op: 'reorder_blocks'; section_id: string; block_ids: string[] };

export interface CreateCourseBody {
  slug: string;
  title: string;
  description?: string;
}

export interface CreateBranchBody {
  name: string;
  from_commit_id: string;
}

export interface ApplyTreeOpsBody {
  ops: TreeOp[];
}

export interface CommitBody {
  message: string;
}

export interface PublishBody {
  commit_id: string;
}

export interface UploadAssetBody {
  filename: string;
  content_type?: string;
  /** Base64-encoded bytes (JSON stub until multipart landing). */
  content_base64?: string;
  /** Remote URL to ingest when bytes are not provided. */
  url?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
