import React, { useState, useEffect } from 'react';

export default function MatchModal({ isOpen, onClose, match, team1, team2, onSave }) {
  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [winnerId, setWinnerId] = useState('');
  const [error, setError] = useState('');

  // Initialize values when match changes
  useEffect(() => {
    if (match) {
      setS1(match.score1 != null ? match.score1 : 0);
      setS2(match.score2 != null ? match.score2 : 0);
      setP1(match.penalty1 != null ? match.penalty1 : 0);
      setP2(match.penalty2 != null ? match.penalty2 : 0);
      setWinnerId(match.winner_id || '');
      setError('');
    }
  }, [match]);

  // Determine winner dynamically on state changes
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

  // Helper to update score and instantly save to database (Live status)
  const triggerAutoSave = (newS1, newS2, newP1, newP2) => {
    let currentWinner = '';
    const draw = newS1 === newS2;
    if (!draw) {
      currentWinner = newS1 > newS2 ? (match.team1_id || '') : (match.team2_id || '');
    } else {
      if (newP1 > newP2) currentWinner = match.team1_id || '';
      else if (newP2 > newP1) currentWinner = match.team2_id || '';
    }

    onSave({
      matchId: match.id,
      score1: newS1,
      score2: newS2,
      penalty1: draw ? newP1 : null,
      penalty2: draw ? newP2 : null,
      winnerId: currentWinner || null,
      oldWinnerId: match.winner_id,
      isCompleted: false // Keep in Live mode while editing
    });
  };

  // Adjust score 1
  const changeScore1 = (val) => {
    const nextVal = Math.max(0, s1 + val);
    setS1(nextVal);
    triggerAutoSave(nextVal, s2, p1, p2);
  };

  // Adjust score 2
  const changeScore2 = (val) => {
    const nextVal = Math.max(0, s2 + val);
    setS2(nextVal);
    triggerAutoSave(s1, nextVal, p1, p2);
  };

  // Adjust penalty 1
  const changePenalty1 = (val) => {
    const nextVal = Math.max(0, p1 + val);
    setP1(nextVal);
    triggerAutoSave(s1, s2, nextVal, p2);
  };

  // Adjust penalty 2
  const changePenalty2 = (val) => {
    const nextVal = Math.max(0, p2 + val);
    setP2(nextVal);
    triggerAutoSave(s1, s2, p1, nextVal);
  };

  // Finish match officially (mark as completed and advance winner)
  const handleFinishMatch = () => {
    if (isDraw && p1 === p2) {
      setError("Durang holatda penaltilar seriyasi orqali g'olib aniqlanishi shart.");
      return;
    }
    if (!winnerId) {
      setError("G'olib aniqlanmadi. O'yinni yakunlab bo'lmaydi.");
      return;
    }

    onSave({
      matchId: match.id,
      score1: s1,
      score2: s2,
      penalty1: isDraw ? p1 : null,
      penalty2: isDraw ? p2 : null,
      winnerId,
      oldWinnerId: match.winner_id,
      isCompleted: true // officially finish the match
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
      isCompleted: false
    });
  };

  const winnerName = winnerId === team1?.id ? team1?.name : (winnerId === team2?.id ? team2?.name : null);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        {/* Header */}
        <div className="modal-header">
          <h3>O'yin Natijasini Boshqarish</h3>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}
          
          {match.is_completed ? (
            <div className="alert-success" style={{ fontSize: 12, padding: '8px 12px', textAlign: 'center', marginBottom: 12 }}>
              ✓ O'yin yakunlangan (Natija muzlatilgan)
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--c-muted)', textAlign: 'center', marginBottom: 12, background: 'rgba(59, 130, 246, 0.1)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              ⚡ Har bir o'zgarish avtomatik saqlanib, realtime uzatiladi.
            </div>
          )}

          {/* Team Rows with Counter Controls */}
          {[
            { team: team1, score: s1, changeScore: changeScore1, teamId: match.team1_id },
            { team: team2, score: s2, changeScore: changeScore2, teamId: match.team2_id }
          ].map(({ team, score, changeScore, teamId }, idx) => {
            const isWinner = winnerId === teamId;
            const hasTeams = team1 && team2;
            return (
              <div key={idx} className="modal-team-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <div className="modal-team-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`avatar${isWinner ? ' winner-av' : ''}`} style={{ width: 32, height: 32, fontSize: 10 }}>
                    {team ? team.name.substring(0, 2).toUpperCase() : '?'}
                  </div>
                  <span className={`modal-team-name${isWinner ? ' winner' : ''}`} style={{ fontWeight: 700, fontSize: 14 }}>
                    {team ? team.name : 'Kutilmoqda'}
                  </span>
                </div>

                {/* Score Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    type="button" 
                    className="counter-btn" 
                    onClick={() => changeScore(-1)}
                    disabled={!hasTeams || match.is_completed || score <= 0}
                  >
                    －
                  </button>
                  <span className="score-counter-val">{score}</span>
                  <button 
                    type="button" 
                    className="counter-btn" 
                    onClick={() => changeScore(1)}
                    disabled={!hasTeams || match.is_completed}
                  >
                    ＋
                  </button>
                </div>
              </div>
            );
          })}

          {/* Penalty section (only if scores are equal and teams exist) */}
          {isDraw && team1 && team2 && (
            <div className="penalty-section" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--c-border)' }}>
              <div className="penalty-title" style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' }}>
                Penaltilar Seriyasi
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16 }}>
                {[
                  { team: team1, val: p1, change: changePenalty1 },
                  { team: team2, val: p2, change: changePenalty2 }
                ].map(({ team, val, change }, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11, color: 'var(--c-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {team.name}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button 
                        type="button" 
                        className="counter-btn counter-btn-sm" 
                        onClick={() => change(-1)}
                        disabled={match.is_completed || val <= 0}
                      >
                        －
                      </button>
                      <span className="penalty-counter-val">{val}</span>
                      <button 
                        type="button" 
                        className="counter-btn counter-btn-sm" 
                        onClick={() => change(1)}
                        disabled={match.is_completed}
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Winner indicator */}
          {winnerName && (
            <div className="alert-success" style={{ textAlign: 'center', fontWeight: 800, marginTop: 16, fontSize: 13 }}>
              🏆 Yetakchi/G'olib: {winnerName}
            </div>
          )}

          {/* Action buttons */}
          <div className="modal-actions" style={{ gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={handleReset}
              disabled={match.score1 == null && match.score2 == null && !match.is_completed}
            >Tozalash</button>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {match.is_completed ? 'Yopish' : 'Bekor qilish'}
            </button>
            
            {!match.is_completed && (
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={!team1 || !team2} 
                onClick={handleFinishMatch}
              >
                🏁 O'yinni Yakunlash
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
