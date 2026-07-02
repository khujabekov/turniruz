/**
 * Bracket Generator — Natural Bracket Single-Elimination Tizimi.
 * 
 * Har raundda ceil(N/2) match yaratiladi. Toq jamoalar bo'lganda
 * har raundda ko'pi bilan 1 ta bye bo'ladi (power-of-2 yaxlitlash yo'q).
 * 
 * Misollar:
 *   6 ta jamoa:  R1=3, R2=2(1 bye), Final=1  → 3 raund
 *   7 ta jamoa:  R1=4(1 bye), R2=2, Final=1   → 3 raund
 *   9 ta jamoa:  R1=5(1 bye), R2=3(1 bye), R3=2(1 bye), Final=1 → 4 raund
 *   13 ta jamoa: R1=7(1 bye), R2=4(1 bye), R3=2, Final=1 → 4 raund
 *   16 ta jamoa: R1=8, R2=4, R3=2, Final=1    → 4 raund (bye yo'q)
 */

/**
 * Raundlar soni va har bir raunddagi matchlar sonini hisoblaydi.
 * @param {number} N - Jamoalar soni
 * @returns {{ roundMatchCounts: number[], roundsCount: number }}
 */
export function calculateBracketSize(N) {
  if (N < 2) return { roundMatchCounts: [1], roundsCount: 1 };
  const roundMatchCounts = [];
  let remaining = N;
  while (remaining > 1) {
    const matchCount = Math.ceil(remaining / 2);
    roundMatchCounts.push(matchCount);
    remaining = matchCount; // g'oliblar soni = matchlar soni
  }
  return { roundMatchCounts, roundsCount: roundMatchCounts.length };
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

  const { roundMatchCounts, roundsCount } = calculateBracketSize(N);
  const matchesByRound = [];

  // 1. Har bir raund uchun match-larni yaratish
  for (let r = 0; r < roundsCount; r++) {
    const roundMatches = [];
    for (let m = 0; m < roundMatchCounts[r]; m++) {
      roundMatches.push({
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        round_number: r + 1,
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
    const curr = matchesByRound[r];
    const next = matchesByRound[r + 1];
    for (let m = 0; m < curr.length; m++) {
      curr[m].next_match_id = next[Math.floor(m / 2)].id;
    }
  }

  // 3. 1-raundga jamoalarni joylashtirish
  const round1 = matchesByRound[0];
  let teamIdx = 0;
  for (let m = 0; m < round1.length; m++) {
    round1[m].team1_id = teams[teamIdx++].id;
    if (teamIdx < N) {
      round1[m].team2_id = teams[teamIdx++].id;
    } else {
      // Bye: faqat 1 ta jamoa, 2-chi yo'q → avtomatik g'olib
      round1[m].team2_id = null;
      round1[m].winner_id = round1[m].team1_id;
      round1[m].is_completed = true;
      round1[m].match_status = 'completed';
    }
  }

  // 4. Bye-larni kaskad ravishda keyingi raundlarga o'tkazish
  //    Agar raund R da bye g'olibi bo'lsa, uni raund R+1 dagi matchga qo'yamiz.
  //    Agar R+1 dagi matchga faqat 1 ta feeder kelsa (oxirgi match, juft yo'q),
  //    u ham bye bo'ladi → yana keyingi raundga o'tkazamiz.
  for (let r = 0; r < roundsCount - 1; r++) {
    const curr = matchesByRound[r];
    const next = matchesByRound[r + 1];

    // G'oliblarni keyingi raundga o'tkazish
    for (let m = 0; m < curr.length; m++) {
      if (curr[m].winner_id) {
        const nextMatch = next[Math.floor(m / 2)];
        if (m % 2 === 0) {
          nextMatch.team1_id = curr[m].winner_id;
        } else {
          nextMatch.team2_id = curr[m].winner_id;
        }
      }
    }

    // Keyingi raunddagi matchlarni tekshirish: structural bye bor-yo'qligi
    for (let j = 0; j < next.length; j++) {
      const nm = next[j];
      const feeder2Idx = 2 * j + 1; // team2 ni yuboradigan match indeksi
      const hasFeeder2 = feeder2Idx < curr.length;

      // Agar faqat 1 ta feeder bo'lsa -> structural bye
      if (!hasFeeder2) {
        nm.match_status = 'bye';
        if (nm.team1_id) {
          nm.winner_id = nm.team1_id;
          nm.is_completed = true;
          nm.match_status = 'completed';
        }
      }
    }
  }

  // 5. Barcha o'yinlarni bitta massivga yig'ish
  return matchesByRound.flat();
}
