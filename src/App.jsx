import React, { useState, useEffect } from 'react';
import {
  fetchTournaments,
  fetchTournamentById,
  fetchTeams,
  fetchMatches,
  updateMatchResult,
  fetchTournamentAdminCode,
  subscribeToChanges,
  getDbMode
} from './utils/supabaseService';
import BracketView from './components/BracketView';
import AdminPanel from './components/AdminPanel';
import MatchModal from './components/MatchModal';
import TournamentArchive from './components/TournamentArchive';
import TeamRankings from './components/TeamRankings';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(window.location.hash === '#admin');
  const [dbMode, setDbMode] = useState('local');

  useEffect(() => {
    getDbMode().then(mode => setDbMode(mode));
  }, []);
  const [tournaments, setTournaments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeTour, setActiveTour] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selMatch, setSelMatch] = useState(null);
  const [viewTab, setViewTab] = useState('live'); // 'live' | 'archive' | 'rankings'

  // Authentication states for selected tournament
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [enteredPass, setEnteredPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [passcodes, setPasscodes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tour_passcodes') || '{}');
    } catch {
      return {};
    }
  });

  const isEnvOk = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  /* hash-based routing */
  useEffect(() => {
    const onHash = () => {
      const isHashAdmin = window.location.hash === '#admin';
      setIsAdmin(isHashAdmin);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* load tournaments list */
  const loadTours = async (pickFirst = false) => {
    try {
      const data = await fetchTournaments();
      setTournaments(data);
      if (pickFirst && data.length > 0) setActiveId(data[0].id);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadTours(true);
    const unsubscribe = subscribeToChanges(null, () => loadTours(false));
    return () => unsubscribe();
  }, []);

  /* load active tournament details */
  const loadDetails = async (id) => {
    if (!id) { setActiveTour(null); setTeams([]); setMatches([]); return; }
    setLoading(true);
    try {
      const tour = await fetchTournamentById(id);
      setActiveTour(tour);
      setTeams(await fetchTeams(id));
      setMatches(await fetchMatches(id));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadDetails(activeId);
    if (!activeId) return;
    const unsubscribe = subscribeToChanges(activeId, async () => {
      setMatches(await fetchMatches(activeId));
      try {
        const t = await fetchTournamentById(activeId);
        if (t) setActiveTour(t);
      } catch (e) { console.error(e); }
    });
    return () => unsubscribe();
  }, [activeId]);

  // Sync auth status when activeId or passcodes change
  useEffect(() => {
    if (!activeId) {
      setIsAdminAuthorized(false);
      setEnteredPass('');
      setAuthError('');
      return;
    }
    const checkAuth = async () => {
      try {
        const adminCode = await fetchTournamentAdminCode(activeId);
        if (!adminCode) {
          setIsAdminAuthorized(true);
        } else {
          const cachedCode = passcodes[activeId];
          if (cachedCode === adminCode) {
            setIsAdminAuthorized(true);
          } else {
            setIsAdminAuthorized(false);
          }
        }
      } catch {
        setIsAdminAuthorized(false);
      }
    };
    checkAuth();
  }, [activeId, passcodes]);

  const handleVerify = async () => {
    if (!activeId) return;
    setAuthError('');
    try {
      const adminCode = await fetchTournamentAdminCode(activeId);
      if (adminCode && adminCode === enteredPass.trim()) {
        const updated = { ...passcodes, [activeId]: enteredPass.trim() };
        setPasscodes(updated);
        localStorage.setItem('tour_passcodes', JSON.stringify(updated));
        setIsAdminAuthorized(true);
        setEnteredPass('');
      } else {
        setAuthError("Noto'g'ri parol kiritildi!");
      }
    } catch {
      setAuthError("Parolni tekshirishda xatolik yuz berdi.");
    }
  };

  const handleSave = async (payload) => {
    try {
      await updateMatchResult(
        payload.matchId,
        payload.score1,
        payload.score2,
        payload.penalty1,
        payload.penalty2,
        payload.winnerId,
        payload.oldWinnerId,
        payload.isCompleted,
        payload.matchStatus
      );
      // Only close the modal if match was finalized (isCompleted) or cleared (score1 === null)
      if (payload.isCompleted || payload.score1 === null) {
        setSelMatch(null);
      }
    } catch (err) { alert('Xatolik: ' + err.message); }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* DB offline notice */}
      {dbMode === 'local' && (
        <div className="alert-warn" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid rgba(245,158,11,0.3)', textAlign: 'center', fontSize: 12, padding: '10px 16px' }}>
          ⚠️ <strong>Oflayn rejim:</strong> Supabase bilan aloqa o'rnatilmadi. Ma'lumotlar faqatgina ushbu brauzerda (LocalStorage) saqlanadi.
        </div>
      )}

      {/* Header */}
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="app-logo">
          <div className="app-logo-icon">🏆</div>
          <div>
            <div className="app-logo-title">Play-off Arena</div>
            <div className="app-logo-subtitle">Mini-Futbol Turnirlari</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* DB Mode Indicator */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '4px 10px', 
              borderRadius: '20px', 
              fontSize: '11px', 
              fontWeight: 700, 
              background: dbMode === 'supabase' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
              border: `1px solid ${dbMode === 'supabase' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
              color: dbMode === 'supabase' ? 'var(--c-green)' : 'var(--c-gold)'
            }}
            title={dbMode === 'supabase' ? "Supabase ma'lumotlar bazasiga ulangan" : "LocalStorage (Oflayn) rejimida ishlamoqda. Ma'lumotlar brauzerda saqlanadi."}
          >
            <span style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: dbMode === 'supabase' ? 'var(--c-green)' : 'var(--c-gold)', 
              display: 'inline-block',
              animation: 'ping2 1.5s ease-in-out infinite'
            }} />
            {dbMode === 'supabase' ? 'Supabase' : 'Oflayn (Local)'}
          </div>

          {/* Desktop navbar links - ONLY visible if user is currently in admin mode */}
          {isAdmin && (
            <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { window.location.hash = ''; setIsAdmin(false); }}
                style={{ color: 'var(--c-rose)', fontWeight: 700, padding: '6px 12px', border: '1px solid rgba(244,63,94,0.2)' }}
              >
                🔒 Chiqish
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main" style={!isAdmin ? { paddingBottom: '16px' } : undefined}>


        {isAdmin ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <AdminPanel onSelectTournament={setActiveId} activeTournamentId={activeId} />

            {activeId && (
              isAdminAuthorized ? (
                <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 24 }}>
                  <h3 className="admin-results-title">
                    ⚙ Natijalarni Boshqarish: <span style={{ color: 'var(--c-green)' }}>{activeTour?.name}</span>
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--c-muted)' }}>
                    Hisob kiritish uchun o'yin kartasiga bosing.
                  </p>
                  {loading
                    ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
                    : <BracketView matches={matches} teams={teams} isAdmin onMatchClick={setSelMatch} />
                  }
                </div>
              ) : (
                <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 24, display: 'flex', justifyContent: 'center' }}>
                  <div className="glass" style={{ padding: 24, borderRadius: 16, maxWidth: 380, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontSize: 32 }}>🔑</div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 800 }}>Admin Boshqaruv Paroli</h3>
                    <p style={{ fontSize: 12, color: 'var(--c-muted)', margin: 0 }}>
                      Ushbu turnir setkasini boshqarish uchun 6 xonali parolni kiriting.
                    </p>
                    {authError && <div className="alert-error">{authError}</div>}
                    <input
                      type="password"
                      className="inp"
                      placeholder="6 xonali parol"
                      value={enteredPass}
                      onChange={e => setEnteredPass(e.target.value)}
                      style={{ textAlign: 'center', letterSpacing: '0.15em', fontWeight: 800 }}
                      onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleVerify}
                      style={{ width: '100%' }}
                    >
                      Tasdiqlash
                    </button>
                  </div>
                </div>
              )
            )}

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* View Tabs */}
            <div className="spectator-tabs" style={{ display: 'flex', gap: 8, background: 'rgba(30, 41, 59, 0.4)', padding: 4, borderRadius: 10, border: '1px solid var(--c-border)', marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setViewTab('live')}
                className={`admin-tab-btn${viewTab === 'live' ? ' active' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease', border: 'none' }}
              >
                ⚽ Jonli Turnir
              </button>
              <button
                type="button"
                onClick={() => setViewTab('archive')}
                className={`admin-tab-btn${viewTab === 'archive' ? ' active' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease', border: 'none' }}
              >
                📁 Turnirlar Arxivi
              </button>
              <button
                type="button"
                onClick={() => setViewTab('rankings')}
                className={`admin-tab-btn${viewTab === 'rankings' ? ' active' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease', border: 'none' }}
              >
                📊 Jamoalar Reytingi
              </button>
            </div>

            {viewTab === 'live' && (
              <>
                {/* Tournament picker */}
                {tournaments.length > 0 && (
                  <div className="tour-picker">
                    <div className="tour-picker-info">
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Turnirni Tanlang</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeTour?.name || '…'}</div>
                    </div>
                    <select
                      value={activeId || ''}
                      onChange={e => setActiveId(e.target.value)}
                      className="inp tour-picker-select"
                    >
                      {tournaments.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.status === 'completed' ? 'Yakunlangan' : 'Faol'})</option>
                      ))}
                    </select>
                    <div className="tour-picker-live">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-green)', display: 'inline-block', animation: 'ping2 1.5s ease-in-out infinite' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Jonli</span>
                    </div>
                  </div>
                )}

                {activeId ? (
                  loading
                    ? <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
                    : <BracketView matches={matches} teams={teams} isAdmin={false} />
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🏆</div>
                    <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Hozircha hech qanday turnir yo'q.</p>
                    <p style={{ fontSize: 13, marginTop: 8, color: 'var(--c-muted)' }}>
                      Tez orada yangi turnirlar tashkil etiladi. Sahifani kuzatib boring.
                    </p>
                  </div>
                )}
              </>
            )}

            {viewTab === 'archive' && <TournamentArchive />}

            {viewTab === 'rankings' && <TeamRankings />}
          </div>
        )}
      </main>


      {/* Footer (desktop only) */}
      <footer className="app-footer">
        © {new Date().getFullYear()} Play-off Arena • Mini-Futbol Turnirlari Platformasi
      </footer>

      {/* Match modal */}
      {selMatch && (
        <MatchModal
          isOpen={true}
          onClose={() => setSelMatch(null)}
          match={selMatch}
          team1={teams.find(t => t.id === selMatch.team1_id)}
          team2={teams.find(t => t.id === selMatch.team2_id)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
