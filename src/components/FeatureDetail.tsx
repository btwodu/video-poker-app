import { useState } from 'react';
import type { FeatureGame, GoalId } from '../data/types';
import { targetPreference } from '../games/preference';
import { evaluateState, exitText, totalWager } from '../state-engine/evaluate';
import { load, save } from '../storage/store';
import { Badge, Chips, Page, Section, SourceList, Stepper } from './common';

const DENOMINATIONS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
const money = (v: number) => (v < 1 ? `${Math.round(v * 100)}¢` : `$${v}`);

function Wager({ game }: { game: FeatureGame }) {
  const key = `wager.${game.id}`;
  const [w, setW] = useState(() => load(key, { denomination: 0.25, hands: game.wager.defaultHands }));
  const update = (next: typeof w) => { setW(next); save(key, next); };
  const total = totalWager(w.denomination, game.wager.coinsPerHand, w.hands);
  return (
    <Section title="Total wager per deal">
      <p className="label">Denomination</p>
      <Chips options={DENOMINATIONS} value={w.denomination} format={money} onChange={(d) => update({ ...w, denomination: d })} />
      <p className="label">Hands</p>
      <Chips options={game.wager.handOptions} value={w.hands} onChange={(h) => update({ ...w, hands: h })} />
      <div className="verdict verdict-neutral">
        <strong>${total.toFixed(2)} per deal</strong>
        <span>{money(w.denomination)} × {game.wager.coinsPerHand} credits × {w.hands} hand{w.hands > 1 ? 's' : ''}</span>
        <span>{game.wager.coinsNote}</span>
      </div>
    </Section>
  );
}

function StateCheck({ game }: { game: FeatureGame }) {
  const state = game.state!;
  const [configId, setConfigId] = useState<string | null>(state.configs.length ? null : 'other');
  const [values, setValues] = useState<Record<string, number | undefined>>({});
  const config = state.configs.find((c) => c.id === configId) ?? null;
  const decision = evaluateState(config, values);
  const inputs = config ? state.inputs.filter((i) => config.rules.some((r) => r.input === i.key)) : state.inputs;
  const labelOf = (key: string) => state.inputs.find((i) => i.key === key)?.label ?? key;

  return (
    <>
      <Section title="1 · Fixed">
        <p className="muted small">{state.fixedPrompt}</p>
        <div className="options">
          {state.configs.map((c) => (
            <button type="button" key={c.id} className={c.id === configId ? 'option on' : 'option'} onClick={() => { setConfigId(c.id); setValues({}); }}>
              {c.label}
            </button>
          ))}
          <button type="button" className={configId === 'other' ? 'option on' : 'option'} onClick={() => { setConfigId('other'); setValues({}); }}>
            Other / not listed
          </button>
        </div>
      </Section>

      {configId && (
        <Section title="2 · Play condition">
          {inputs.map((input) => {
            const rule = config?.rules.find((r) => r.input === input.key);
            return (
              <div key={input.key} className="state-input">
                <div>
                  <span>{input.label}</span>
                  <span className="muted small">{input.help}{rule ? ` Needs ${rule.gte} or more.` : ''}</span>
                </div>
                <Stepper label={input.label} value={values[input.key]} min={0} max={999} onChange={(v) => setValues({ ...values, [input.key]: v })} />
              </div>
            );
          })}

          {decision.verdict === 'no-rule' && (
            <div className="verdict verdict-unknown">
              <strong>NO RULE FOR THIS CONFIGURATION</strong>
              <span>{state.noRuleText}</span>
            </div>
          )}
          {decision.verdict === 'incomplete' && (
            <div className="verdict verdict-neutral">
              <strong>ENTER ALL TOTALS</strong>
              <span>Nothing qualifies so far. Enter the remaining totals before deciding to pass.</span>
            </div>
          )}
          {decision.verdict === 'pass' && (
            <div className="verdict verdict-pass">
              <strong>DOES NOT QUALIFY</strong>
              {decision.closest && (
                <span>Closest: {labelOf(decision.closest.rule.input)} is {decision.closest.value}, needs {decision.closest.rule.gte}.</span>
              )}
              <span>No published entry condition is met for this configuration.</span>
            </div>
          )}
          {decision.verdict === 'play' && (
            <div className="verdict verdict-play">
              <strong>QUALIFIES</strong>
              {decision.satisfied.map((r) => (
                <span key={r.input}>{labelOf(r.input)}: {values[r.input]} (needs {r.gte} or more)</span>
              ))}
              <span>Qualifies under the published strategy. Exact edge unknown; not a guarantee of a win.</span>
            </div>
          )}
          {config && <SourceList ids={config.sources} />}
        </Section>
      )}

      {decision.verdict === 'play' && (
        <Section title="3 · Exit">
          <div className="verdict verdict-neutral">
            <strong>STOP AFTER {decision.deals} DEAL{decision.deals > 1 ? 'S' : ''}</strong>
            <span>{exitText(decision.deals)}</span>
          </div>
          <p className="muted small">
            Multipliers you earn yourself while playing are new state: re-check them against the same rule, and
            walk away the first time nothing qualifies.
          </p>
        </Section>
      )}
    </>
  );
}

export function FeatureDetail({ game, goal }: { game: FeatureGame; goal: GoalId }) {
  return (
    <Page title={game.name}>
      {game.state && <StateCheck game={game} />}
      <Section title="What this is">
        <p>{game.summary}</p>
        <Badge pref={targetPreference(game, goal)} />
        <dl className="facts">
          {game.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}{f.sources.length === 0 && <span className="muted small"> (no source)</span>}</dd>
            </div>
          ))}
        </dl>
        <SourceList ids={[...new Set(game.facts.flatMap((f) => f.sources))]} />
      </Section>
      <Wager game={game} />
    </Page>
  );
}
