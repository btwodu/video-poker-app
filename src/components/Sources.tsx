import { SOURCES } from '../data';
import { Page } from './common';

export function SourcesPage() {
  return (
    <Page title="Sources">
      <section className="card">
        <p className="muted small">
          Every paytable, return and threshold in the app points at one of these. “Computed in-app” figures are
          recalculated from scratch by the automated tests. “Search extract” means the figure was read from a
          search-engine extract of the page, not from the page itself — re-check before relying on it.
        </p>
      </section>
      {Object.entries(SOURCES).map(([id, s]) => (
        <section className="card" key={id}>
          <h2>{s.title}</h2>
          <p>{s.citation}</p>
          <p className="muted small">{s.notes}</p>
          <p className="muted small">
            {s.strength === 'computed' ? 'Computed in-app' : 'Published (search extract)'} · checked {s.lastVerified}
          </p>
          {s.url && <p className="small url">{s.url}</p>}
        </section>
      ))}
    </Page>
  );
}
