/// <reference lib="webworker" />
/** Runs the full-cycle exact return off the main thread (a few seconds on a phone). */
import { exactReturn } from './rtp';
import type { GameRules } from './evaluate';

self.onmessage = (event: MessageEvent<{ rules: GameRules; pays: Record<string, number> }>) => {
  self.postMessage(exactReturn(event.data.rules, event.data.pays));
};
