/**
 * Dynamic Bracket Generator logic for Single-Elimination (Play-off) Tournaments.
 */

/**
 * Calculates the next power of 2, the number of byes, and the total rounds.
 * @param {number} N - Number of teams
 * @returns {{ M: number, byes: number, roundsCount: number }}
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
 * Distributes B items evenly in L slots.
 * Useful for spreading byes evenly across the bracket.
 * @param {number} L - Total slots (Round 1 matches)
 * @param {number} B - Number of byes to distribute
 * @returns {Set<number>} Set of slot indices that should contain a bye
 */
export function getDistributedIndices(L, B) {
  const indices = new Set();
  if (B <= 0) return indices;
  if (B >= L) {
    for (let i = 0; i < L; i++) indices.add(i);
    return indices;
  }
  
  // Use a floating point step to distribute byes evenly
  const step = L / B;
  for (let i = 0; i < B; i++) {
    indices.add(Math.floor(i * step));
  }
  return indices;
}

/**
 * Generates all matches for a tournament.
 * @param {string} tournamentId - The Supabase UUID of the tournament
 * @param {Array<{ id: string, name: string }>} teams - The array of team objects
 * @returns {Array<object>} Flat array of matches to be inserted in the DB
 */
export function generateMatchesForTournament(tournamentId, teams) {
  const N = teams.length;
  if (N < 2) throw new Error("Turnir yaratish uchun kamida 2 ta jamoa kerak.");
  
  const { M, byes, roundsCount } = calculateBracketSize(N);
  const matchesByRound = [];
  
  // 1. Create match shells with pre-generated UUIDs for all rounds
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
  
  // 2. Link matches between rounds via next_match_id
  for (let r = 0; r < roundsCount - 1; r++) {
    const currentRound = matchesByRound[r];
    const nextRound = matchesByRound[r + 1];
    
    for (let m = 0; m < currentRound.length; m++) {
      const nextMatchIndex = Math.floor(m / 2);
      currentRound[m].next_match_id = nextRound[nextMatchIndex].id;
    }
  }
  
  // 3. Populate Round 1 matches and handle byes
  const round1 = matchesByRound[0];
  const L = M / 2; // Number of matches in Round 1
  const byeMatchIndices = getDistributedIndices(L, byes);
  
  let teamIdx = 0;
  for (let m = 0; m < L; m++) {
    const match = round1[m];
    const isByeMatch = byeMatchIndices.has(m);
    
    if (isByeMatch) {
      // Bye match: only team1 is set, team2 is null (a bye)
      const team = teams[teamIdx++];
      match.team1_id = team.id;
      match.team2_id = null;
      match.winner_id = team.id; // Automatically wins!
      
      // Auto-advance this winner to the appropriate slot in Round 2 match
      const nextMatchIndex = Math.floor(m / 2);
      const nextMatch = matchesByRound[1][nextMatchIndex];
      
      if (m % 2 === 0) {
        nextMatch.team1_id = team.id;
      } else {
        nextMatch.team2_id = team.id;
      }
    } else {
      // Regular match: 2 teams play
      match.team1_id = teams[teamIdx++].id;
      match.team2_id = teams[teamIdx++].id;
    }
  }
  
  // 4. Flatten the matches nested array into a single list
  const flatMatches = [];
  for (const roundMatches of matchesByRound) {
    flatMatches.push(...roundMatches);
  }
  
  return flatMatches;
}
