import type { AssetId, OrgId, UserId } from '../ids.js';

/** Org-scoped uploaded blob referenced by image blocks. */
export interface Asset {
  id: AssetId;
  orgId: OrgId;
  mime: string;
  size: number;
  storageKey: string;
  originalFilename: string | null;
  createdBy: UserId;
  createdAt: Date;
  deletedAt: Date | null;
}

/** Image MIME types accepted for v1 uploads. */
export const ASSET_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

export type AssetAllowedMime = (typeof ASSET_ALLOWED_MIME)[number];

/** Default max upload size (5 MiB). */
export const DEFAULT_MAX_ASSET_BYTES = 5 * 1024 * 1024;

export function isAllowedAssetMime(mime: string): mime is AssetAllowedMime {
  return (ASSET_ALLOWED_MIME as readonly string[]).includes(mime);
}
