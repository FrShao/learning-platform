'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  blockSummary,
  createFormBlock,
  createGraphBlock,
  createTextBlock,
} from '@/components/course/block-factories';
import { BlockInspector } from '@/components/course/block-inspector';
import { CourseContextBar } from '@/components/course/course-context-bar';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type {
  CourseBlockDto,
  CourseBranchDto,
  CourseSectionDto,
  WorkingTreeDto,
} from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function CourseEditorPage() {
  const { courseId, branchName } = useParams<{
    courseId: string;
    branchName: string;
  }>();
  const orgId: string | null = null;
  const decodedBranch = decodeURIComponent(branchName);

  const [branches, setBranches] = useState<CourseBranchDto[]>([]);
  const [tree, setTree] = useState<WorkingTreeDto | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [patchError, setPatchError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchData, treeData, diff] = await Promise.all([
        api.listBranches(courseId).catch(() => [] as CourseBranchDto[]),
        api.getWorkingTree(courseId, decodedBranch),
        api.getDiff(courseId, decodedBranch).catch(() => null),
      ]);
      setBranches(branchData);
      setTree(treeData);
      setSelectedSectionId((prev) => {
        if (prev && treeData.dirtyTree.sections.some((s) => s.id === prev)) return prev;
        return treeData.dirtyTree.sections[0]?.id ?? null;
      });
      setSelectedBlockId((prev) => {
        const section =
          treeData.dirtyTree.sections.find((s) => s.blocks.some((b) => b.id === prev)) ??
          treeData.dirtyTree.sections[0];
        if (prev && section?.blocks.some((b) => b.id === prev)) return prev;
        return section?.blocks[0]?.id ?? null;
      });
      const hasDiff =
        diff != null &&
        (diff.clean === false || (diff.hunks?.length ?? 0) > 0 || Boolean(diff.summary));
      setDirty(hasDiff || treeData.dirtyTree.sections.length > 0);
    } catch (err) {
      setError(errorMessage(err, 'Could not load working tree'));
    } finally {
      setLoading(false);
    }
  }, [courseId, decodedBranch]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(
    () =>
      tree
        ? [...tree.dirtyTree.sections].sort((a, b) => a.order - b.order)
        : ([] as CourseSectionDto[]),
    [tree],
  );

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;
  const selectedBlock =
    selectedSection?.blocks.find((b) => b.id === selectedBlockId) ??
    selectedSection?.blocks[0] ??
    null;

  async function applyOps(
    ops: unknown[],
    select?: { sectionId?: string; blockId?: string | null },
  ) {
    setSaveState('saving');
    setPatchError(null);
    try {
      const next = await api.patchWorkingTree(courseId, decodedBranch, ops);
      setTree(next);
      if (select?.sectionId !== undefined) setSelectedSectionId(select.sectionId);
      if (select && 'blockId' in select) setSelectedBlockId(select.blockId ?? null);
      setDirty(true);
      setSaveState('saved');
      return next;
    } catch (err) {
      setPatchError(errorMessage(err));
      setSaveState('error');
      throw err;
    }
  }

  async function addSection() {
    if (!tree) return;
    const id = `sec_${crypto.randomUUID().slice(0, 8)}`;
    const order = sections.length;
    await applyOps(
      [
        {
          op: 'upsert_section',
          section: {
            id,
            slug: `section-${order + 1}`,
            title: `Section ${order + 1}`,
            order,
            blocks: [],
          },
        },
      ],
      { sectionId: id, blockId: null },
    );
  }

  async function saveSectionMeta(section: CourseSectionDto, title: string, slug: string) {
    await applyOps([
      {
        op: 'upsert_section',
        section: {
          id: section.id,
          slug: slug.trim() || section.slug,
          title: title.trim() || section.title,
          order: section.order,
          blocks: section.blocks,
        },
      },
    ]);
  }

  async function deleteSection(sectionId: string) {
    if (!confirm('Delete this section and its blocks?')) return;
    const nextSectionId = sections.find((s) => s.id !== sectionId)?.id;
    await applyOps(
      [{ op: 'delete_section', sectionId }],
      nextSectionId ? { sectionId: nextSectionId, blockId: null } : { blockId: null },
    );
    if (!nextSectionId) setSelectedSectionId(null);
  }

  async function addBlock(factory: () => CourseBlockDto) {
    if (!selectedSection) return;
    const block = factory();
    await applyOps([{ op: 'upsert_block', sectionId: selectedSection.id, block }], {
      sectionId: selectedSection.id,
      blockId: block.id,
    });
  }

  async function addImageBlock() {
    if (!selectedSection) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        setSaveState('saving');
        setPatchError(null);
        try {
          if (!orgId) throw new Error('Image upload requires an organization-owned course');
          const asset = await api.uploadAsset(orgId, file);
          const block: CourseBlockDto = {
            id: `blk_${crypto.randomUUID().slice(0, 8)}`,
            type: 'image',
            assetId: asset.id,
            alt: file.name,
          };
          await applyOps([{ op: 'upsert_block', sectionId: selectedSection.id, block }], {
            sectionId: selectedSection.id,
            blockId: block.id,
          });
        } catch (err) {
          setPatchError(errorMessage(err, 'Image upload failed'));
          setSaveState('error');
        }
      })();
    };
    input.click();
  }

  async function saveBlock(block: CourseBlockDto) {
    if (!selectedSection) return;
    if (block.type === 'image' && !block.assetId) {
      setPatchError('Image blocks need an uploaded asset before saving.');
      setSaveState('error');
      return;
    }
    await applyOps([{ op: 'upsert_block', sectionId: selectedSection.id, block }]);
  }

  async function deleteBlock(blockId: string) {
    if (!selectedSection) return;
    if (!confirm('Delete this block?')) return;
    const remaining = selectedSection.blocks.filter((b) => b.id !== blockId);
    await applyOps([{ op: 'delete_block', sectionId: selectedSection.id, blockId }], {
      sectionId: selectedSection.id,
      blockId: remaining[0]?.id ?? null,
    });
  }

  if (loading) return <LoadingBlock label="Loading working tree…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!tree) return <EmptyState title="Working tree unavailable" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Course editor</h1>
          <p>
            Working tree on <strong>{decodedBranch}</strong>
            {tree.baseCommitId ? ` · base ${tree.baseCommitId.slice(0, 8)}…` : ' · no base commit'}
            {saveState === 'saving' ? ' · Saving…' : null}
            {saveState === 'saved' ? ' · Saved' : null}
            {saveState === 'error' ? ' · Save failed' : null}
          </p>
        </div>
        <Link className="btn btn-ghost" href={`/app/me/courses/${courseId}`}>
          Overview
        </Link>
      </div>

      <CourseContextBar
        orgId={orgId}
        basePath={`/app/me/courses/${courseId}`}
        courseId={courseId}
        branchName={decodedBranch}
        branches={
          branches.length ? branches : [{ name: decodedBranch, headCommitId: tree.baseCommitId }]
        }
        baseCommitId={tree.baseCommitId}
        dirty={dirty}
        onCommitted={() => void load()}
        onPublished={() => void load()}
      />

      {patchError ? <p className="form-error">{patchError}</p> : null}

      <div className="editor-shell">
        <aside className="editor-pane">
          <h3>Sections</h3>
          {sections.length === 0 ? (
            <p className="muted">No sections yet.</p>
          ) : (
            sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === selectedSectionId ? 'section-item active' : 'section-item'}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => {
                  setSelectedSectionId(s.id);
                  setSelectedBlockId(s.blocks[0]?.id ?? null);
                }}
              >
                <strong>
                  {s.order + 1}. {s.title}
                </strong>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {s.blocks.length} blocks · /{s.slug}
                </div>
              </button>
            ))
          )}
          <Button variant="secondary" onClick={() => void addSection()}>
            + Section
          </Button>
        </aside>

        <section className="editor-pane">
          <h3>
            {selectedSection
              ? `${selectedSection.title} · /${selectedSection.slug}`
              : 'Select a section'}
          </h3>
          {!selectedSection ? (
            <EmptyState title="No section selected" description="Add or select a section." />
          ) : (
            <>
              <SectionMetaForm
                key={selectedSection.id}
                section={selectedSection}
                busy={saveState === 'saving'}
                onSave={(title, slug) => void saveSectionMeta(selectedSection, title, slug)}
                onDelete={() => void deleteSection(selectedSection.id)}
              />

              {selectedSection.blocks.length === 0 ? (
                <EmptyState
                  title="Empty section"
                  description="Add a text, image, graph, or form block."
                />
              ) : (
                selectedSection.blocks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="block-card"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      outline: b.id === selectedBlock?.id ? '2px solid var(--accent)' : undefined,
                    }}
                    onClick={() => setSelectedBlockId(b.id)}
                  >
                    <div className="meta-row">
                      <span className="badge">{b.type}</span>
                      <span className="muted">{b.id}</span>
                    </div>
                    <p style={{ margin: '0.4rem 0 0' }}>{blockSummary(b)}</p>
                  </button>
                ))
              )}

              <div className="cta-row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => void addBlock(createTextBlock)}>
                  + Text
                </Button>
                <Button variant="secondary" onClick={() => void addImageBlock()}>
                  + Image
                </Button>
                <Button variant="secondary" onClick={() => void addBlock(createGraphBlock)}>
                  + Graph
                </Button>
                <Button variant="secondary" onClick={() => void addBlock(createFormBlock)}>
                  + Form
                </Button>
              </div>
            </>
          )}
        </section>

        <aside className="editor-pane">
          <h3>Block props</h3>
          {!selectedBlock || !selectedSection ? (
            <p className="muted">Select a block to edit properties.</p>
          ) : (
            <BlockInspector
              key={selectedBlock.id}
              orgId={orgId}
              block={selectedBlock}
              busy={saveState === 'saving'}
              onSave={saveBlock}
              onDelete={() => deleteBlock(selectedBlock.id)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionMetaForm({
  section,
  busy,
  onSave,
  onDelete,
}: {
  section: CourseSectionDto;
  busy: boolean;
  onSave: (title: string, slug: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [slug, setSlug] = useState(section.slug);

  return (
    <div className="stack" style={{ marginBottom: '1rem' }}>
      <label className="field">
        <span>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== section.title || slug !== section.slug) onSave(title, slug);
          }}
        />
      </label>
      <label className="field">
        <span>Slug</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onBlur={() => {
            if (title !== section.title || slug !== section.slug) onSave(title, slug);
          }}
        />
      </label>
      <div className="cta-row">
        <Button variant="secondary" disabled={busy} onClick={() => onSave(title, slug)}>
          Save section
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onDelete}>
          Delete section
        </Button>
      </div>
    </div>
  );
}
