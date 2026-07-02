/**
 * Bracket Generator — Klassik Power-of-2 Single-Elimination Tizimi.
 * Sodda, ishonchli, UI bilan to'liq mos.
 */

/**
 * Eng yaqin 2-ning darajasini, bye sonini va raundlar sonini hisoblaydi.
 */
export function calculateBracketSize(N) {
  if (N < 2) return { M: 2, byes: Math.max(0, 2 - N), roundsCount: 1 };
  let M = 2;
  let roundsCount = 1;
  while (M < N) {
    M *= 2;
    roundsCount++;
  }
  return { M, byes: M - N, roundsCount };
}

/**
 * B ta bye-ni L ta slot ichida teng taqsimlaydi.
 */
export function getDistributedIndices(L, B) {
  const indices = new Set();
  if (B <= 0) return indices;
  if (B >= L) {
    for (let i = 0; i < L; i++) indices.add(i);
    return indices;
  }
  const step = L / B;
  for (let i = 0; i < B; i++) {
    indices.add(Math.floor(i * step));
  }
  return indices;
}

/**
 * Turnir uchun barcha o'yinlarni generatsiya qiladi.
 * @param {string} tournamentId - Turnir UUID-si
 * @param {Array<{ id: string, name: string }>} teams - Jamoalar massivi
 * @returns {Array<object>} O'yinlar massivi (bazaga insert qilish uchun)
 */
export function generateMatchesForTournament(tournamentId, teams) {
  const N = teams.length;
  if (N < 2) throw new Error("Turnir yaratish uchun kamida 2 ta jamoa kerak.");

  const { M, byes, roundsCount } = calculateBracketSize(N);
  const matchesByRound = [];

  // 1. Har bir raund uchun bo'sh o'yinlar yaratish
  for (let r = 1; r <= roundsCount; r++) {
    const matchesInRound = M / Math.pow(2, r);
    const roundMatches = [];
    for (let m = 0; m < matchesInRound; m++) {
      roundMatches.push({
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        round_number: r,
        match_order: m + 1,
        team1_id: null,
        team2_id: null,
        score1: null,
        score2: null,
        penalty1: null,
        penalty2: null,
        winner_id: null,
        next_match_id: null
      });
    }
    matchesByRound.push(roundMatches);
  }

  // 2. Raundlar orasini bog'lash (next_match_id)
  for (let r = 0; r < roundsCount - 1; r++) {
    const currentRound = matchesByRound[r];
    const nextRound = matchesByRound[r + 1];
    for (let m = 0; m < currentRound.length; m++) {
      currentRound[m].next_match_id = nextRound[Math.floor(m / 2)].id;
    }
  }

  // 3. 1-raundga jamoalarni va bye-larni joylashtirish
  const round1 = matchesByRound[0];
  const L = M / 2;
  const byeMatchIndices = getDistributedIndices(L, byes);

  let teamIdx = 0;
  for (let m = 0; m < L; m++) {
    const match = round1[m];
    if (byeMatchIndices.has(m)) {
      // Bye: faqat 1 ta jamoa, 2-chi yo'q
      const team = teams[teamIdx++];
      match.team1_id = team.id;
      match.team2_id = null;
      match.winner_id = team.id;
      // Bye g'olibini 2-raundga avtomatik o'tkazish
      if (matchesByRound.length > 1) {
        const nextMatch = matchesByRound[1][Math.floor(m / 2)];
        if (m % 2 === 0) {
          nextMatch.team1_id = team.id;
        } else {
          nextMatch.team2_id = team.id;
        }
      }
    } else {
      match.team1_id = teams[teamIdx++].id;
      match.team2_id = teams[teamIdx++].id;
    }
  }

  // 4. Barcha o'yinlarni bitta massivga yig'ish
  return matchesByRound.flat();
}

