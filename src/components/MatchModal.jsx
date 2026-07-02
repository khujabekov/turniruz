import React, { useState, useEffect } from 'react';

export default function MatchModal({ isOpen, onClose, match, team1, team2, onSave }) {
  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [winnerId, setWinnerId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (match) {
      setS1(match.score1 != null ? match.score1 : 0);
      setS2(match.score2 != null ? match.score2 : 0);
      setP1(match.penalty1 != null ? match.penalty1 : 0);
      setP2(match.penalty2 != null ? match.penalty2 : 0);
      setWinnerId(match.winner_id || '');
      setError('');
    }
  }, [match?.id]);

  // Determine winner dynamically on score or penalty changes
  useEffect(() => {
    const isDraw = s1 === s2;
    if (!isDraw) {
      if (s1 > s2) setWinnerId(match?.team1_id || '');
      else setWinnerId(match?.team2_id || '');
    } else {
      if (p1 > p2) setWinnerId(match?.team1_id || '');
      else if (p2 > p1) setWinnerId(match?.team2_id || '');
      else setWinnerId('');
    }
  }, [s1, s2, p1, p2, match]);

  if (!isOpen || !match) return null;

  const isDraw = s1 === s2;
  const isCompleted = match.is_completed;

  const handleSaveClick = (finalize = false) => {
    if (isDraw && p1 === p2 && finalize) {
      setError("Penaltilar g'olibi aniqlanishi kerak.");
      return;
    }

    let currentWinner = '';
    if (!isDraw) {
      currentWinner = s1 > s2 ? (match.team1_id || '') : (match.team2_id || '');
    } else {
      if (p1 > p2) currentWinner = match.team1_id || '';
      else if (p2 > p1) currentWinner = match.team2_id || '';
    }

    if (finalize && !currentWinner) {
      setError("G'olib aniqlanmadi.");
      return;
    }

    setError('');
    onSave({
      matchId: match.id,
      score1: s1,
      score2: s2,
      penalty1: isDraw ? p1 : null,
      penalty2: isDraw ? p2 : null,
      winnerId: currentWinner || null,
      oldWinnerId: match.winner_id,
      isCompleted: finalize,
      matchStatus: finalize ? 'completed' : 'live'
    });
  };

  const handleReset = () => {
    onSave({
      matchId: match.id,
      score1: null,
      score2: null,
      penalty1: null,
      penalty2: null,
      winnerId: null,
      oldWinnerId: match.winner_id,
      isCompleted: false,
      matchStatus: 'waiting'
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 360, padding: 20 }}>
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid var(--c-border)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>O'yin Natijasi</h3>
          <button onClick={onClose} className="modal-close-btn" style={{ border: 'none', background: 'none', fontSize: 18, color: 'var(--c-muted)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && <div className="alert-error" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>{error}</div>}

          {/* Team Rows */}
          {[
            { team: team1, score: s1, setScore: setS1, teamId: match.team1_id },
            { team: team2, score: s2, setScore: setS2, teamId: match.team2_id }
          ].map(({ team, score, setScore, teamId }, idx) => {
            const isWinner = winnerId === teamId;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`avatar${isWinner && isCompleted ? ' winner-av' : ''}`} style={{ width: 32, height: 32, fontSize: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-border)', fontWeight: 700 }}>
                    {team ? team.name.substring(0, 2).toUpperCase() : '?'}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: isWinner && isCompleted ? 'var(--c-green)' : '#fff' }}>
                    {team ? team.name : 'Kutilmoqda'}
                  </span>
                </div>

                {/* Score controls */}
                {!isCompleted && team1 && team2 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button 
                      type="button" 
                      className="counter-btn" 
                      onClick={() => setScore(Math.max(0, score - 1))}
                      disabled={score <= 0}
                      style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--c-border)', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                    >－</button>
                    <span style={{ fontSize: 16, fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{score}</span>
                    <button 
                      type="button" 
                      className="counter-btn" 
                      onClick={() => setScore(score + 1)}
                      style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--c-border)', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                    >＋</button>
                  </div>
                )}
                {isCompleted && (
                  <span style={{ fontSize: 18, fontWeight: 800, marginRight: 10 }}>{score}</span>
                )}
              </div>
            );
          })}

          {/* Penalties Section (Only if score is a draw) */}
          {isDraw && team1 && team2 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--c-border)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, textAlign: 'center' }}>
                🎯 Penaltilar Seriyasi
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16 }}>
                {[
                  { team: team1, val: p1, setVal: setP1 },
                  { team: team2, val: p2, setVal: setP2 }
                ].map(({ team, val, setVal }, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 10, color: 'var(--c-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {team.name}
                    </label>
                    {!isCompleted ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button 
                          type="button" 
                          className="counter-btn" 
                          onClick={() => setVal(Math.max(0, val - 1))}
                          disabled={val <= 0}
                          style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--c-border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 10 }}
                        >－</button>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>{val}</span>
                        <button 
                          type="button" 
                          className="counter-btn" 
                          onClick={() => setVal(val + 1)}
                          style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--c-border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 10 }}
                        >＋</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 800 }}>({val})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 24 }}>
            {!isCompleted ? (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset} style={{ fontSize: 12 }}>
                  Tozalash
                </button>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary" onClick={() => handleSaveClick(false)} style={{ fontSize: 12, padding: '8px 12px' }}>
                  💾 Saqlash
                </button>
                <button type="button" className="btn btn-primary" onClick={() => handleSaveClick(true)} style={{ fontSize: 12, padding: '8px 12px' }}>
                  🏁 Yakunlash
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleReset} style={{ fontSize: 12 }}>
                  Qayta ochish (Reset)
                </button>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 12 }}>
                  Yopish
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

