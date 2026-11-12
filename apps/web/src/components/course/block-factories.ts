import type { CourseBlockDto, QuestionDto } from '@/lib/api/types';

export function newBlockId(): string {
  return `blk_${crypto.randomUUID().slice(0, 8)}`;
}

export function newQuestionId(): string {
  return `q_${crypto.randomUUID().slice(0, 8)}`;
}

export function newOptionId(): string {
  return `opt_${crypto.randomUUID().slice(0, 8)}`;
}

export function createTextBlock(markdown = ''): CourseBlockDto {
  return { id: newBlockId(), type: 'text', markdown };
}

export function createImageBlock(): CourseBlockDto {
  return { id: newBlockId(), type: 'image', assetId: '', alt: '', caption: '' };
}

export function createGraphBlock(): CourseBlockDto {
  return {
    id: newBlockId(),
    type: 'graph',
    spec: {
      kind: 'diagram',
      format: 'mermaid',
      source: 'flowchart LR\n  A[Start] --> B[Next]',
    },
  };
}

export function createDefaultQuestion(): QuestionDto {
  const a = newOptionId();
  const b = newOptionId();
  return {
    id: newQuestionId(),
    type: 'single_select',
    prompt: 'Choose the correct answer',
    options: [
      { id: a, label: 'Option A' },
      { id: b, label: 'Option B' },
    ],
    correctOptionId: a,
  };
}

export function createFormBlock(): CourseBlockDto {
  return {
    id: newBlockId(),
    type: 'form',
    form: {
      title: 'Check your understanding',
      passRule: { mode: 'all_correct' },
      questions: [createDefaultQuestion()],
    },
  };
}

export function blockSummary(block: CourseBlockDto): string {
  switch (block.type) {
    case 'text':
      return block.markdown.trim().slice(0, 120) || '(empty text)';
    case 'image':
      return block.assetId ? `asset ${block.assetId.slice(0, 8)}…` : 'no asset yet';
    case 'graph': {
      const spec = block.spec;
      if (spec?.kind === 'diagram') return `diagram · ${spec.source.slice(0, 60)}`;
      if (spec?.kind === 'chart') return `chart · ${spec.chart}`;
      if (block.source) return `${block.kind ?? 'graph'} · ${block.source.slice(0, 60)}`;
      return 'graph';
    }
    case 'form': {
      const title = block.form?.title ?? block.title ?? 'Untitled form';
      const count = block.form?.questions?.length ?? block.questions?.length ?? 0;
      return `${title} · ${count} question(s)`;
    }
    default:
      return '';
  }
}
