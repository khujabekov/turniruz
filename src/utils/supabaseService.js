import { supabase } from './supabaseClient';
import { generateMatchesForTournament } from './bracketGenerator';

// UUID Generator Fallback
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Local Storage Helper functions
function getLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    return [];
  }
}

// Write helper
function setLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Event Dispatcher for same-tab updates
function notifyLocalChange() {
  window.dispatchEvent(new Event('local-db-change'));
}

// Database Mode Caching
let dbMode = null; // 'supabase' | 'local'

/**
 * Returns the active database mode.
 * Checks reachability of the Supabase endpoint with a timeout to avoid hangs.
 */
export async function getDbMode() {
  if (dbMode !== null) return dbMode;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder-url') || supabaseAnonKey.includes('placeholder-anon-key')) {
    dbMode = 'local';
    console.log('Database Mode: LocalStorage (No valid Supabase credentials)');
    return dbMode;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${supabaseUrl}/rest/v1/tournaments?select=id&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (response.ok) {
      dbMode = 'supabase';
      console.log('Database Mode: Supabase Online');
    } else {
      dbMode = 'local';
      console.log('Database Mode: LocalStorage (Supabase endpoint returned non-OK status)');
    }
  } catch (e) {
    dbMode = 'local';
    console.log('Database Mode: LocalStorage (Supabase test fetch failed, offline or DNS failure)');
  }
  return dbMode;
}

/**
 * Subscribe to changes in tournaments/matches.
 * Automatically wraps Realtime channel for Supabase and window/event listener for LocalStorage.
 */
export function subscribeToChanges(tournamentId, callback) {
  let channel = null;
  let localListener = null;
  let customListener = null;

  getDbMode().then(mode => {
    if (mode === 'supabase') {
      const filter = tournamentId ? `tournament_id=eq.${tournamentId}` : undefined;
      channel = supabase
        .channel(tournamentId ? `matches-${tournamentId}` : 'tours-global')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: tournamentId ? 'matches' : 'tournaments',
          filter: filter
        }, () => {
          callback();
        })
        .subscribe();
    } else {
      // Sync across tabs
      localListener = (e) => {
        if (e.key === 'local_tournaments' || e.key === 'local_teams' || e.key === 'local_matches') {
          callback();
        }
      };
      window.addEventListener('storage', localListener);

      // Sync same tab
      customListener = () => callback();
      window.addEventListener('local-db-change', customListener);
    }
  });

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
    if (localListener) {
      window.removeEventListener('storage', localListener);
    }
    if (customListener) {
      window.removeEventListener('local-db-change', customListener);
    }
  };
}

/**
 * Fetch all tournaments.
 */
export async function fetchTournaments() {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } else {
    const tours = getLocalData('local_tournaments');
    return tours.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

/**
 * Fetch a single tournament by ID.
 */
export async function fetchTournamentById(id) {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  } else {
    const tours = getLocalData('local_tournaments');
    const tour = tours.find(t => t.id === id);
    if (!tour) throw new Error('Turnir topilmadi.');
    return tour;
  }
}

/**
 * Fetch teams in a tournament.
 */
export async function fetchTeams(tournamentId) {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  } else {
    const teams = getLocalData('local_teams');
    return teams
      .filter(t => t.tournament_id === tournamentId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
}

/**
 * Fetch all matches in a tournament, ordered.
 */
export async function fetchMatches(tournamentId) {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true })
      .order('match_order', { ascending: true });
    if (error) throw error;
    return data;
  } else {
    const matches = getLocalData('local_matches');
    return matches
      .filter(m => m.tournament_id === tournamentId)
      .sort((a, b) => {
        if (a.round_number !== b.round_number) {
          return a.round_number - b.round_number;
        }
        return a.match_order - b.match_order;
      });
  }
}

/**
 * Fetch total teams count for a tournament.
 */
export async function getTeamCount(tournamentId) {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { count, error } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);
    if (error) throw error;
    return count || 0;
  } else {
    const teams = getLocalData('local_teams');
    return teams.filter(t => t.tournament_id === tournamentId).length;
  }
}

/**
 * Fetch tournament admin_code by ID.
 */
export async function fetchTournamentAdminCode(id) {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { data, error } = await supabase
      .from('tournaments')
      .select('admin_code')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data?.admin_code || null;
  } else {
    const tours = getLocalData('local_tournaments');
    const tour = tours.find(t => t.id === id);
    return tour?.admin_code || null;
  }
}

/**
 * Rename tournament by ID.
 */
export async function renameTournament(id, newName) {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { error } = await supabase
      .from('tournaments')
      .update({ name: newName })
      .eq('id', id);
    if (error) throw error;
  } else {
    const tours = getLocalData('local_tournaments');
    const updated = tours.map(t => t.id === id ? { ...t, name: newName } : t);
    setLocalData('local_tournaments', updated);
    notifyLocalChange();
  }
}

/**
 * Delete tournament by ID.
 */
export async function deleteTournament(id) {
  const mode = await getDbMode();
  if (mode === 'supabase') {
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } else {
    const tours = getLocalData('local_tournaments');
    const teams = getLocalData('local_teams');
    const matches = getLocalData('local_matches');

    setLocalData('local_tournaments', tours.filter(t => t.id !== id));
    setLocalData('local_teams', teams.filter(t => t.tournament_id !== id));
    setLocalData('local_matches', matches.filter(m => m.tournament_id !== id));

    notifyLocalChange();
  }
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
 * Helper to shuffle array (Fisher-Yates) using cryptographically secure random values
 */
function shuffleArray(array) {
  const arr = [...array];
  const randomValues = new Uint32Array(1);
  for (let i = arr.length - 1; i > 0; i--) {
    window.crypto.getRandomValues(randomValues);
    const j = randomValues[0] % (i + 1);
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

  const adminCode = Math.floor(100000 + Math.random() * 900000).toString();
  const mode = await getDbMode();

  if (mode === 'supabase') {
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .insert([{ name, status: 'active', admin_code: adminCode }])
      .select()
      .single();

    if (tError) throw tError;

    try {
      const shuffledNames = shuffleArray(teamNames);
      const teamsToInsert = shuffledNames.map(teamName => ({
        tournament_id: tournament.id,
        name: teamName
      }));

      const { data: insertedTeams, error: teamsError } = await supabase
        .from('teams')
        .insert(teamsToInsert)
        .select();

      if (teamsError) throw teamsError;

      const generatedMatches = generateMatchesForTournament(tournament.id, insertedTeams);
      const { error: matchesError } = await supabase
        .from('matches')
        .insert(generatedMatches);

      if (matchesError) throw matchesError;

      sendToTelegram(name, adminCode);
      return tournament;
    } catch (error) {
      await supabase.from('tournaments').delete().eq('id', tournament.id);
      throw error;
    }
  } else {
    // Local Storage logic
    const tourId = generateUUID();
    const newTour = {
      id: tourId,
      name,
      status: 'active',
      admin_code: adminCode,
      created_at: new Date().toISOString()
    };

    const shuffledNames = shuffleArray(teamNames);
    const newTeams = shuffledNames.map(teamName => ({
      id: generateUUID(),
      tournament_id: tourId,
      name: teamName,
      created_at: new Date().toISOString()
    }));

    const generatedMatches = generateMatchesForTournament(tourId, newTeams);
    const finalMatches = generatedMatches.map(m => ({
      ...m,
      created_at: new Date().toISOString()
    }));

    const tours = getLocalData('local_tournaments');
    tours.push(newTour);
    setLocalData('local_tournaments', tours);

    const teams = getLocalData('local_teams');
    teams.push(...newTeams);
    setLocalData('local_teams', teams);

    const matches = getLocalData('local_matches');
    matches.push(...finalMatches);
    setLocalData('local_matches', matches);

    notifyLocalChange();
    sendToTelegram(name, adminCode);

    return newTour;
  }
}

/**
 * Updates a match score and propagates the winner to the next round.
 * Handles cascading resets/corrections recursively.
 */
export async function updateMatchResult(matchId, score1, score2, penalty1, penalty2, winnerId, oldWinnerId, isCompleted = false, matchStatus = 'live') {
  const mode = await getDbMode();

  if (mode === 'supabase') {
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

    const targetWinnerId = isCompleted ? winnerId : null;
    await propagateWinner(updatedMatch, targetWinnerId, oldWinnerId);

    return updatedMatch;
  } else {
    const matches = getLocalData('local_matches');
    const matchIdx = matches.findIndex(m => m.id === matchId);
    if (matchIdx === -1) throw new Error("O'yin topilmadi.");

    const updatedMatch = {
      ...matches[matchIdx],
      score1: score1 !== '' && score1 !== null ? parseInt(score1) : null,
      score2: score2 !== '' && score2 !== null ? parseInt(score2) : null,
      penalty1: penalty1 !== '' && penalty1 !== null ? parseInt(penalty1) : null,
      penalty2: penalty2 !== '' && penalty2 !== null ? parseInt(penalty2) : null,
      winner_id: winnerId || null,
      is_completed: isCompleted,
      match_status: isCompleted ? 'completed' : matchStatus
    };

    matches[matchIdx] = updatedMatch;
    setLocalData('local_matches', matches);

    const targetWinnerId = isCompleted ? winnerId : null;
    await propagateWinnerLocal(updatedMatch, targetWinnerId, oldWinnerId);

    notifyLocalChange();
    return updatedMatch;
  }
}

/**
 * Helper function to recursively propagate match results or clear future match slots in Supabase.
 */
async function propagateWinner(match, winnerId, oldWinnerId) {
  if (!match.next_match_id) {
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

  const { data: nextMatch, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', match.next_match_id)
    .single();

  if (error || !nextMatch) return;

  const isTeam1Slot = match.next_match_slot !== undefined && match.next_match_slot !== null
    ? match.next_match_slot === 1
    : match.match_order % 2 !== 0;
  const updatePayload = {};
  if (isTeam1Slot) {
    updatePayload.team1_id = winnerId;
  } else {
    updatePayload.team2_id = winnerId;
  }

  const { data: updatedNextMatch, error: nextUpdateError } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', nextMatch.id)
    .select()
    .single();

  if (nextUpdateError) return;

  const oldWinnerInNext = updatedNextMatch.winner_id;
  if (oldWinnerId && oldWinnerId !== winnerId) {
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

    if (oldWinnerInNext) {
      await propagateWinner(clearedNextMatch, null, oldWinnerInNext);
    }
    return;
  }

  if (winnerId && updatedNextMatch) {
    const hasT1 = updatedNextMatch.team1_id != null;
    const hasT2 = updatedNextMatch.team2_id != null;

    if ((hasT1 && !hasT2) || (!hasT1 && hasT2)) {
      const { data: feeders } = await supabase
        .from('matches')
        .select('id')
        .eq('next_match_id', updatedNextMatch.id);

      const feederCount = feeders ? feeders.length : 0;

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
          await propagateWinner(autoCompleted, byeWinner, null);
        }
      }
    }
  }
}

/**
 * Local counterpart for propagateWinner
 */
async function propagateWinnerLocal(match, winnerId, oldWinnerId) {
  const matches = getLocalData('local_matches');
  const tournaments = getLocalData('local_tournaments');

  if (!match.next_match_id) {
    const updated = tournaments.map(t => t.id === match.tournament_id ? { ...t, status: winnerId ? 'completed' : 'active' } : t);
    setLocalData('local_tournaments', updated);
    return;
  }

  const nextMatchIdx = matches.findIndex(m => m.id === match.next_match_id);
  if (nextMatchIdx === -1) return;
  const nextMatch = matches[nextMatchIdx];

  const isTeam1Slot = match.next_match_slot !== undefined && match.next_match_slot !== null
    ? match.next_match_slot === 1
    : match.match_order % 2 !== 0;

  if (isTeam1Slot) {
    nextMatch.team1_id = winnerId;
  } else {
    nextMatch.team2_id = winnerId;
  }

  matches[nextMatchIdx] = nextMatch;
  setLocalData('local_matches', matches);

  const oldWinnerInNext = nextMatch.winner_id;
  if (oldWinnerId && oldWinnerId !== winnerId) {
    nextMatch.score1 = null;
    nextMatch.score2 = null;
    nextMatch.penalty1 = null;
    nextMatch.penalty2 = null;
    nextMatch.winner_id = null;
    nextMatch.is_completed = false;
    nextMatch.match_status = 'waiting';

    matches[nextMatchIdx] = nextMatch;
    setLocalData('local_matches', matches);

    if (oldWinnerInNext) {
      await propagateWinnerLocal(nextMatch, null, oldWinnerInNext);
    }
    return;
  }

  if (winnerId) {
    const hasT1 = nextMatch.team1_id != null;
    const hasT2 = nextMatch.team2_id != null;

    if ((hasT1 && !hasT2) || (!hasT1 && hasT2)) {
      const feederCount = matches.filter(m => m.next_match_id === nextMatch.id).length;

      if (feederCount <= 1) {
        const byeWinner = nextMatch.team1_id || nextMatch.team2_id;
        nextMatch.winner_id = byeWinner;
        nextMatch.is_completed = true;
        nextMatch.match_status = 'completed';

        matches[nextMatchIdx] = nextMatch;
        setLocalData('local_matches', matches);

        await propagateWinnerLocal(nextMatch, byeWinner, null);
      }
    }
  }
}

/**
 * Fetch stats for all completed tournaments (Archive).
 */
export async function fetchArchiveStats() {
  const mode = await getDbMode();
  let tournaments;

  if (mode === 'supabase') {
    const { data: tData, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    if (tError) throw tError;
    tournaments = tData;
  } else {
    const tData = getLocalData('local_tournaments');
    tournaments = tData
      .filter(t => t.status === 'completed')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const archive = [];
  for (const t of tournaments) {
    let tMatches, tTeams;

    if (mode === 'supabase') {
      const { data: mData, error: mError } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', t.id);
      if (mError) continue;
      tMatches = mData;

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', t.id);
      if (teamsError) continue;
      tTeams = teamsData;
    } else {
      const allMatches = getLocalData('local_matches');
      tMatches = allMatches.filter(m => m.tournament_id === t.id);

      const allTeams = getLocalData('local_teams');
      tTeams = allTeams.filter(team => team.tournament_id === t.id);
    }

    const teamMap = {};
    tTeams.forEach(tm => { teamMap[tm.id] = tm.name; });

    const finalMatch = tMatches.find(m => m.next_match_id === null && m.round_number > 0);
    const winnerName = finalMatch && finalMatch.winner_id ? (teamMap[finalMatch.winner_id] || 'Nomuvofiq') : 'Aniqlanmagan';

    const teamGoals = {};
    tTeams.forEach(tm => { teamGoals[tm.id] = 0; });

    let totalGoalsScored = 0;
    let totalMatchesPlayed = 0;

    tMatches.forEach(m => {
      if (m.match_status === 'bye') return;
      if (m.score1 != null) {
        teamGoals[m.team1_id] = (teamGoals[m.team1_id] || 0) + m.score1;
        totalGoalsScored += m.score1;
      }
      if (m.score2 != null) {
        teamGoals[m.team2_id] = (teamGoals[m.team2_id] || 0) + m.score2;
        totalGoalsScored += m.score2;
      }
      if (m.is_completed) {
        totalMatchesPlayed++;
      }
    });

    let topScorerTeamId = null;
    let maxGoals = -1;
    Object.keys(teamGoals).forEach(teamId => {
      if (teamGoals[teamId] > maxGoals) {
        maxGoals = teamGoals[teamId];
        topScorerTeamId = teamId;
      }
    });

    const topScorerName = topScorerTeamId ? teamMap[topScorerTeamId] : 'Yo\'q';

    archive.push({
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      winner: winnerName,
      topScorer: topScorerName,
      topScorerGoals: maxGoals > 0 ? maxGoals : 0,
      totalMatches: totalMatchesPlayed,
      totalGoals: totalGoalsScored,
      teamsCount: tTeams.length
    });
  }

  return archive;
}

/**
 * Fetch global team rankings across all tournaments.
 */
export async function fetchGlobalTeamRankings() {
  const mode = await getDbMode();
  let tournaments, allTeams, allMatches;

  if (mode === 'supabase') {
    const { data: tData, error: tError } = await supabase
      .from('tournaments')
      .select('id, name, status');
    if (tError) throw tError;
    tournaments = tData;

    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*');
    if (teamsError) throw teamsError;
    allTeams = teamsData;

    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('is_completed', true);
    if (matchesError) throw matchesError;
    allMatches = matchesData;
  } else {
    tournaments = getLocalData('local_tournaments');
    allTeams = getLocalData('local_teams');
    allMatches = getLocalData('local_matches').filter(m => m.is_completed);
  }

  const teamIdToName = {};
  allTeams.forEach(t => {
    teamIdToName[t.id] = t.name;
  });

  const rankings = {};

  allTeams.forEach(t => {
    const cleanName = t.name.trim();
    if (!rankings[cleanName]) {
      rankings[cleanName] = {
        name: cleanName,
        tournamentsCount: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        goalsScored: 0,
        points: 0,
        tournamentsList: new Set()
      };
    }
    rankings[cleanName].tournamentsList.add(t.tournament_id);
  });

  allMatches.forEach(m => {
    const t1Name = teamIdToName[m.team1_id]?.trim();
    const t2Name = teamIdToName[m.team2_id]?.trim();

    if (m.match_status === 'bye') return;

    if (t1Name && rankings[t1Name]) {
      rankings[t1Name].matchesPlayed++;
      if (m.score1 != null) {
        rankings[t1Name].goalsScored += m.score1;
      }
      if (m.winner_id === m.team1_id) {
        rankings[t1Name].wins++;
        rankings[t1Name].points += 3;
      } else {
        rankings[t1Name].losses++;
      }
    }

    if (t2Name && rankings[t2Name]) {
      rankings[t2Name].matchesPlayed++;
      if (m.score2 != null) {
        rankings[t2Name].goalsScored += m.score2;
      }
      if (m.winner_id === m.team2_id) {
        rankings[t2Name].wins++;
        rankings[t2Name].points += 3;
      } else {
        rankings[t2Name].losses++;
      }
    }
  });

  const result = Object.values(rankings).map(r => {
    r.tournamentsCount = r.tournamentsList.size;
    r.points += r.tournamentsCount * 1; // 1 point for participation
    delete r.tournamentsList;
    return r;
  });

  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.goalsScored - a.goalsScored;
  });

  return result;
}
