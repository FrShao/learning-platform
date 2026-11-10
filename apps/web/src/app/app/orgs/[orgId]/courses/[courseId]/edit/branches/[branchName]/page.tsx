'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CourseContextBar } from '@/components/course/course-context-bar';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { CourseBranchDto, CourseSectionDto, WorkingTreeDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function CourseEditorPage() {
  const { orgId, courseId, branchName } = useParams<{
    orgId: string;
    courseId: string;
    branchName: string;
  }>();
  const decodedBranch = decodeURIComponent(branchName);

  const [branches, setBranches] = useState<CourseBranchDto[]>([]);
  const [tree, setTree] = useState<WorkingTreeDto | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [patchError, setPatchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchData, treeData] = await Promise.all([
        api.listBranches(courseId).catch(() => [] as CourseBranchDto[]),
        api.getWorkingTree(courseId, decodedBranch),
      ]);
      setBranches(branchData);
      setTree(treeData);
      const first = treeData.dirtyTree.sections[0];
      setSelectedSectionId(first?.id ?? null);
      setSelectedBlockId(first?.blocks[0]?.id ?? null);
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

  const dirty = useMemo(() => {
    if (!tree) return false;
    // Shell heuristic: non-empty tree or any content counts as potentially dirty;
    // Diff endpoint is authoritative.
    return tree.dirtyTree.sections.length > 0;
  }, [tree]);

  async function addSection() {
    if (!tree) return;
    setSaveState('saving');
    setPatchError(null);
    const id = `sec_${crypto.randomUUID().slice(0, 8)}`;
    const order = sections.length;
    try {
      const next = await api.patchWorkingTree(courseId, decodedBranch, [
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
      ]);
      setTree(next);
      setSelectedSectionId(id);
      setSelectedBlockId(null);
      setSaveState('saved');
    } catch (err) {
      setPatchError(errorMessage(err));
      setSaveState('error');
    }
  }

  async function addTextBlock() {
    if (!tree || !selectedSection) return;
    setSaveState('saving');
    setPatchError(null);
    const id = `blk_${crypto.randomUUID().slice(0, 8)}`;
    try {
      const next = await api.patchWorkingTree(courseId, decodedBranch, [
        {
          op: 'upsert_block',
          sectionId: selectedSection.id,
          block: { id, type: 'text', markdown: 'New text block' },
        },
      ]);
      setTree(next);
      setSelectedBlockId(id);
      setSaveState('saved');
    } catch (err) {
      setPatchError(errorMessage(err));
      setSaveState('error');
    }
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
        <Link className="btn btn-ghost" href={`/app/orgs/${orgId}/courses/${courseId}`}>
          Overview
        </Link>
      </div>

      <CourseContextBar
        orgId={orgId}
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
                  {s.blocks.length} blocks
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
          ) : selectedSection.blocks.length === 0 ? (
            <EmptyState
              title="Empty section"
              description="Add a text, image, graph, or form block."
              action={
                <Button variant="secondary" onClick={() => void addTextBlock()}>
                  + Text
                </Button>
              }
            />
          ) : (
            <>
              {selectedSection.blocks.map((b) => (
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
                  {b.type === 'text' ? <p style={{ margin: '0.4rem 0 0' }}>{b.markdown}</p> : null}
                  {b.type === 'image' ? (
                    <p style={{ margin: '0.4rem 0 0' }}>asset {b.assetId}</p>
                  ) : null}
                  {b.type === 'graph' ? (
                    <p style={{ margin: '0.4rem 0 0' }}>
                      {b.kind}: {b.source.slice(0, 80)}
                    </p>
                  ) : null}
                  {b.type === 'form' ? (
                    <p style={{ margin: '0.4rem 0 0' }}>
                      {b.title} · {b.passRule}
                    </p>
                  ) : null}
                </button>
              ))}
              <div className="cta-row" style={{ marginTop: '0.75rem' }}>
                <Button variant="secondary" onClick={() => void addTextBlock()}>
                  + Text
                </Button>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  Image / graph / form editors land in follow-up slices.
                </span>
              </div>
            </>
          )}
        </section>

        <aside className="editor-pane">
          <h3>Block props</h3>
          {!selectedBlock ? (
            <p className="muted">Select a block to inspect properties.</p>
          ) : (
            <div className="stack">
              <div className="meta-row">
                <span className="badge">{selectedBlock.type}</span>
                <span className="muted">{selectedBlock.id}</span>
              </div>
              <pre className="code-pre">{JSON.stringify(selectedBlock, null, 2)}</pre>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
