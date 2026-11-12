'use client';

type Props = {
  percent: number;
  label?: string;
};

export function ProgressMeter({ percent, label }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="progress-meter" aria-label={label ?? `Progress ${clamped}%`}>
      <div className="progress-meter-track">
        <div className="progress-meter-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="progress-meter-label">{clamped}%</span>
    </div>
  );
}
