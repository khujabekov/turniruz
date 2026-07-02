import React, { useState, useEffect } from 'react';

export default function MatchModal({ isOpen, onClose, match, team1, team2, onSave }) {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [winnerId, setWinnerId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (match) {
      setS1(match.score1 != null ? String(match.score1) : '');
      setS2(match.score2 != null ? String(match.score2) : '');
      setP1(match.penalty1 != null ? String(match.penalty1) : '');
      setP2(match.penalty2 != null ? String(match.penalty2) : '');
      setWinnerId(match.winner_id || '');
      setError('');
    }
  }, [match]);

  useEffect(() => {
    const n1 = parseInt(s1), n2 = parseInt(s2);
    if (isNaN(n1) || isNaN(n2)) { setWinnerId(''); return; }
    if (n1 > n2) { setWinnerId(match?.team1_id || ''); }
    else if (n2 > n1) { setWinnerId(match?.team2_id || ''); }
    else {
      const pp1 = parseInt(p1), pp2 = parseInt(p2);
      if (!isNaN(pp1) && !isNaN(pp2)) {
        if (pp1 > pp2) setWinnerId(match?.team1_id || '');
        else if (pp2 > pp1) setWinnerId(match?.team2_id || '');
        else setWinnerId('');
      } else { setWinnerId(''); }
    }
  }, [s1, s2, p1, p2, match]);

  if (!isOpen || !match) return null;

  const isDraw = s1 !== '' && s2 !== '' && parseInt(s1) === parseInt(s2);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (s1 === '' || s2 === '') { setError('Iltimos, har ikkala hisobni kiriting.'); return; }
    if (isDraw) {
      if (p1 === '' || p2 === '') { setError("Durang holatda penalti hisobini kiriting."); return; }
      if (parseInt(p1) === parseInt(p2)) { setError("Penaltida g'olib aniqlanishi kerak."); return; }
    }
    if (!winnerId) { setError("G'olib aniqlanmadi."); return; }
    onSave({
      matchId: match.id,
      score1: parseInt(s1), score2: parseInt(s2),
      penalty1: isDraw ? parseInt(p1) : null,
      penalty2: isDraw ? parseInt(p2) : null,
      winnerId, oldWinnerId: match.winner_id
    });
  };

  const handleReset = () => onSave({
    matchId: match.id, score1: null, score2: null,
    penalty1: null, penalty2: null, winnerId: null, oldWinnerId: match.winner_id
  });

  const winnerName = winnerId === team1?.id ? team1?.name : (winnerId === team2?.id ? team2?.name : null);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        {/* Header */}
        <div className="modal-header">
          <h3>O'yin Natijasini Kiritish</h3>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          {/* Team rows */}
          {[
            { team: team1, score: s1, setScore: setS1, teamId: match.team1_id },
            { team: team2, score: s2, setScore: setS2, teamId: match.team2_id }
          ].map(({ team, score, setScore, teamId }, idx) => {
            const isWinner = winnerId === teamId;
            return (
              <div key={idx} className="modal-team-row">
                <div className="modal-team-info">
                  <div className={`avatar${isWinner ? ' winner-av' : ''}`} style={{ width: 32, height: 32, fontSize: 10 }}>
                    {team ? team.name.substring(0, 2).toUpperCase() : '?'}
                  </div>
                  <span className={`modal-team-name${isWinner ? ' winner' : ''}`}>
                    {team ? team.name : 'Kutilmoqda'}
                  </span>
                </div>
                <input
                  type="number" min="0"
                  value={score}
                  onChange={e => setScore(e.target.value)}
                  disabled={!team1 || !team2}
                  placeholder="0"
                  className="inp score-input"
                />
              </div>
            );
          })}

          {/* Penalty section */}
          {isDraw && (
            <div className="penalty-section">
              <div className="penalty-title">
                Penaltilar Seriyasi
              </div>
              <div className="penalty-grid">
                {[{ team: team1, val: p1, set: setP1 }, { team: team2, val: p2, set: setP2 }].map(({ team, val, set }, i) => (
                  <div key={i}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--c-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {team?.name || `Jamoa ${i + 1}`}
                    </label>
                    <input type="number" min="0" value={val} onChange={e => set(e.target.value)} placeholder="0"
                      className="inp" style={{ textAlign: 'center', fontWeight: 800, minHeight: '44px' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Winner indicator */}
          {winnerName && (
            <div className="alert-success" style={{ textAlign: 'center', fontWeight: 700 }}>
              🏆 G'olib: {winnerName}
            </div>
          )}

          {/* Action buttons */}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={handleReset}
              disabled={match.score1 == null && match.score2 == null}
            >Reset</button>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor</button>
            <button type="submit" className="btn btn-primary" disabled={!team1 || !team2}>Saqlash</button>
          </div>
        </form>
      </div>
    </div>
  );
}
