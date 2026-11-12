'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type {
  AnswerValueDto,
  FormAttemptResultDto,
  FormSpecDto,
  QuestionDto,
  QuestionGradeDto,
} from '@/lib/api/types';
import { passRuleLabel } from '@/lib/learner/form-blocks';

type Props = {
  form: FormSpecDto;
  busy?: boolean;
  result?: FormAttemptResultDto | null;
  onSubmit: (answers: AnswerValueDto[]) => Promise<void> | void;
};

type DraftAnswers = Record<string, AnswerValueDto | undefined>;

function gradeFor(
  grades: QuestionGradeDto[] | undefined,
  questionId: string,
): QuestionGradeDto | undefined {
  return grades?.find((g) => g.questionId === questionId);
}

function statusLabel(status: QuestionGradeDto['status'] | undefined): string {
  switch (status) {
    case 'correct':
      return 'Correct';
    case 'incorrect':
      return 'Incorrect';
    case 'pending':
      return 'Pending review';
    case 'ungraded':
      return 'Not scored';
    default:
      return '';
  }
}

function statusClass(status: QuestionGradeDto['status'] | undefined): string {
  switch (status) {
    case 'correct':
      return 'ok';
    case 'incorrect':
      return 'warn';
    case 'pending':
      return 'warn';
    default:
      return '';
  }
}

export function FormAttemptPanel({ form, busy, result, onSubmit }: Props) {
  const [draft, setDraft] = useState<DraftAnswers>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const questions = form.questions ?? [];

  const answeredCount = useMemo(() => {
    return questions.filter((q) => draft[q.id] != null).length;
  }, [draft, questions]);

  function setAnswer(answer: AnswerValueDto) {
    setDraft((prev) => ({ ...prev, [answer.questionId]: answer }));
  }

  async function handleSubmit() {
    setLocalError(null);
    const answers = questions.map((q) => draft[q.id]).filter((a): a is AnswerValueDto => a != null);
    if (answers.length < questions.length) {
      setLocalError('Answer every question before submitting.');
      return;
    }
    await onSubmit(answers);
  }

  return (
    <div className="form-attempt">
      <div className="form-attempt-header">
        <strong>{form.title || 'Check your understanding'}</strong>
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          {passRuleLabel(form.passRule)}
        </p>
      </div>

      <div className="stack" style={{ marginTop: '0.85rem' }}>
        {questions.map((q, index) => (
          <QuestionField
            key={q.id}
            index={index}
            question={q}
            value={draft[q.id]}
            grade={gradeFor(result?.grades, q.id)}
            onChange={setAnswer}
            disabled={Boolean(busy)}
          />
        ))}
      </div>

      {localError ? <p className="form-error">{localError}</p> : null}

      {result ? <AttemptFeedback result={result} /> : null}

      <div className="cta-row" style={{ marginTop: '0.85rem' }}>
        <Button variant="secondary" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? 'Submitting…' : result ? 'Try again' : 'Submit answers'}
        </Button>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {answeredCount}/{questions.length} answered
        </span>
      </div>
    </div>
  );
}

function AttemptFeedback({ result }: { result: FormAttemptResultDto }) {
  const scoreLabel = result.score == null ? 'n/a' : `${Math.round(result.score * 100)}%`;
  let tone: 'ok' | 'warn' | '' = '';
  let headline = 'Submitted';
  if (result.passed === true) {
    tone = 'ok';
    headline = 'Passed';
  } else if (result.passed === false) {
    tone = 'warn';
    headline = 'Not passed yet';
  } else {
    tone = 'warn';
    headline = 'Awaiting review';
  }

  return (
    <div className={`attempt-feedback ${tone}`}>
      <div className="meta-row">
        <span className={`badge ${tone}`}>{headline}</span>
        <span>Score {scoreLabel}</span>
      </div>
      {result.passed === null ? (
        <p className="muted" style={{ margin: '0.4rem 0 0' }}>
          Some answers need manual review before this form can pass.
        </p>
      ) : null}
      {result.passed === false ? (
        <p className="muted" style={{ margin: '0.4rem 0 0' }}>
          Review the feedback above and submit another attempt.
        </p>
      ) : null}
    </div>
  );
}

function QuestionField({
  question,
  index,
  value,
  grade,
  onChange,
  disabled,
}: {
  question: QuestionDto;
  index: number;
  value: AnswerValueDto | undefined;
  grade: QuestionGradeDto | undefined;
  onChange: (answer: AnswerValueDto) => void;
  disabled?: boolean;
}) {
  const gradeBadge = grade ? (
    <span className={`badge ${statusClass(grade.status)}`}>{statusLabel(grade.status)}</span>
  ) : null;

  return (
    <fieldset className="question-field" disabled={disabled}>
      <legend>
        <span className="muted">Q{index + 1}</span> {question.prompt}
        {gradeBadge}
      </legend>

      {question.type === 'short_text' ? (
        <input
          type="text"
          value={value?.type === 'short_text' ? value.value : ''}
          onChange={(e) =>
            onChange({ questionId: question.id, type: 'short_text', value: e.target.value })
          }
          placeholder="Your answer"
        />
      ) : null}

      {question.type === 'long_text' ? (
        <textarea
          rows={4}
          value={value?.type === 'long_text' ? value.value : ''}
          onChange={(e) =>
            onChange({ questionId: question.id, type: 'long_text', value: e.target.value })
          }
          placeholder="Write your response"
        />
      ) : null}

      {question.type === 'number' ? (
        <input
          type="number"
          step="any"
          value={value?.type === 'number' ? String(value.value) : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return;
            onChange({ questionId: question.id, type: 'number', value: Number(raw) });
          }}
          placeholder="Number"
        />
      ) : null}

      {question.type === 'boolean' ? (
        <div className="choice-row">
          {[true, false].map((option) => (
            <label key={String(option)} className="choice">
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={value?.type === 'boolean' && value.value === option}
                onChange={() =>
                  onChange({ questionId: question.id, type: 'boolean', value: option })
                }
              />
              {option ? 'True' : 'False'}
            </label>
          ))}
        </div>
      ) : null}

      {question.type === 'single_select' ? (
        <div className="choice-row">
          {question.options.map((opt) => (
            <label key={opt.id} className="choice">
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={value?.type === 'single_select' && value.optionId === opt.id}
                onChange={() =>
                  onChange({
                    questionId: question.id,
                    type: 'single_select',
                    optionId: opt.id,
                  })
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      ) : null}

      {question.type === 'multi_select' ? (
        <div className="choice-row">
          {question.options.map((opt) => {
            const selected =
              value?.type === 'multi_select' ? value.optionIds.includes(opt.id) : false;
            return (
              <label key={opt.id} className="choice">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current =
                      value?.type === 'multi_select' ? value.optionIds : ([] as string[]);
                    const next = selected
                      ? current.filter((id) => id !== opt.id)
                      : [...current, opt.id];
                    onChange({
                      questionId: question.id,
                      type: 'multi_select',
                      optionIds: next,
                    });
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      ) : null}
    </fieldset>
  );
}
