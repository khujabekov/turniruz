import React, { useState, useEffect } from 'react';
import { createNewTournament, fetchTournaments } from '../utils/supabaseService';
import { supabase } from '../utils/supabaseClient';

export default function AdminPanel({ onSelectTournament, activeTournamentId }) {
  const [tournaments, setTournaments] = useState([]);
  const [name, setName] = useState('');
  const [teamsText, setTeamsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [tDetails, setTDetails] = useState({});

  const load = async () => {
    try {
      const tours = await fetchTournaments();
      setTournaments(tours);
      
      // Fetch team counts for each tournament
      const counts = {};
      for (const t of tours) {
        const { count, error: countErr } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id);
        if (!countErr) {
          counts[t.id] = count || 0;
        }
      }
      setTDetails(counts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('admin-tours')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const handleRename = async (id, currentName, e) => {
    e.stopPropagation();
    const newName = window.prompt("Turnir uchun yangi nom kiriting:", currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    try {
      const { error: renameErr } = await supabase
        .from('tournaments')
        .update({ name: newName.trim() })
        .eq('id', id);
      if (renameErr) throw renameErr;
      load();
    } catch (err) {
      alert("Xatolik: " + err.message);
    }
  };

  const handleCopyLink = (id, e) => {
    e.stopPropagation();
    const adminLink = `${window.location.origin}/#admin`;
    navigator.clipboard.writeText(adminLink);
    alert("Admin paneli havolasi clipboardga nusxalandi! Rejimga o'tish uchun brauzerda oching.");
  };




  const [teamCount, setTeamCount] = useState(0);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'create'

  useEffect(() => {
    setTeamCount(teamsText.split('\n').filter(t => t.trim()).length);
  }, [teamsText]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name.trim()) { setError('Turnir nomini kiriting.'); return; }
    const teamNames = teamsText.split('\n').map(t => t.trim()).filter(Boolean);
    if (teamNames.length < 2) { setError('Kamida 2 ta jamoa nomini kiriting.'); return; }
    setLoading(true);
    try {
      const t = await createNewTournament(name.trim(), teamNames);
      setSuccess(`"${t.name}" turniri muvaffaqiyatli hosil qilindi!`);
      setName(''); setTeamsText('');
      onSelectTournament(t.id);
      load();
      setActiveTab('list'); // Go back to list tab on success
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Turnirni o'chirib tashlamoqchimisiz?")) return;

    try {
      // 1. Fetch tournament details to check if admin_code is set
      const { data: tour, error: fetchErr } = await supabase
        .from('tournaments')
        .select('admin_code')
        .eq('id', id)
        .single();

      if (fetchErr) throw fetchErr;

      // 2. If it has a code, check cached or prompt the user
      if (tour && tour.admin_code) {
        let cachedPasscodes = {};
        try {
          cachedPasscodes = JSON.parse(localStorage.getItem('tour_passcodes') || '{}');
        } catch {
          cachedPasscodes = {};
        }

        const cached = cachedPasscodes[id];
        if (cached !== tour.admin_code) {
          const pass = window.prompt("Turnirni o'chirish uchun 6 xonali parolni kiriting:");
          if (!pass) return; // cancelled
          if (pass.trim() !== tour.admin_code) {
            alert("Noto'g'ri parol! O'chirish bekor qilindi.");
            return;
          }
        }
      }

      // 3. Delete the tournament
      const { error: delErr } = await supabase.from('tournaments').delete().eq('id', id);
      if (delErr) throw delErr;

      if (activeTournamentId === id) onSelectTournament(null);
      load();
    } catch (err) { 
      alert("Xatolik: " + err.message); 
    }
  };

  const fillMock = (count) => {
    setTeamsText(Array.from({ length: count }, (_, i) => `Jamoa ${i + 1}`).join('\n'));
    if (!name) setName(`${count} talik Turnir`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Tab Selector */}
      <div className="admin-tabs" style={{ display: 'flex', gap: 8, background: 'rgba(30, 41, 59, 0.4)', padding: 4, borderRadius: 10, border: '1px solid var(--c-border)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`admin-tab-btn${activeTab === 'list' ? ' active' : ''}`}
          style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease', border: 'none' }}
        >
          🏆 Mavjud Turnirlar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`admin-tab-btn${activeTab === 'create' ? ' active' : ''}`}
          style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease', border: 'none' }}
        >
          ✨ Yangi hosil qilish
        </button>
      </div>

      {/* CREATE FORM TAB */}
      {activeTab === 'create' && (
        <div className="glass admin-card fade-in" style={{ padding: 20, borderRadius: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✨ Yangi turnir hosil qilish
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--c-muted)' }}>
              Jamoalar nomlarini qatorma-qator kiriting.
            </p>
          </div>

          {error && <div className="alert-error" style={{ marginTop: 12 }}>{error}</div>}
          {success && <div className="alert-success" style={{ marginTop: 12 }}>{success}</div>}

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Turnir Nomi
              </label>
              <input
                className="inp"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Masalan: Navro'z Kubogi 2026"
                disabled={loading}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Jamoalar (qatorma-qator)
                </label>
                <span style={{ fontSize: 10, fontWeight: 700, background: '#1e293b', border: '1px solid var(--c-border)', borderRadius: 6, padding: '2px 8px', color: 'var(--c-muted)' }}>
                  {teamCount} ta jamoa
                </span>
              </div>
              <textarea
                className="inp"
                rows={6}
                value={teamsText}
                onChange={e => setTeamsText(e.target.value)}
                placeholder={'Jamoa A\nJamoa B\nJamoa C'}
                disabled={loading}
                style={{ fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>



            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading
                ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                : <>▶ Setkani Generatsiya Qilish</>
              }
            </button>
          </form>
        </div>
      )}

      {/* TOURNAMENTS LIST TAB */}
      {activeTab === 'list' && (
        <div className="glass admin-card fade-in" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>🏆 Mavjud Turnirlar</h3>
            <button className="btn btn-ghost btn-sm" onClick={load}>Yangilash</button>
          </div>

          {tournaments.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: 32, border: '1px dashed var(--c-border)', borderRadius: 12, color: 'var(--c-muted)'
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ margin: 0, fontSize: 13 }}>Hech qanday turnir topilmadi.</p>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                onClick={() => setActiveTab('create')}
                style={{ marginTop: 12 }}
              >
                + Yangi hosil qilish
              </button>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tournaments.map(t => {
                const isActive = activeTournamentId === t.id;
                const statusClass = t.status === 'completed' ? 'status-complete' : t.status === 'active' ? 'status-active' : 'status-draft';
                const teamCountVal = tDetails[t.id] || 0;
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTournament(t.id)}
                    className={`tour-list-card${isActive ? ' active' : ''}`}
                  >
                    <div className="tour-list-icon" style={{
                      background: t.status === 'completed' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                      border: `1px solid ${t.status === 'completed' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    }}>
                      {t.status === 'completed' ? '🥇' : '⚽'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={e => handleRename(t.id, t.name, e)}
                          title="Nomini o'zgartirish"
                          style={{ padding: '2px 4px', fontSize: 10, minWidth: 'auto', minHeight: 'auto' }}
                        >✏️</button>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span style={{ color: 'var(--c-green)' }}>{teamCountVal} ta jamoa</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => handleCopyLink(t.id, e)}
                        title="Havolani nusxalash"
                        style={{ padding: '4px 8px', minWidth: '36px', minHeight: '36px' }}
                      >🔗</button>
                      <span className={`status-badge ${statusClass}`} style={{ fontSize: 9 }}>
                        {t.status === 'completed' ? 'Yakunlandi' : 'Faol'}
                      </span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={e => handleDelete(t.id, e)}
                        title="O'chirish"
                        style={{ padding: '4px 8px', minWidth: '36px', minHeight: '36px' }}
                      >🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
