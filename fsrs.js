/* Nabat scheduler: FSRS-4.5 (open-spaced-repetition), default weights, desired retention 0.90.
   Grades: 1 = again «دوباره», 2 = hard «سخت بود», 3 = good «خوب», 4 = easy «روان».
   A "card" here is one memorization unit (a short surah, or a few ayat of a longer one). */
(function () {
  const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367,
             1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const FACTOR = 19 / 81, DECAY = -0.5, DAY = 86400000;
  const clampD = d => Math.min(10, Math.max(1, d));

  const retrievability = (elapsedDays, S) => Math.pow(1 + FACTOR * elapsedDays / S, DECAY);
  const intervalFor = (S, retention, maxDays) =>
    Math.max(1, Math.min(maxDays, Math.round(S / FACTOR * (Math.pow(retention, 1 / DECAY) - 1))));
  const initD = g => clampD(W[4] - (g - 3) * W[5]);

  function nextD(D, g) {
    const d = D - W[6] * (g - 3);
    return clampD(W[7] * initD(3) + (1 - W[7]) * d);              // mean reversion
  }
  function recallS(D, S, R, g) {
    const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
    return S * (Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hard * easy + 1);
  }
  function forgetS(D, S, R) {
    return W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
  }

  /** Apply a grade to a card at time `now` (ms). Returns a new card. */
  function review(card, g, now, opt = {}) {
    const retention = opt.retention || 0.9, maxDays = opt.maxDays || 120;
    let { S, D, last } = card;
    if (!S) {                                                       // first review after planting
      S = W[g - 1]; D = initD(g);
    } else {
      const elapsed = Math.max(0, (now - last) / DAY);
      const R = retrievability(elapsed, S);
      D = nextD(D, g);
      S = g === 1 ? Math.min(S, forgetS(D, S, R)) : recallS(D, S, R, g);
    }
    const days = g === 1 ? 1 : intervalFor(S, retention, maxDays);
    return Object.assign({}, card, { S, D, last: now, due: startOfDay(now) + days * DAY, reps: (card.reps || 0) + 1,
                                     lapses: (card.lapses || 0) + (g === 1 ? 1 : 0) });
  }

  /** A newly planted card: first water tomorrow (sleep consolidates). */
  function plant(id, now) {
    return { id, S: 0, D: 0, last: now, planted: now, due: startOfDay(now) + DAY, reps: 0, lapses: 0 };
  }

  function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

  /** Memory strength as a growth stage 1..5 (0 = seed still being learned). */
  function stage(card, now) {
    if (!card) return 0;
    if (!card.S) return 1;
    const S = card.S;
    return S < 3 ? 1 : S < 14 ? 2 : S < 45 ? 3 : S < 120 ? 4 : 5;
  }
  function currentR(card, now) {
    if (!card || !card.S) return 1;
    return retrievability(Math.max(0, (now - card.last) / DAY), card.S);
  }

  window.NabatFSRS = { review, plant, stage, currentR, startOfDay, DAY };
})();
