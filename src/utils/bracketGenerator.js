/**
 * Dynamic Bracket Generator logic for Single-Elimination (Play-off) Tournaments.
 * Minimizes byes in early rounds. Ensures any team that gets a bye in a round
 * is guaranteed to play in the immediate next round.
 */

/**
 * Generates all matches for a tournament.
 * @param {string} tournamentId - The Supabase UUID of the tournament
 * @param {Array<{ id: string, name: string }>} teams - The array of team objects
 * @returns {Array<object>} Flat array of matches to be inserted in the DB
 */
export function generateMatchesForTournament(tournamentId, teams) {
  const N = teams.length;
  if (N < 2) throw new Error("Turnir yaratish uchun kamida 2 ta jamoa kerak.");

  const allMatches = [];
  
  // currentSlots stores the items in the current round.
  // Each element is either:
  // - { type: 'team', team: teamObj }
  // - { type: 'match_winner', matchId: string }
  let currentSlots = teams.map(t => ({ type: 'team', team: t }));
  let roundNumber = 1;

  while (currentSlots.length > 1) {
    const roundMatches = [];
    const nextSlots = [];

    // Number of matches in this round is floor(slots.length / 2)
    const matchCount = Math.floor(currentSlots.length / 2);

    for (let m = 0; m < matchCount; m++) {
      const slot1 = currentSlots[2 * m];
      const slot2 = currentSlots[2 * m + 1];
      const matchId = crypto.randomUUID();

      const match = {
        id: matchId,
        tournament_id: tournamentId,
        round_number: roundNumber,
        match_order: m + 1,
        team1_id: slot1.type === 'team' ? slot1.team.id : null,
        team2_id: slot2.type === 'team' ? slot2.team.id : null,
        score1: null,
        score2: null,
        penalty1: null,
        penalty2: null,
        winner_id: null,
        next_match_id: null,
        next_match_slot: null
      };

      // Link previous matches to this match
      if (slot1.type === 'match_winner') {
        const prevMatch = allMatches.find(x => x.id === slot1.matchId);
        if (prevMatch) {
          prevMatch.next_match_id = matchId;
          prevMatch.next_match_slot = 1;
        }
      }
      if (slot2.type === 'match_winner') {
        const prevMatch = allMatches.find(x => x.id === slot2.matchId);
        if (prevMatch) {
          prevMatch.next_match_id = matchId;
          prevMatch.next_match_slot = 2;
        }
      }

      roundMatches.push(match);
      nextSlots.push({ type: 'match_winner', matchId: matchId });
    }

    // If the number of slots in the current round is odd, the last slot gets a bye.
    if (currentSlots.length % 2 !== 0) {
      const byeSlot = currentSlots[currentSlots.length - 1];
      // Put the bye slot at the FRONT of the next round's slots list.
      // This guarantees that the bye team/slot will play in the next round,
      // as requested by the user.
      nextSlots.unshift(byeSlot);
    }

    allMatches.push(...roundMatches);
    currentSlots = nextSlots;
    roundNumber++;
  }

  return allMatches;
}
