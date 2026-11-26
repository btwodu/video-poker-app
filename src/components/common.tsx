import type { ReactNode } from 'react';
import { SOURCES } from '../data';
import type { Preference } from '../data/types';
import { LEVEL_BADGE } from '../games/preference';

export function Badge({ pref, showReason = true }: { pref: Preference; showReason?: boolean }) {
  const badge = LEVEL_BADGE[pref.level];
  return (
    <div className={`badge badge-${pref.level}`}>
      <span className="badge-label">{badge.icon} {badge.text}</span>
      {showReason && <span className="badge-reason">{pref.reason}</span>}
    </div>
  );
}

export function Page({ title, back = '#/', children }: { title: string; back?: string; children: ReactNode }) {
  return (
    <div className="page">
      <header className="topbar">
        <a className="back" href={back} aria-label="Back">‹ Back</a>
        <h1>{title}</h1>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const STRENGTH: Record<string, string> = {
  computed: 'Computed in-app',
  'published-extract': 'Published (search extract)',
};

/** Compact provenance list for a set of source ids. */
export function SourceList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <p className="muted small">No source — shown for reference only.</p>;
  return (
    <ul className="sources">
      {ids.map((id) => {
        const s = SOURCES[id];
        return (
          <li key={id}>
            <span className="source-title">{s.title}</span>
            <span className="muted small"> · {STRENGTH[s.strength]} · checked {s.lastVerified}</span>
          </li>
        );
      })}
      <li><a className="small" href="#/sources">All sources and notes ›</a></li>
    </ul>
  );
}

/** −/+ stepper with a typed-entry fallback. */
export function Stepper({ value, onChange, min = 0, max = 9999, label }: {
  value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="stepper">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(clamp((value ?? min) - 1))}>−</button>
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? ''}
        placeholder="–"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(digits === '' ? undefined : clamp(Number(digits)));
        }}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(clamp((value ?? min - 1) + 1))}>+</button>
    </div>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, format }: {
  options: T[]; value: T | null; onChange: (v: T) => void; format?: (v: T) => string;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={String(o)} className={o === value ? 'chip on' : 'chip'} onClick={() => onChange(o)}>
          {format ? format(o) : String(o)}
        </button>
      ))}
    </div>
  );
}
