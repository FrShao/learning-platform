'use client';

import { useEffect, useState } from 'react';

import { AssetPreview } from '@/components/course/asset-preview';
import {
  createDefaultQuestion,
  newOptionId,
  newQuestionId,
} from '@/components/course/block-factories';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type {
  ChartKind,
  CourseBlockDto,
  FormSpecDto,
  GraphSpecDto,
  QuestionDto,
} from '@/lib/api/types';
import { errorMessage } from '@/lib/format';
import { resolveFormSpec } from '@/lib/learner/form-blocks';

function ensureGraphSpec(block: Extract<CourseBlockDto, { type: 'graph' }>): GraphSpecDto {
  if (block.spec?.kind === 'diagram' || block.spec?.kind === 'chart') {
    return block.spec;
  }
  if (typeof block.source === 'string' && block.source.length > 0) {
    return { kind: 'diagram', format: 'mermaid', source: block.source };
  }
  return { kind: 'diagram', format: 'mermaid', source: 'flowchart LR\n  A --> B' };
}

type SaveFn = (block: CourseBlockDto) => Promise<void>;

export function BlockInspector({
  orgId,
  block,
  onSave,
  onDelete,
  busy,
}: {
  /** Org for asset upload; null for personal courses (image upload disabled). */
  orgId: string | null;
  block: CourseBlockDto;
  onSave: SaveFn;
  onDelete: () => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<CourseBlockDto>(block);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDraft(block);
    setUploadError(null);
  }, [block]);

  async function save(next: CourseBlockDto = draft) {
    setDraft(next);
    await onSave(next);
  }

  async function onUpload(file: File | null) {
    if (!file || draft.type !== 'image') return;
    if (!orgId) {
      setUploadError('Image upload requires an organization-owned course.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const asset = await api.uploadAsset(orgId, file);
      const next: CourseBlockDto = {
        ...draft,
        type: 'image',
        assetId: asset.id,
        alt: draft.alt || file.name,
      };
      await save(next);
    } catch (err) {
      setUploadError(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="stack block-inspector">
      <div className="meta-row">
        <span className="badge">{draft.type}</span>
        <span className="muted">{draft.id}</span>
      </div>

      {draft.type === 'text' ? (
        <label className="field">
          <span>Markdown</span>
          <textarea
            rows={12}
            value={draft.markdown}
            onChange={(e) => setDraft({ ...draft, markdown: e.target.value })}
            onBlur={() => void save()}
          />
        </label>
      ) : null}

      {draft.type === 'image' ? (
        <>
          <label className="field">
            <span>Image file</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              disabled={busy || uploading}
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
          </label>
          {uploadError ? <p className="form-error">{uploadError}</p> : null}
          {uploading ? <p className="muted">Uploading…</p> : null}
          {draft.alt !== undefined ? (
            <AssetPreview assetId={draft.assetId} alt={draft.alt} />
          ) : (
            <AssetPreview assetId={draft.assetId} />
          )}
          <label className="field">
            <span>Alt text</span>
            <input
              value={draft.alt ?? ''}
              onChange={(e) => setDraft({ ...draft, alt: e.target.value })}
              onBlur={() => void save()}
            />
          </label>
          <label className="field">
            <span>Caption</span>
            <input
              value={draft.caption ?? ''}
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              onBlur={() => void save()}
            />
          </label>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            assetId: {draft.assetId || '—'}
          </p>
        </>
      ) : null}

      {draft.type === 'graph' ? (
        <GraphEditor
          block={draft}
          onChange={(next) => setDraft(next)}
          onBlurSave={() => void save()}
        />
      ) : null}

      {draft.type === 'form' ? (
        <FormEditor
          block={draft}
          onChange={(next) => setDraft(next)}
          onBlurSave={() => void save()}
        />
      ) : null}

      <div className="cta-row">
        <Button variant="secondary" disabled={busy} onClick={() => void save()}>
          Save block
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void onDelete()}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function GraphEditor({
  block,
  onChange,
  onBlurSave,
}: {
  block: Extract<CourseBlockDto, { type: 'graph' }>;
  onChange: (b: Extract<CourseBlockDto, { type: 'graph' }>) => void;
  onBlurSave: () => void;
}) {
  const spec = ensureGraphSpec(block);
  const kind = spec.kind;

  return (
    <>
      <label className="field">
        <span>Kind</span>
        <select
          value={kind}
          onChange={(e) => {
            const nextKind = e.target.value as 'chart' | 'diagram';
            if (nextKind === 'diagram') {
              onChange({
                ...block,
                spec: { kind: 'diagram', format: 'mermaid', source: 'flowchart LR\n  A --> B' },
              });
            } else {
              onChange({
                ...block,
                spec: {
                  kind: 'chart',
                  chart: 'bar',
                  data: {
                    labels: ['A', 'B'],
                    values: [1, 2],
                  },
                },
              });
            }
            onBlurSave();
          }}
        >
          <option value="diagram">Mermaid diagram</option>
          <option value="chart">Chart</option>
        </select>
      </label>

      {spec.kind === 'diagram' ? (
        <label className="field">
          <span>Mermaid source</span>
          <textarea
            rows={10}
            value={spec.source}
            onChange={(e) =>
              onChange({
                ...block,
                spec: { kind: 'diagram', format: 'mermaid', source: e.target.value },
              })
            }
            onBlur={onBlurSave}
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span>Chart type</span>
            <select
              value={spec.chart}
              onChange={(e) => {
                onChange({
                  ...block,
                  spec: {
                    kind: 'chart',
                    chart: e.target.value as ChartKind,
                    data: spec.kind === 'chart' ? spec.data : {},
                  },
                });
                onBlurSave();
              }}
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="pie">Pie</option>
              <option value="scatter">Scatter</option>
            </select>
          </label>
          <label className="field">
            <span>Chart data (JSON)</span>
            <textarea
              rows={10}
              value={JSON.stringify(spec.data, null, 2)}
              onChange={(e) => {
                try {
                  const data = JSON.parse(e.target.value) as unknown;
                  onChange({
                    ...block,
                    spec: {
                      kind: 'chart',
                      chart: spec.kind === 'chart' ? spec.chart : 'bar',
                      data,
                    },
                  });
                } catch {
                  // keep typing invalid JSON until blur
                }
              }}
              onBlur={(e) => {
                try {
                  const data = JSON.parse(e.target.value) as unknown;
                  onChange({
                    ...block,
                    spec: {
                      kind: 'chart',
                      chart: spec.kind === 'chart' ? spec.chart : 'bar',
                      data,
                    },
                  });
                  onBlurSave();
                } catch {
                  // ignore
                }
              }}
            />
          </label>
        </>
      )}
    </>
  );
}

function FormEditor({
  block,
  onChange,
  onBlurSave,
}: {
  block: Extract<CourseBlockDto, { type: 'form' }>;
  onChange: (b: Extract<CourseBlockDto, { type: 'form' }>) => void;
  onBlurSave: () => void;
}) {
  const form: FormSpecDto = resolveFormSpec(block);

  function updateQuestion(index: number, question: QuestionDto) {
    const questions = [...form.questions];
    questions[index] = question;
    onChange({ ...block, form: { ...form, questions } });
  }

  function removeQuestion(index: number) {
    if (form.questions.length <= 1) return;
    const questions = form.questions.filter((_, i) => i !== index);
    onChange({ ...block, form: { ...form, questions } });
    onBlurSave();
  }

  return (
    <>
      <label className="field">
        <span>Form title</span>
        <input
          value={form.title ?? ''}
          onChange={(e) => onChange({ ...block, form: { ...form, title: e.target.value } })}
          onBlur={onBlurSave}
        />
      </label>
      <label className="field">
        <span>Pass rule</span>
        <select
          value={form.passRule?.mode ?? 'all_correct'}
          onChange={(e) => {
            const mode = e.target.value as 'all_correct' | 'min_score';
            onChange({
              ...block,
              form: {
                ...form,
                passRule:
                  mode === 'min_score' ? { mode: 'min_score', min: 0.7 } : { mode: 'all_correct' },
              },
            });
            onBlurSave();
          }}
        >
          <option value="all_correct">All correct</option>
          <option value="min_score">Minimum score</option>
        </select>
      </label>
      {form.passRule?.mode === 'min_score' ? (
        <label className="field">
          <span>Minimum score (0–1)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={form.passRule.min}
            onChange={(e) =>
              onChange({
                ...block,
                form: {
                  ...form,
                  passRule: { mode: 'min_score', min: Number(e.target.value) },
                },
              })
            }
            onBlur={onBlurSave}
          />
        </label>
      ) : null}

      <div className="stack">
        <strong>Questions</strong>
        {form.questions.map((q, index) => (
          <div key={q.id} className="block-card" style={{ background: 'var(--panel)' }}>
            <label className="field">
              <span>Type</span>
              <select
                value={q.type}
                onChange={(e) => {
                  updateQuestion(
                    index,
                    changeQuestionType(q, e.target.value as QuestionDto['type']),
                  );
                  onBlurSave();
                }}
              >
                <option value="short_text">Short text</option>
                <option value="long_text">Long text</option>
                <option value="single_select">Single select</option>
                <option value="multi_select">Multi select</option>
                <option value="boolean">Boolean</option>
                <option value="number">Number</option>
              </select>
            </label>
            <label className="field">
              <span>Prompt</span>
              <input
                value={q.prompt}
                onChange={(e) => updateQuestion(index, { ...q, prompt: e.target.value })}
                onBlur={onBlurSave}
              />
            </label>
            <QuestionFields
              question={q}
              onChange={(next) => updateQuestion(index, next)}
              onBlurSave={onBlurSave}
            />
            <Button
              variant="ghost"
              disabled={form.questions.length <= 1}
              onClick={() => removeQuestion(index)}
            >
              Remove question
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() => {
            onChange({
              ...block,
              form: { ...form, questions: [...form.questions, createDefaultQuestion()] },
            });
            onBlurSave();
          }}
        >
          + Question
        </Button>
      </div>
    </>
  );
}

function QuestionFields({
  question,
  onChange,
  onBlurSave,
}: {
  question: QuestionDto;
  onChange: (q: QuestionDto) => void;
  onBlurSave: () => void;
}) {
  switch (question.type) {
    case 'short_text':
      return (
        <>
          <label className="field">
            <span>Expected answer (optional)</span>
            <input
              value={question.expected ?? ''}
              onChange={(e) => {
                const expected = e.target.value;
                if (expected) {
                  onChange({ ...question, expected });
                } else {
                  const { expected: _drop, ...rest } = question;
                  void _drop;
                  onChange(rest);
                }
              }}
              onBlur={onBlurSave}
            />
          </label>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={Boolean(question.caseSensitive)}
              onChange={(e) => {
                onChange({ ...question, caseSensitive: e.target.checked });
                onBlurSave();
              }}
            />
            <span>Case sensitive</span>
          </label>
        </>
      );
    case 'long_text':
      return (
        <label className="field">
          <span>Rubric (optional)</span>
          <textarea
            rows={3}
            value={question.rubric ?? ''}
            onChange={(e) => {
              const rubric = e.target.value;
              if (rubric) {
                onChange({ ...question, rubric });
              } else {
                const { rubric: _drop, ...rest } = question;
                void _drop;
                onChange(rest);
              }
            }}
            onBlur={onBlurSave}
          />
        </label>
      );
    case 'boolean':
      return (
        <label className="field">
          <span>Correct answer</span>
          <select
            value={question.correct ? 'true' : 'false'}
            onChange={(e) => {
              onChange({ ...question, correct: e.target.value === 'true' });
              onBlurSave();
            }}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </label>
      );
    case 'number':
      return (
        <>
          <label className="field">
            <span>Correct number</span>
            <input
              type="number"
              value={question.correct}
              onChange={(e) => onChange({ ...question, correct: Number(e.target.value) })}
              onBlur={onBlurSave}
            />
          </label>
          <label className="field">
            <span>Tolerance</span>
            <input
              type="number"
              value={question.tolerance ?? 0}
              onChange={(e) => onChange({ ...question, tolerance: Number(e.target.value) })}
              onBlur={onBlurSave}
            />
          </label>
        </>
      );
    case 'single_select':
    case 'multi_select':
      return (
        <SelectOptionsEditor question={question} onChange={onChange} onBlurSave={onBlurSave} />
      );
    default:
      return null;
  }
}

function SelectOptionsEditor({
  question,
  onChange,
  onBlurSave,
}: {
  question: Extract<QuestionDto, { type: 'single_select' | 'multi_select' }>;
  onChange: (q: QuestionDto) => void;
  onBlurSave: () => void;
}) {
  return (
    <div className="stack">
      <span className="muted">Options</span>
      {question.options.map((opt, i) => (
        <div key={opt.id} className="cta-row" style={{ alignItems: 'center' }}>
          <input
            style={{ flex: 1 }}
            value={opt.label}
            onChange={(e) => {
              const options = question.options.map((o, idx) =>
                idx === i ? { ...o, label: e.target.value } : o,
              );
              onChange({ ...question, options });
            }}
            onBlur={onBlurSave}
          />
          {question.type === 'single_select' ? (
            <label className="field checkbox-field" style={{ margin: 0 }}>
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correctOptionId === opt.id}
                onChange={() => {
                  onChange({ ...question, correctOptionId: opt.id });
                  onBlurSave();
                }}
              />
              <span>Correct</span>
            </label>
          ) : (
            <label className="field checkbox-field" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={question.correctOptionIds.includes(opt.id)}
                onChange={(e) => {
                  const correctOptionIds = e.target.checked
                    ? [...question.correctOptionIds, opt.id]
                    : question.correctOptionIds.filter((id) => id !== opt.id);
                  onChange({ ...question, correctOptionIds });
                  onBlurSave();
                }}
              />
              <span>Correct</span>
            </label>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => {
          onChange({
            ...question,
            options: [...question.options, { id: newOptionId(), label: 'New option' }],
          });
          onBlurSave();
        }}
      >
        + Option
      </Button>
    </div>
  );
}

function changeQuestionType(current: QuestionDto, type: QuestionDto['type']): QuestionDto {
  const base = { id: current.id || newQuestionId(), prompt: current.prompt };
  switch (type) {
    case 'short_text':
      return { ...base, type: 'short_text' };
    case 'long_text':
      return { ...base, type: 'long_text' };
    case 'boolean':
      return { ...base, type: 'boolean', correct: true };
    case 'number':
      return { ...base, type: 'number', correct: 0, tolerance: 0 };
    case 'single_select': {
      const a = newOptionId();
      const b = newOptionId();
      return {
        ...base,
        type: 'single_select',
        options: [
          { id: a, label: 'Option A' },
          { id: b, label: 'Option B' },
        ],
        correctOptionId: a,
      };
    }
    case 'multi_select': {
      const a = newOptionId();
      const b = newOptionId();
      return {
        ...base,
        type: 'multi_select',
        options: [
          { id: a, label: 'Option A' },
          { id: b, label: 'Option B' },
        ],
        correctOptionIds: [a],
      };
    }
    default:
      return current;
  }
}
