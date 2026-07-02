import { supabase } from './supabaseClient';
import { generateMatchesForTournament } from './bracketGenerator';

/**
 * Fetch all tournaments.
 */
export async function fetchTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Fetch a single tournament by ID.
 */
export async function fetchTournamentById(id) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch teams in a tournament.
 */
export async function fetchTeams(tournamentId) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Fetch all matches in a tournament, ordered.
 */
export async function fetchMatches(tournamentId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_number', { ascending: true })
    .order('match_order', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Send credentials notification to Telegram Bot.
 */
async function sendToTelegram(tournamentName, adminCode) {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram Bot Token yoki Chat ID topilmadi. Telegram xabar yuborilmadi.');
    return;
  }
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const text = `🏆 <b>Yangi mini-futbol turniri hosil qilindi</b>\n\n📅 Sana: <b>${dateStr}</b>\n📌 Turnir nomi: <b>${tournamentName}</b>\n🔑 Admin paroli: <code>${adminCode}</code>\n\nJonli havola: <a href="${window.location.origin}/#admin">${window.location.origin}/#admin</a>`;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    if (!res.ok) {
      console.error('Telegram botga yuborishda xatolik:', await res.text());
    }
  } catch (err) {
    console.error('Telegram bot request failed:', err);
  }
}

/**
 * Helper to shuffle array (Fisher-Yates)
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Create a new tournament with a list of teams, generating the play-off bracket automatically.
 * @param {string} name - Tournament name
 * @param {Array<string>} teamNames - List of team names
 */
export async function createNewTournament(name, teamNames) {
  if (teamNames.length < 2) {
    throw new Error('Turnirda kamida 2 ta jamoa ishtirok etishi kerak.');
  }

  // Generate 6-digit random passcode
  const adminCode = Math.floor(100000 + Math.random() * 900000).toString();

  // 1. Insert Tournament with admin_code
  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .insert([{ name, status: 'active', admin_code: adminCode }])
    .select()
    .single();

  if (tError) throw tError;

  try {
    // Shuffle the team names array to randomize match pairing
    const shuffledNames = shuffleArray(teamNames);

    // 2. Insert Teams in bulk
    const teamsToInsert = shuffledNames.map(teamName => ({
      tournament_id: tournament.id,
      name: teamName
    }));

    const { data: insertedTeams, error: teamsError } = await supabase
      .from('teams')
      .insert(teamsToInsert)
      .select();

    if (teamsError) throw teamsError;

    // 3. Generate Matches locally
    const generatedMatches = generateMatchesForTournament(tournament.id, insertedTeams);

    // 4. Insert Matches in bulk
    const { error: matchesError } = await supabase
      .from('matches')
      .insert(generatedMatches);

    if (matchesError) throw matchesError;

    // Send Telegram Notification asynchronously
    sendToTelegram(name, adminCode);

    return tournament;
  } catch (error) {
    // Clean up tournament if any sub-step fails
    await supabase.from('tournaments').delete().eq('id', tournament.id);
    throw error;
  }
}

/**
 * Updates a match score and propagates the winner to the next round.
 * Handles cascading resets/corrections recursively.
 */
export async function updateMatchResult(matchId, score1, score2, penalty1, penalty2, winnerId, oldWinnerId, isCompleted = false, matchStatus = 'live') {
  // 1. Update the current match
  const { data: updatedMatch, error: updateError } = await supabase
    .from('matches')
    .update({
      score1: score1 !== '' && score1 !== null ? parseInt(score1) : null,
      score2: score2 !== '' && score2 !== null ? parseInt(score2) : null,
      penalty1: penalty1 !== '' && penalty1 !== null ? parseInt(penalty1) : null,
      penalty2: penalty2 !== '' && penalty2 !== null ? parseInt(penalty2) : null,
      winner_id: winnerId || null,
      is_completed: isCompleted,
      match_status: isCompleted ? 'completed' : matchStatus
    })
    .eq('id', matchId)
    .select()
    .single();

  if (updateError) throw updateError;

  // 2. Propagate winner or clear next rounds if winner changed or match is not fully completed yet
  const targetWinnerId = isCompleted ? winnerId : null;
  await propagateWinner(updatedMatch, targetWinnerId, oldWinnerId);

  return updatedMatch;
}

/**
 * Helper function to recursively propagate match results or clear future match slots.
 * match_order odd → team1_id, match_order even → team2_id in the next match.
 */
async function propagateWinner(match, winnerId, oldWinnerId) {
  if (!match.next_match_id) {
    // This is the final match.
    if (winnerId) {
      await supabase
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', match.tournament_id);
    } else {
      await supabase
        .from('tournaments')
        .update({ status: 'active' })
        .eq('id', match.tournament_id);
    }
    return;
  }

  // Fetch the next match
  const { data: nextMatch, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', match.next_match_id)
    .single();

  if (error || !nextMatch) return;

  // Determine slot: use next_match_slot (1 for team1_id, 2 for team2_id) if set, otherwise fallback to match_order
  const isTeam1Slot = match.next_match_slot !== undefined && match.next_match_slot !== null
    ? match.next_match_slot === 1
    : match.match_order % 2 !== 0;
  const updatePayload = {};
  if (isTeam1Slot) {
    updatePayload.team1_id = winnerId;
  } else {
    updatePayload.team2_id = winnerId;
  }

  // Update next match's team slot
  const { data: updatedNextMatch, error: nextUpdateError } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', nextMatch.id)
    .select()
    .single();

  if (nextUpdateError) return;

  // If winner has changed or was cleared (or if match became uncompleted),
  // we must clear the score, winner, and completion status of the next match
  // and recursively propagate this clearing forward.
  const oldWinnerInNext = updatedNextMatch.winner_id;
  if (oldWinnerId && oldWinnerId !== winnerId) {
    // Reset scores, winner & completion on the next match
    const { data: clearedNextMatch, error: clearError } = await supabase
      .from('matches')
      .update({
        score1: null,
        score2: null,
        penalty1: null,
        penalty2: null,
        winner_id: null,
        is_completed: false
      })
      .eq('id', nextMatch.id)
      .select()
      .single();

    if (clearError) return;

    // If the next match also had a winner, propagate the clearing recursively
    if (oldWinnerInNext) {
      await propagateWinner(clearedNextMatch, null, oldWinnerInNext);
    }
    return;
  }

  // Auto-bye detection: if the next match now has exactly 1 team
  // and no other match feeds into the empty slot, auto-complete as bye.
  if (winnerId && updatedNextMatch) {
    const hasT1 = updatedNextMatch.team1_id != null;
    const hasT2 = updatedNextMatch.team2_id != null;

    if ((hasT1 && !hasT2) || (!hasT1 && hasT2)) {
      // Check how many matches feed into this next match
      const { data: feeders } = await supabase
        .from('matches')
        .select('id')
        .eq('next_match_id', updatedNextMatch.id);

      const feederCount = feeders ? feeders.length : 0;

      // If only 1 feeder → structural bye, auto-complete
      if (feederCount <= 1) {
        const byeWinner = updatedNextMatch.team1_id || updatedNextMatch.team2_id;
        const { data: autoCompleted } = await supabase
          .from('matches')
          .update({
            winner_id: byeWinner,
            is_completed: true,
            match_status: 'completed'
          })
          .eq('id', updatedNextMatch.id)
          .select()
          .single();

        if (autoCompleted) {
          // Cascade: propagate the bye winner to the next round
          await propagateWinner(autoCompleted, byeWinner, null);
        }
      }
    }
  }
}


