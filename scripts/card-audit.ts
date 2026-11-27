/**
 * Plays every one of the 2,598,960 deals by a game's strategy card and compares
 * each hold with the exact solver.
 *
 *   npx tsx scripts/card-audit.ts <game-id>           report cost and the costliest disagreements
 *   npx tsx scripts/card-audit.ts <game-id> --write   also store cardRtp and fill in missing examples
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { cardLabel, cardsInMask, parseHand, holdMask, RANK_CHARS, SUIT_CHARS } from '../src/engine/cards';
import { describeHold } from '../src/engine/describe';
import { forEachHand, TOTAL_HANDS } from '../src/engine/rtp';
import { compileCard } from '../src/strategy/card';

const [id, flag] = process.argv.slice(2);
const file = new URL(`../src/data/video-poker/${id}.json`, import.meta.url);
const game = JSON.parse(readFileSync(file, 'utf8'));
const lines = game.strategy.lines as { text: string; rule: string; deuces?: number; example?: { hand: string; hold: string } }[];
const card = compileCard(game.rules, lines);
const text = (cards: number[]) => cards.map((c) => RANK_CHARS[c >> 2] + SUIT_CHARS[c & 3]).join(' ');

let optimal = 0, played = 0, wrong = 0;
const used = new Array(lines.length + 1).fill(0);
const groups = new Map<string, { cost: number; count: number; worst: number; hand: string; card: string; best: string }>();
const examples = lines.map(() => ({ margin: -1, hand: '', hold: '' }));

forEachHand(game.rules, game.target.pays, (hand, evs) => {
  let best = 0;
  for (let m = 1; m < 32; m++) if (evs[m] > evs[best] + 1e-9) best = m;
  const { mask, line } = card.play(hand);
  optimal += evs[best]; played += evs[mask]; used[line < 0 ? lines.length : line]++;
  const loss = evs[best] - evs[mask];
  if (loss > 1e-9) {
    wrong++;
    const key = `${line + 1}. ${lines[line]?.text ?? '(no line)'}  =>  ${describeHold(game.rules, hand, best)}`;
    const g = groups.get(key) ?? { cost: 0, count: 0, worst: 0, hand: '', card: '', best: '' };
    g.cost += loss; g.count++;
    if (loss > g.worst) {
      g.worst = loss; g.hand = text(hand);
      g.card = cardsInMask(hand, mask).map(cardLabel).join('') || '-';
      g.best = cardsInMask(hand, best).map(cardLabel).join('') || '-';
    }
    groups.set(key, g);
  } else if (line >= 0) {
    // Clearest example for this line: the correct hold beats every other hold by the widest margin.
    let second = -1;
    for (let m = 0; m < 32; m++) if (evs[m] < evs[mask] - 1e-9 && evs[m] > second) second = evs[m];
    const margin = evs[mask] - second;
    if (margin > examples[line].margin) examples[line] = { margin, hand: text(hand), hold: text(cardsInMask(hand, mask)) };
  }
});

const pct = (v: number) => ((v / TOTAL_HANDS) * 100).toFixed(4) + '%';
console.log(`${game.name} ${game.target.label}: optimal ${pct(optimal)}  card ${pct(played)}  cost ${pct(optimal - played)}  wrong holds ${wrong} (${((wrong / TOTAL_HANDS) * 100).toFixed(2)}% of deals)`);
lines.forEach((l, i) => { if (used[i] === 0) console.log(`  NEVER USED: ${i + 1}. ${l.text}`); });
[...groups.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, Number(process.env.TOP ?? 14)).forEach(([key, g]) =>
  console.log(`  ${pct(g.cost)} x${g.count}  ${key}\n      e.g. ${g.hand}: card ${g.card}, best ${g.best} (-${g.worst.toFixed(4)})`));

if (flag === '--write') {
  lines.forEach((l, i) => {
    let ok = false;
    if (l.example) {
      const hand = parseHand(l.example.hand).sort((a, b) => a - b);
      const want = holdMask(hand, l.example.hold ? parseHand(l.example.hold) : []);
      const got = card.play(hand);
      ok = got.line === i && got.mask === want;
    }
    if (!ok && examples[i].margin >= 0) l.example = { hand: examples[i].hand, hold: examples[i].hold };
  });
  game.strategy.cardRtp = Number((played / TOTAL_HANDS).toFixed(6));
  writeFileSync(file, JSON.stringify(game, null, 2) + '\n');
  console.log('written');
}
