import React, { useState, useEffect } from 'react';

export default function MatchModal({ isOpen, onClose, match, team1, team2, onSave }) {
  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [winnerId, setWinnerId] = useState('');
  const [status, setStatus] = useState('waiting');
  const [error, setError] = useState('');

  useEffect(() => {
    if (match) {
      setS1(match.score1 != null ? match.score1 : 0);
      setS2(match.score2 != null ? match.score2 : 0);
      setP1(match.penalty1 != null ? match.penalty1 : 0);
      setP2(match.penalty2 != null ? match.penalty2 : 0);
      setWinnerId(match.winner_id || '');
      setStatus(match.match_status || 'waiting');
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

  // Save changes locally and send to database
  const handleSaveClick = (isFinal = false) => {
    if (isDraw && status === 'penalties' && p1 === p2) {
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

    if (isFinal && !currentWinner) {
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
      isCompleted: isFinal,
      matchStatus: isFinal ? 'completed' : status
    });
  };

  // Up/Down adjusters (Local Only, No Auto-Save)
  const changeScore1 = (val) => {
    const nextVal = Math.max(0, s1 + val);
    setS1(nextVal);
    if (status === 'waiting') {
      setStatus('live');
    }
  };

  const changeScore2 = (val) => {
    const nextVal = Math.max(0, s2 + val);
    setS2(nextVal);
    if (status === 'waiting') {
      setStatus('live');
    }
  };

  const changePenalty1 = (val) => {
    const nextVal = Math.max(0, p1 + val);
    setP1(nextVal);
  };

  const changePenalty2 = (val) => {
    const nextVal = Math.max(0, p2 + val);
    setP2(nextVal);
  };

  // Phase transition actions (Local Only)
  const handleFinishNormalTime = () => {
    if (isDraw) {
      setStatus('penalties');
    } else {
      setStatus('normal_ended');
    }
  };

  const handleFinishPenalties = () => {
    if (p1 === p2) {
      setError("Penaltilar seriyasida durang bo'lishi mumkin emas. G'olib aniqlanishi shart.");
      return;
    }
    setError('');
    setStatus('normal_ended');
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

  const winnerName = winnerId === team1?.id ? team1?.name : (winnerId === team2?.id ? team2?.name : null);

  // Status stage titles
  const getStageHeader = () => {
    if (status === 'completed') return '🏆 O\'yin Yakunlandi';
    if (status === 'penalties') return '🎯 Penaltilar Seriyasi';
    if (status === 'normal_ended') return '⏱ Asosiy Vaqt Tugadi';
    if (status === 'live') return '⚽ Asosiy Vaqt Ketmoqda';
    return '⏳ Boshlanmagan';
  };

  // Show penalties section if explicitly in penalties phase or if penalty values exist
  const showPenalties = status === 'penalties' || (match.penalty1 != null || match.penalty2 != null);

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

          {/* Current Status Header Banner */}
          <div style={{
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            padding: '8px 16px',
            borderRadius: 8,
            marginBottom: 16,
            background: status === 'completed' ? 'rgba(16, 185, 129, 0.15)' :
                        status === 'penalties' ? 'rgba(245, 158, 11, 0.15)' :
                        status === 'normal_ended' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            border: `1px solid ${
              status === 'completed' ? 'var(--c-green)' :
              status === 'penalties' ? 'var(--c-gold)' :
              status === 'normal_ended' ? 'var(--c-muted)' : 'var(--c-blue)'
            }`,
            color: status === 'completed' ? 'var(--c-green)' :
                   status === 'penalties' ? 'var(--c-gold)' : '#fff'
          }}>
            {getStageHeader()}
          </div>

          {/* Team Rows */}
          {[
            { team: team1, score: s1, changeScore: changeScore1, teamId: match.team1_id },
            { team: team2, score: s2, changeScore: changeScore2, teamId: match.team2_id }
          ].map(({ team, score, changeScore, teamId }, idx) => {
            const isWinner = winnerId === teamId;
            const hasTeams = team1 && team2;
            const scoreDisabled = !hasTeams || status === 'completed' || status === 'normal_ended' || status === 'penalties';
            return (
              <div key={idx} className="modal-team-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <div className="modal-team-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`avatar${isWinner && status === 'completed' ? ' winner-av' : ''}`} style={{ width: 32, height: 32, fontSize: 10 }}>
                    {team ? team.name.substring(0, 2).toUpperCase() : '?'}
                  </div>
                  <span className={`modal-team-name${isWinner && status === 'completed' ? ' winner' : ''}`} style={{ fontWeight: 700, fontSize: 14 }}>
                    {team ? team.name : 'Kutilmoqda'}
                  </span>
                </div>

                {/* Score controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    type="button" 
                    className="counter-btn" 
                    onClick={() => changeScore(-1)}
                    disabled={scoreDisabled || score <= 0}
                  >－</button>
                  <span className="score-counter-val">{score}</span>
                  <button 
                    type="button" 
                    className="counter-btn" 
                    onClick={() => changeScore(1)}
                    disabled={scoreDisabled}
                  >＋</button>
                </div>
              </div>
            );
          })}

          {/* Penalties Section */}
          {showPenalties && team1 && team2 && (
            <div className="penalty-section" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--c-border)' }}>
              <div className="penalty-title" style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' }}>
                🎯 Penaltilar Seriyasi
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16 }}>
                {[
                  { team: team1, val: p1, change: changePenalty1 },
                  { team: team2, val: p2, change: changePenalty2 }
                ].map(({ team, val, change }, i) => {
                  const penaltyDisabled = status === 'completed' || status === 'normal_ended';
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: 11, color: 'var(--c-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {team.name}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button 
                          type="button" 
                          className="counter-btn counter-btn-sm" 
                          onClick={() => change(-1)}
                          disabled={penaltyDisabled || val <= 0}
                        >－</button>
                        <span className="penalty-counter-val">{val}</span>
                        <button 
                          type="button" 
                          className="counter-btn counter-btn-sm" 
                          onClick={() => change(1)}
                          disabled={penaltyDisabled}
                        >＋</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Winner banner */}
          {winnerName && status === 'completed' && (
            <div className="alert-success" style={{ textAlign: 'center', fontWeight: 800, marginTop: 16, fontSize: 13 }}>
              🏆 G'olib: {winnerName}
            </div>
          )}

          {/* Action buttons */}
          <div className="modal-actions" style={{ gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={handleReset}
              disabled={match.score1 == null && match.score2 == null && status === 'waiting'}
            >Tozalash</button>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {status === 'completed' ? 'Yopish' : 'Bekor qilish'}
            </button>

            {/* Manual Save button */}
            {status !== 'completed' && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => handleSaveClick(false)}
                style={{ fontWeight: 800 }}
              >
                💾 Saqlash
              </button>
            )}

            {/* Stage button transitions */}
            {status === 'live' && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleFinishNormalTime}
              >
                ⏱ Asosiy Vaqtni Tugatish
              </button>
            )}

            {status === 'penalties' && (
              <button 
                type="button" 
                className="btn btn-gold" 
                onClick={handleFinishPenalties}
                style={{ background: 'var(--c-gold)', color: '#000', fontWeight: 800 }}
              >
                🎯 Penaltilarni Tugatish
              </button>
            )}

            {status === 'normal_ended' && (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => handleSaveClick(true)}
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

