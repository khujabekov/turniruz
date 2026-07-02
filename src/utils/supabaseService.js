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
  const text = `🏆 <b>Yangi mini-futbol turniri yaratildi!</b>\n\n📌 Turnir nomi: <b>${tournamentName}</b>\n🔑 Admin paroli: <code>${adminCode}</code>\n\nJonli havola: <a href="${window.location.origin}/#admin">${window.location.origin}/#admin</a>`;
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
export async function updateMatchResult(matchId, score1, score2, penalty1, penalty2, winnerId, oldWinnerId) {
  // 1. Update the current match
  const { data: updatedMatch, error: updateError } = await supabase
    .from('matches')
    .update({
      score1: score1 !== '' && score1 !== null ? parseInt(score1) : null,
      score2: score2 !== '' && score2 !== null ? parseInt(score2) : null,
      penalty1: penalty1 !== '' && penalty1 !== null ? parseInt(penalty1) : null,
      penalty2: penalty2 !== '' && penalty2 !== null ? parseInt(penalty2) : null,
      winner_id: winnerId || null
    })
    .eq('id', matchId)
    .select()
    .single();

  if (updateError) throw updateError;

  // 2. Propagate winner or clear next rounds if winner changed
  await propagateWinner(updatedMatch, winnerId, oldWinnerId);

  return updatedMatch;
}

/**
 * Helper function to recursively propagate match results or clear future match slots.
 */
async function propagateWinner(match, winnerId, oldWinnerId) {
  if (!match.next_match_id) {
    // This is the final match. If winnerId is set, we can optionally mark the tournament as completed.
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

  const isTeam1Slot = match.match_order % 2 !== 0;

  // Set up the update data
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

  // If winner has changed or was cleared, we must clear the score and winner of the next match
  // and recursively propagate this clearing forward.
  if (oldWinnerId && oldWinnerId !== winnerId) {
    const nextMatchOldWinner = updatedNextMatch.winner_id;

    // Reset scores & winner on the next match
    const { data: clearedNextMatch, error: clearError } = await supabase
      .from('matches')
      .update({
        score1: null,
        score2: null,
        penalty1: null,
        penalty2: null,
        winner_id: null
      })
      .eq('id', nextMatch.id)
      .select()
      .single();

    if (clearError) return;

    // If the next match also had a winner, propagate the clearing recursively
    if (nextMatchOldWinner) {
      await propagateWinner(clearedNextMatch, null, nextMatchOldWinner);
    }
  }
}
