import { useEffect, useRef, useState } from 'react';
import type { BaseGame, GoalId, Pays } from '../data/types';
import type { ExactResult } from '../engine/rtp';
import { formatRtp, knownConfigs, matchPaytable } from '../games/paytable';
import { actualPreference, targetPreference } from '../games/preference';
import { loadActualPays, saveActualPays } from '../storage/store';
import { Badge, Page, Section, SourceList, Stepper } from './common';

function ExactReturnButton({ game, pays }: { game: BaseGame; pays: Pays }) {
  const [state, setState] = useState<'idle' | 'running' | ExactResult>('idle');
  const worker = useRef<Worker | null>(null);
  // A result only applies to the paytable it was computed for.
  useEffect(() => { worker.current?.terminate(); setState('idle'); }, [pays]);
  useEffect(() => () => worker.current?.terminate(), []);

  const run = () => {
    setState('running');
    const w = new Worker(new URL('../engine/rtp.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e: MessageEvent<ExactResult>) => { setState(e.data); w.terminate(); };
    w.onerror = () => { setState('idle'); w.terminate(); };
    w.postMessage({ rules: game.rules, pays });
  };

  if (state === 'idle') {
    return <button type="button" className="btn secondary" onClick={run}>Compute exact return (about 10 s)</button>;
  }
  if (state === 'running') return <p className="muted">Solving all 2,598,960 deals…</p>;
  return (
    <p>
      <strong>{formatRtp(state.rtp)}</strong> exact return with optimal strategy · variance {state.variance.toFixed(1)}
      <br /><span className="muted small">Computed on this device by the exact solver for the table as entered.</span>
    </p>
  );
}

export function BaseGameDetail({ game, goal }: { game: BaseGame; goal: GoalId }) {
  const [actual, setActualState] = useState<Pays | null>(() => loadActualPays(game.id));
  const setActual = (pays: Pays | null) => { setActualState(pays); saveActualPays(game.id, pays); };
  const target = game.target;
  const match = actual ? matchPaytable(game, actual) : null;
  const pref = match ? actualPreference(game, goal, match) : targetPreference(game, goal);
  const showCard = !match || match.status === 'match';

  return (
    <Page title={game.name}>
      <Section title="Recommended paytable">
        <p className="lead">{target.label} · <strong>{formatRtp(target.rtp)}</strong> theoretical return</p>
        <table className="paytable">
          <tbody>
            {game.rows.map((row) => (
              <tr key={row.key} className={game.keyRows.includes(row.key) ? 'key' : ''}>
                <td>{row.label}</td>
                <td className="num">{target.pays[row.key]}</td>
                <td className="mark">{game.keyRows.includes(row.key) ? '← check' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">Pays per coin at max bet.</p>
        <dl className="facts">
          <dt>Volatility</dt><dd>{target.volatility} (variance {target.variance.toFixed(1)}). {target.volatilityNote}</dd>
          <dt>Strategy</dt><dd>Optimal strategy required — the return assumes every hold is correct.</dd>
          <dt>Confidence</dt><dd>High: recomputed exactly by this app and matches the published figure.</dd>
        </dl>
        <SourceList ids={target.sources} />
      </Section>

      <Section title="This machine">
        <p className="muted small">Tap the version on the cabinet, or adjust single rows.</p>
        <div className="chips">
          {knownConfigs(game).map((c) => (
            <button
              type="button" key={c.id}
              className={match?.config?.id === c.id ? 'chip on' : 'chip'}
              onClick={() => setActual({ ...c.pays })}
            >{c.label}</button>
          ))}
        </div>
        {actual && (
          <div className="rows">
            {game.rows.map((row) => (
              <div key={row.key} className={actual[row.key] !== target.pays[row.key] ? 'row differs' : 'row'}>
                <span>{row.label}</span>
                <Stepper
                  label={row.label} value={actual[row.key]} min={0} max={4000}
                  onChange={(v) => setActual({ ...actual, [row.key]: v ?? 0 })}
                />
              </div>
            ))}
            <button type="button" className="btn ghost" onClick={() => setActual(null)}>Clear entered paytable</button>
          </div>
        )}

        {match?.status === 'match' && (
          <div className="verdict verdict-play">
            <strong>MATCH</strong>
            <span>{match.config.label} {game.name}</span>
            <span>{formatRtp(match.config.rtp)} theoretical return</span>
          </div>
        )}
        {match && (match.status === 'below-target' || match.status === 'above-target') && (
          <div className={match.status === 'below-target' ? 'verdict verdict-pass' : 'verdict verdict-play'}>
            <strong>{match.status === 'below-target' ? 'BELOW TARGET' : 'KNOWN TABLE'}</strong>
            <span>{match.config.label} {game.name} · {formatRtp(match.config.rtp)} theoretical return</span>
            {match.diffs.map((d) => <span key={d.key}>{d.label}: {d.actual} instead of {d.target}</span>)}
          </div>
        )}
        {match?.status === 'unknown' && (
          <div className="verdict verdict-unknown">
            <strong>CUSTOM / UNKNOWN TABLE</strong>
            <span>Not in the rulebook, so no return is shown from the list.</span>
            {match.diffs.map((d) => <span key={d.key}>{d.label}: {d.actual} instead of {d.target}</span>)}
            <ExactReturnButton game={game} pays={actual!} />
          </div>
        )}
        <Badge pref={pref} />
      </Section>

      <Section title="Strategy">
        {showCard ? (
          <>
            <p className="lead">{game.strategy.title}</p>
            <p className="muted small">{game.strategy.note}</p>
            <p className="muted small">
              Followed exactly, this card returns {(game.strategy.cardRtp * 100).toFixed(2)}% — within{' '}
              {((target.rtp - game.strategy.cardRtp) * 100).toFixed(3)} of a point of perfect play, measured over
              every possible deal. The trainer grades against perfect play.
            </p>
            <ol className="strategy">
              {game.strategy.lines.map((line, i) => (
                <li key={i} className={line.group && line.group !== game.strategy.lines[i - 1]?.group ? 'grouped' : ''}>
                  {line.group && line.group !== game.strategy.lines[i - 1]?.group && <span className="group">{line.group}</span>}
                  {line.text}
                </li>
              ))}
            </ol>
            <SourceList ids={game.strategy.sources} />
          </>
        ) : (
          <p>
            The strategy card is validated for the {target.label} table only and is not shown for a different
            paytable. The trainer below is still exact: it solves every hand against the table you entered.
          </p>
        )}
        <a className="btn" href={`#/train/${game.id}`}>
          Train {match?.config ? match.config.label : match ? 'this custom table' : target.label}
        </a>
      </Section>
    </Page>
  );
}
