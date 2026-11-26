import { useState } from 'react';
import { GAMES } from '../data';
import { loadObservations, saveObservations, type Observation } from '../storage/store';
import { Page, Section } from './common';

const FIELDS: { key: keyof Observation; label: string; placeholder: string }[] = [
  { key: 'casino', label: 'Casino', placeholder: '' },
  { key: 'machine', label: 'Machine / location', placeholder: 'Bank by the bar, seat 3' },
  { key: 'denomination', label: 'Denomination', placeholder: '25¢' },
  { key: 'bet', label: 'Bet per deal', placeholder: '$12.50' },
  { key: 'paytable', label: 'Paytable', placeholder: '9/6' },
  { key: 'state', label: 'Persistent state seen', placeholder: 'Next 24 / two 37 / three 45' },
  { key: 'outcome', label: 'Outcome', placeholder: '+$40 after 3 deals' },
  { key: 'notes', label: 'Notes', placeholder: '' },
];

const blank = () => ({
  game: GAMES[0].name, casino: '', machine: '', denomination: '', bet: '', paytable: '', state: '', outcome: '', notes: '',
});

export function ObservationLog() {
  const [list, setList] = useState<Observation[]>(loadObservations);
  const [draft, setDraft] = useState(blank);
  const update = (next: Observation[]) => { setList(next); saveObservations(next); };

  const add = () => {
    update([{ ...draft, id: String(Date.now()), time: new Date().toISOString() }, ...list]);
    setDraft({ ...blank(), casino: draft.casino, game: draft.game });
  };

  return (
    <Page title="Observation log">
      <Section title="Record what you saw">
        <p className="muted small">
          Stored only on this device. Observations are a diary — they never change the app's rules or recommendations.
        </p>
        <label className="field">
          <span>Game</span>
          <select value={draft.game} onChange={(e) => setDraft({ ...draft, game: e.target.value })}>
            {GAMES.map((g) => <option key={g.id}>{g.name}</option>)}
            <option>Other</option>
          </select>
        </label>
        {FIELDS.map((f) => (
          <label className="field" key={f.key}>
            <span>{f.label}</span>
            <input value={draft[f.key as keyof typeof draft]} placeholder={f.placeholder} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
          </label>
        ))}
        <button type="button" className="btn" onClick={add}>Save observation</button>
      </Section>

      <Section title={`Saved (${list.length})`}>
        {list.length === 0 && <p className="muted">Nothing recorded yet.</p>}
        {list.map((o) => (
          <div className="observation" key={o.id}>
            <div className="observation-head">
              <strong>{o.game}</strong>
              <span className="muted small">{new Date(o.time).toLocaleString()}</span>
            </div>
            {FIELDS.filter((f) => o[f.key]).map((f) => (
              <p key={f.key} className="small"><span className="muted">{f.label}:</span> {o[f.key]}</p>
            ))}
            <button type="button" className="btn ghost" onClick={() => update(list.filter((x) => x.id !== o.id))}>Delete</button>
          </div>
        ))}
      </Section>
    </Page>
  );
}
