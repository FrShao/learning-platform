import { describe, expect, it } from 'vitest';

import type { ContentBlock, FormSpec } from './types.js';
import { validateContentBlock, validateFormSpec, validateGraphSpec } from './validate.js';

describe('validateFormSpec', () => {
  it('accepts a well-formed form', () => {
    const form: FormSpec = {
      title: 'Quiz',
      passRule: { mode: 'min_score', min: 0.75 },
      questions: [
        {
          id: 'q1',
          type: 'single_select',
          prompt: 'Pick',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          correctOptionId: 'a',
        },
        {
          id: 'q2',
          type: 'number',
          prompt: 'n',
          correct: 1,
          tolerance: 0,
        },
      ],
    };
    expect(validateFormSpec(form)).toEqual({ ok: true });
  });

  it('rejects empty questions, bad pass rules, and broken select keys', () => {
    expect(validateFormSpec({ questions: [] }).ok).toBe(false);
    expect(
      validateFormSpec({
        passRule: { mode: 'min_score', min: 2 },
        questions: [{ id: 'q', type: 'boolean', prompt: '?', correct: true }],
      }).ok,
    ).toBe(false);
    expect(
      validateFormSpec({
        questions: [
          {
            id: 'q',
            type: 'single_select',
            prompt: '?',
            options: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            correctOptionId: 'missing',
          },
        ],
      }).ok,
    ).toBe(false);
  });
});

describe('validateGraphSpec / validateContentBlock', () => {
  it('validates chart and mermaid diagram specs', () => {
    expect(validateGraphSpec({ kind: 'chart', chart: 'line', data: { series: [] } })).toEqual({
      ok: true,
    });
    expect(
      validateGraphSpec({ kind: 'diagram', format: 'mermaid', source: 'graph TD; A-->B' }),
    ).toEqual({ ok: true });
    expect(validateGraphSpec({ kind: 'diagram', format: 'mermaid', source: '' }).ok).toBe(false);
  });

  it('validates each content block variant', () => {
    const text: ContentBlock = { id: 'b1', type: 'text', markdown: '# Hi' };
    const image: ContentBlock = { id: 'b2', type: 'image', assetId: 'asset_1', alt: 'diagram' };
    const graph: ContentBlock = {
      id: 'b3',
      type: 'graph',
      spec: { kind: 'diagram', format: 'mermaid', source: 'graph LR; A-->B' },
    };
    const form: ContentBlock = {
      id: 'b4',
      type: 'form',
      form: {
        questions: [{ id: 'q', type: 'boolean', prompt: '?', correct: true }],
      },
    };

    expect(validateContentBlock(text)).toEqual({ ok: true });
    expect(validateContentBlock(image)).toEqual({ ok: true });
    expect(validateContentBlock(graph)).toEqual({ ok: true });
    expect(validateContentBlock(form)).toEqual({ ok: true });
    expect(validateContentBlock({ id: 'x', type: 'image', assetId: '' }).ok).toBe(false);
  });
});
