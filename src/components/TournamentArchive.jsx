import React, { useState, useEffect } from 'react';
import { fetchArchiveStats } from '../utils/supabaseService';

export default function TournamentArchive() {
  const [archive, setArchive] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchiveStats()
      .then(data => {
        setArchive(data);
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

  if (archive.length === 0) {
    return (
      <div className="glass fade-in" style={{ padding: 40, borderRadius: 16, textAlign: 'center', color: 'var(--c-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
        <h4 style={{ margin: 0, color: '#fff', fontSize: 16 }}>Arxiv Hali Bo'sh</h4>
        <p style={{ margin: '8px 0 0', fontSize: 12 }}>Yakunlangan turnirlar hozircha mavjud emas.</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>📁 Turnirlar Arxivi</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--c-muted)' }}>Eski yakunlangan turnirlar natijalari va statistikasi</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {archive.map(item => (
          <div key={item.id} className="glass" style={{ padding: 20, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' }}>{item.name}</h3>
                <span style={{ fontSize: 10, color: 'var(--c-muted)' }}>
                  {new Date(item.createdAt).toLocaleDateString('uz-UZ')}
                </span>
              </div>
              <span className="status-badge status-complete" style={{ fontSize: 9 }}>
                Yakunlangan
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderTop: '1px solid rgba(51, 65, 85, 0.4)', borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--c-muted)' }}>🏆 G'olib jamoa:</span>
                <span style={{ fontWeight: 700, color: 'var(--c-green)' }}>{item.winner}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--c-muted)' }}>⚽ To'purar jamoa:</span>
                <span style={{ fontWeight: 700, color: 'var(--c-gold)' }}>
                  {item.topScorer} {item.topScorerGoals > 0 ? `(${item.topScorerGoals} gol)` : ''}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-muted)' }}>
              <span>👥 {item.teamsCount} jamoa</span>
              <span>🎮 {item.totalMatches} o'yin</span>
              <span>🥅 {item.totalGoals} gol</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
