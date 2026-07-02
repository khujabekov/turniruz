import React, { useState, useEffect } from 'react';
import { fetchGlobalTeamRankings } from '../utils/supabaseService';

export default function TeamRankings() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGlobalTeamRankings()
      .then(data => {
        setRankings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className="glass fade-in" style={{ padding: 40, borderRadius: 16, textAlign: 'center', color: 'var(--c-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <h4 style={{ margin: 0, color: '#fff', fontSize: 16 }}>Reyting Mavjud Emas</h4>
        <p style={{ margin: '8px 0 0', fontSize: 12 }}>Tugallangan o'yinlar bo'yicha jamoalar reytingi hisoblanadi.</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>📊 Jamoalar Reytingi</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--c-muted)' }}>Barcha turnirlardagi ishtirok, g'alabalar va ochkolar bo'yicha umumiy jadval</p>
      </div>

      <div className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.6)', borderBottom: '1px solid var(--c-border)' }}>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', textTransform: 'uppercase', width: 60 }}>O'rin</th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', textTransform: 'uppercase' }}>Jamoa nomi</th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Turnirlar</th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', textTransform: 'uppercase', textAlign: 'center' }}>O'yinlar</th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', textTransform: 'uppercase', textAlign: 'center', color: 'var(--c-green)' }}>G'alaba</th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', textTransform: 'uppercase', textAlign: 'center', color: 'var(--c-rose)' }}>Mag'lubiyat</th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Gollar</th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)' }}>Ochko</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((team, idx) => (
                <tr key={team.name} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)', transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: idx === 0 ? 'var(--c-gold)' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--c-muted)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#fff' }}>
                    {team.name}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--c-muted)' }}>{team.tournamentsCount}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--c-muted)' }}>{team.matchesPlayed}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--c-green)' }}>{team.wins}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--c-rose)' }}>{team.losses}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--c-muted)' }}>{team.goalsScored}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800, color: 'var(--c-green)', background: 'rgba(16, 185, 129, 0.05)' }}>{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
