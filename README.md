# Casino Rule Book

iPhone-first, offline PWA that answers four questions at a casino machine:

1. Is this the version I want? (paytable check)
2. Does the current state justify playing? (persistent-state check)
3. How do I play it correctly? (strategy card and trainer)
4. What tells me to stop? (explicit exit event)

It does not predict outcomes. Returns are long-run theoretical figures that assume optimal strategy.

## What is in the build

| Area | Games | Status |
|---|---|---|
| Video poker, full support | Jacks or Better, Bonus Poker, Double Bonus, Deuces Wild, Triple Bonus | Paytable check, strategy card, exact trainer |
| Reference | Super Times Pay, Ten Play | Facts with sources, total-wager calculator |
| Persistent state | Ultimate X Bonus Streak | Sourced entry thresholds for five configurations, exit rule |
| Persistent state | Ultimate X | Accepts state, always answers NO RULE (no published threshold found) |
| Slots | none | Not in this pass; a slot is added only when its entry rule has a citation |

## Development

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (about one minute: every return is recomputed exactly)
npm run build        # type-check and production build into dist/
npm run preview      # serve dist/ on http://localhost:4173
npm run test:offline # end-to-end + offline check against the build (needs Playwright with Chromium)
```

`npm run test:offline` drives the built app at iPhone size: tiles, goal badges, paytable entry, the
trainer, the Bonus Streak check, then cuts the network and reloads.

## Deployment

`dist/` is a static site with relative paths, so it works from a domain root or a subfolder. Upload it to
any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages). HTTPS is required for the service worker.

This repo deploys itself to GitHub Pages: `.github/workflows/deploy.yml` runs the tests, builds and
publishes on every push to `main`. One-time setup: Settings > Pages > Source: "GitHub Actions". The app
is then served at `https://<owner>.github.io/<repo>/`.

To install on iPhone: open the URL in Safari, Share, Add to Home Screen. Open it once while online; after
that everything works with no connection. New versions install themselves the next time the app is opened
online.

## How it is organised

```
src/
  data/                 all numbers live here, never in components
    video-poker/*.json  one file per game: paytables, returns, strategy card, preferences, state rules
    sources.json        every citation, with strength and date checked
    preference-rules.json  goals and how lesser paytables are graded
  engine/               cards, hand evaluators, exact hold solver, full-cycle return calculator
  games/                paytable matching and goal preferences
  trainer/              question engine and scoring
  state-engine/         persistent-state decision and exit text
  storage/              localStorage wrapper (goal, entered paytables, trainer scores, observations)
  components/           screens
tests/                  Vitest suites
scripts/                offline check and icon generation
```

### Where the numbers come from

- **Returns and variances** are computed by `src/engine/rtp.ts` (all 2,598,960 deals, all 32 holds) and
  the tests recompute every one of them on each run. They agree with the published figures.
- **Trainer answers** come from `src/engine/solver.ts`, which enumerates every draw for all 32 holds of
  the dealt hand against the exact paytable. There is no hand-written strategy table to get wrong.
- **Strategy cards** are abbreviated lists for people. Every line carries an example hand, and the tests
  check that the solver agrees with each example.
- **Bonus Streak thresholds, Super Times Pay figures and game rules** are published figures. They were
  read from search-engine extracts of the cited pages, not from the pages themselves; `sources.json`
  marks them `published-extract`. Re-check them against the live pages when you can.

Rule: no citation, no recommendation. Unknown paytables get no return from the list, and unlisted
state configurations get NO RULE.

## Adding a video poker config

**A new paytable for an existing game:** add an entry to `variants` in the game's JSON with an `id`,
`label` and `diff` (only the rows that differ from the target). Put any number in `rtp` and `variance`,
run `npm test`, and copy the exact values from the failing `rtp.test.ts` output. Add `sources`.

**A new game that uses existing hand ranks** (for example another Jacks-style bonus game): copy
`bonus-poker.json`, edit `rows`, `target`, `preference` and `strategy`, and add the import to
`src/data/index.ts`. Row keys must be ones the evaluator knows (see `JACKS_ROWS` and `DEUCES_ROWS` in
`src/engine/evaluate.ts`). Set `rules.minHighPair` to `"K"` for a kings-or-better game.

**A game with new hand ranks** (kickers, a different wild card): add the hand codes and row mapping in
`src/engine/evaluate.ts` first, with evaluator tests.

## Adding a trainer strategy

Nothing to add: the trainer works for any paytable the evaluator understands, including a custom table
typed in on the floor. To add or change a strategy card, edit `strategy.lines` in the game's JSON. Each
line needs an `example` (`hand`, `hold`); `npm test` fails if the solver disagrees with it.

## Adding a persistent-state game

For another Ultimate X style configuration, add an entry under `state.configs` in the game's JSON:

```json
{
  "id": "ddb-85-10play",
  "label": "10-play · Double Double Bonus 8/5",
  "hands": 10,
  "rules": [{ "input": "next1", "gte": 21, "deals": 1 }],
  "sources": ["woo-bonus-streak-vulturing"]
}
```

`input` names one of the game's `state.inputs`; the configuration qualifies when any rule is met, and
`deals` is how many deals consume the state that qualified. Add the citation to `sources.json`. The tests
fail if a configuration has no source.

For a slot machine, write a small game-specific module and screen rather than stretching this format.
Use tap buttons for small ranges, a stepper or slider for large counters, and dollar entry for
jackpots, and keep the same three steps: Fixed, Play condition, Exit.

## Local data

Goal, entered paytables, trainer scores and the observation log are stored in `localStorage` on the
device under keys starting `crb.v1.`. Nothing is sent anywhere. Observations never change the rules.
