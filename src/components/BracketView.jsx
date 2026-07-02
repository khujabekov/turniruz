import React, { useState, useEffect, useRef } from 'react';

export default function BracketView({ matches, teams, isAdmin, onMatchClick }) {
  const containerRef = useRef(null);
  const [lines, setLines] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const [hoveredTeamId, setHoveredTeamId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeRoundIndex, setActiveRoundIndex] = useState(0);

  const teamsMap = React.useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  const rounds = React.useMemo(() => {
    if (!matches || matches.length === 0) return [];
    const map = {};
    matches.forEach(m => {
      if (!map[m.round_number]) map[m.round_number] = [];
      map[m.round_number].push(m);
    });
    Object.keys(map).forEach(r => map[r].sort((a, b) => a.match_order - b.match_order));
    return Object.keys(map).sort((a, b) => +a - +b).map(r => ({
      roundNumber: +r,
      matches: map[r]
    }));
  }, [matches]);

  const totalRounds = rounds.length;

  const getRoundName = (rn) => {
    const diff = totalRounds - rn;
    if (diff === 0) return 'Final';
    if (diff === 1) return 'Yarim Final';
    if (diff === 2) return 'Chorak Final';
    if (diff === 3) return '1/8 Final';
    return `1/${Math.pow(2, diff)} Final`;
  };

  const recalcLines = React.useCallback(() => {
    if (!containerRef.current || rounds.length < 2) return;
    const cont = containerRef.current;
    const cr = cont.getBoundingClientRect();
    const newLines = [];
    matches.forEach(m => {
      if (!m.next_match_id) return;
      const a = cont.querySelector(`[data-mid="${m.id}"]`);
      const b = cont.querySelector(`[data-mid="${m.next_match_id}"]`);
      if (!a || !b) return;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - cr.left + cont.scrollLeft;
      const y1 = ra.top + ra.height / 2 - cr.top + cont.scrollTop;
      const x2 = rb.left - cr.left + cont.scrollLeft;
      const y2 = rb.top + rb.height / 2 - cr.top + cont.scrollTop;
      const xm = (x1 + x2) / 2;
      newLines.push({
        d: `M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`,
        active: hoveredTeamId && m.winner_id === hoveredTeamId
      });
    });
    setLines(newLines);
    setSvgSize({ w: cont.scrollWidth, h: cont.scrollHeight });
  }, [rounds.length, matches, hoveredTeamId]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', recalcLines);
    let obs;
    if (containerRef.current) {
      obs = new ResizeObserver(recalcLines);
      obs.observe(containerRef.current);
    }
    const t = setTimeout(recalcLines, 200);
    return () => { window.removeEventListener('resize', recalcLines); if (obs) obs.disconnect(); clearTimeout(t); };
  }, [recalcLines]);

  if (rounds.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--c-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Turnir setkasi hali generatsiya qilinmagan.</p>
        {isAdmin && <p style={{ fontSize: 13, marginTop: 8, color: 'var(--c-muted)' }}>Admin panelidan jamoalarni kiritib, setkani hosil qiling.</p>}
      </div>
    );
  }

  const finalMatch = rounds[rounds.length - 1]?.matches[0];
  const champion = finalMatch?.is_completed && finalMatch?.winner_id ? teamsMap.get(finalMatch.winner_id) : null;

  // Mobile scroll helpers
  const scrollToRound = (index) => {
    if (!containerRef.current) return;
    const columns = containerRef.current.querySelectorAll('.bracket-round-col');
    const targetColumn = columns[index];
    if (targetColumn) {
      containerRef.current.scrollTo({ left: targetColumn.offsetLeft - 12, behavior: 'smooth' });
      setActiveRoundIndex(index);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const columns = containerRef.current.querySelectorAll('.bracket-round-col');
    let closestIndex = activeRoundIndex;
    let minDistance = Infinity;
    columns.forEach((col, idx) => {
      const distance = Math.abs(col.offsetLeft - 12 - scrollLeft);
      if (distance < minDistance) { minDistance = distance; closestIndex = idx; }
    });
    if (closestIndex !== activeRoundIndex) setActiveRoundIndex(closestIndex);
  };

  // Match status mapping
  const getMatchStatus = (match) => {
    const t1 = match.team1_id;
    const t2 = match.team2_id;
    const isBye = (t1 && !t2 && match.winner_id === t1) || (!t1 && t2 && match.winner_id === t2);
    if (isBye) return 'bye';
    return match.match_status || 'waiting';
  };

  const statusLabels = {
    bye: { text: 'Avtomatik O\'tish', color: 'var(--c-muted)', icon: '↪' },
    completed: { text: 'Yakunlandi', color: 'var(--c-green)', icon: '✓' },
    penalties: { text: 'Penaltilar Seriyasi', color: 'var(--c-gold)', icon: '🎯' },
    normal_ended: { text: 'Asosiy Vaqt Tugadi', color: 'var(--c-muted)', icon: '⏱' },
    live: { text: 'Asosiy Vaqt', color: '#3b82f6', icon: '⚽' },
    ready: { text: 'Kutilmoqda (Tayyor)', color: '#f59e0b', icon: '⚡' },
    waiting: { text: 'Kutilmoqda', color: 'var(--c-muted)', icon: '⏳' }
  };

  const renderMatchCard = (match) => {
    const t1 = match.team1_id ? teamsMap.get(match.team1_id) : null;
    const t2 = match.team2_id ? teamsMap.get(match.team2_id) : null;
    const status = getMatchStatus(match);
    const statusInfo = statusLabels[status] || statusLabels.waiting;
    
    // Winner check only if match is completed
    const isCompleted = match.match_status === 'completed';
    const t1Wins = isCompleted && match.winner_id && match.winner_id === match.team1_id;
    const t2Wins = isCompleted && match.winner_id && match.winner_id === match.team2_id;
    
    const h1 = hoveredTeamId && match.team1_id === hoveredTeamId;
    const h2 = hoveredTeamId && match.team2_id === hoveredTeamId;
    const clickable = isAdmin && t1 && t2 && status !== 'bye';

    // Show penalties only in penalties stage or if they are not null
    const showPenalties = match.match_status === 'penalties' || (match.penalty1 != null || match.penalty2 != null);
    const p1Val = match.penalty1 != null ? match.penalty1 : (match.match_status === 'penalties' ? 0 : null);
    const p2Val = match.penalty2 != null ? match.penalty2 : (match.match_status === 'penalties' ? 0 : null);

    return (
      <div
        key={match.id}
        data-mid={match.id}
        className={`match-card${clickable ? ' clickable' : ''} status-${status}`}
        onClick={() => clickable && onMatchClick(match)}
        style={{ margin: '12px 0' }}
      >
        {/* Status header */}
        <div className="match-card-header">
          <span>{statusInfo.icon} O'yin #{match.match_order}</span>
          <span className="match-status-badge" style={{ color: statusInfo.color }}>
            {statusInfo.text}
          </span>
        </div>

        {clickable && <div className="edit-badge">✎ KIRITISH</div>}

        {/* Team 1 */}
        <div
          className={`team-row${t1Wins ? ' winner' : ''}${h1 ? ' hovered' : ''}`}
          onMouseEnter={() => match.team1_id && setHoveredTeamId(match.team1_id)}
          onMouseLeave={() => setHoveredTeamId(null)}
        >
          <div className={`avatar${t1Wins ? ' winner-av' : ''}`}>
            {t1 ? t1.name.substring(0, 2).toUpperCase() : '?'}
          </div>
          <span className={`team-name${t1Wins ? ' winner-text' : ''}${!t1 ? ' placeholder' : ''}`}>
            {t1 ? t1.name : "G'olib kutilmoqda"}
            {t1Wins && ' 🏆'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {p1Val != null && showPenalties && <span className="pen-badge">({p1Val})</span>}
            <span className={`score${t1Wins ? ' winner-score' : ''}`}>
              {match.score1 != null ? match.score1 : '–'}
            </span>
          </div>
        </div>

        <div className="match-divider" />

        {/* Team 2 */}
        <div
          className={`team-row${t2Wins ? ' winner' : ''}${h2 ? ' hovered' : ''}`}
          onMouseEnter={() => match.team2_id && setHoveredTeamId(match.team2_id)}
          onMouseLeave={() => setHoveredTeamId(null)}
        >
          <div className={`avatar${t2Wins ? ' winner-av' : ''}`}>
            {status === 'bye' ? '–' : (t2 ? t2.name.substring(0, 2).toUpperCase() : '?')}
          </div>
          <span className={`team-name${t2Wins ? ' winner-text' : ''}${(!t2 || status === 'bye') ? ' placeholder' : ''}`}>
            {status === 'bye' ? "BO'SH (Bye)" : (t2 ? t2.name : "G'olib kutilmoqda")}
            {t2Wins && ' 🏆'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {p2Val != null && showPenalties && <span className="pen-badge">({p2Val})</span>}
            <span className={`score${t2Wins ? ' winner-score' : ''}`}>
              {status === 'bye' ? '' : (match.score2 != null ? match.score2 : '–')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Bracket view (shared for desktop and mobile)
  const renderBracketContent = () => (
    <>
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
        width={svgSize.w}
        height={svgSize.h}
      >
        {lines.map((ln, i) => (
          <path key={i} d={ln.d} className={`bracket-connector${ln.active ? ' active' : ''}`} />
        ))}
      </svg>

      {rounds.map(round => (
        <div key={round.roundNumber} className="bracket-round-col">
          <div className="round-title">{getRoundName(round.roundNumber)}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 24, width: '100%', paddingTop: 8 }}>
            {round.matches.map(match => renderMatchCard(match))}
          </div>
        </div>
      ))}
    </>
  );

  // Stats for spectator view
  const totalMatches = matches.filter(m => getMatchStatus(m) !== 'bye').length;
  const completedMatches = matches.filter(m => getMatchStatus(m) === 'completed').length;
  const progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

      {/* Turnir statistikasi */}
      <div className="bracket-stats-bar fade-in">
        <div className="bracket-stat">
          <span className="bracket-stat-value">{teams.length}</span>
          <span className="bracket-stat-label">Jamoalar</span>
        </div>
        <div className="bracket-stat">
          <span className="bracket-stat-value">{totalRounds}</span>
          <span className="bracket-stat-label">Bosqichlar</span>
        </div>
        <div className="bracket-stat">
          <span className="bracket-stat-value">{completedMatches}/{totalMatches}</span>
          <span className="bracket-stat-label">O'yinlar</span>
        </div>
        <div className="bracket-stat">
          <div className="bracket-progress-bar">
            <div className="bracket-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="bracket-stat-label">{progressPercent}% tugallandi</span>
        </div>
      </div>

      {champion && (
        <div className="champion-banner fade-in" style={{ maxWidth: 500, margin: '0 auto', width: '100%' }}>
          <span className="champion-emoji">🏆</span>
          <div>
            <div className="champion-label">Turnir G'olibi!</div>
            <div className="champion-name">{champion.name}</div>
          </div>
          <span className="champion-emoji">🏆</span>
        </div>
      )}

      {isMobile ? (
        <div className="bracket-mobile-wrapper slide-in-r">
          <div className="bracket-mobile-header">
            <div className="bracket-mobile-title">Turnir Setkasi</div>
            <div className="bracket-mobile-nav">
              <button
                className="bracket-nav-btn"
                disabled={activeRoundIndex === 0}
                onClick={() => scrollToRound(activeRoundIndex - 1)}
              >&lt;</button>
              <div className="bracket-nav-rounds">
                {rounds.map((round, idx) => {
                  const isActive = idx === activeRoundIndex;
                  const isAdjacent = Math.abs(idx - activeRoundIndex) === 1;
                  if (!isActive && !isAdjacent) return null;
                  return (
                    <span
                      key={round.roundNumber}
                      onClick={() => scrollToRound(idx)}
                      className={`bracket-nav-round-item${isActive ? ' active' : ''}${isAdjacent ? ' adjacent' : ''}`}
                    >
                      {getRoundName(round.roundNumber)}
                    </span>
                  );
                })}
              </div>
              <button
                className="bracket-nav-btn"
                disabled={activeRoundIndex === rounds.length - 1}
                onClick={() => scrollToRound(activeRoundIndex + 1)}
              >&gt;</button>
            </div>
          </div>

          <div ref={containerRef} onScroll={handleScroll} className="bracket-scroll-container">
            {renderBracketContent()}
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="bracket-desktop">
          {renderBracketContent()}
        </div>
      )}

      {/* Legend */}
      <div className="legend-bar">
        <span>🟢 G'olib jamoa</span>
        <span style={{ color: 'var(--c-gold)' }}>🟡 (N) = Penaltilar</span>
        <span style={{ color: '#f59e0b' }}>⚡ O'ynash tayyor</span>
        {isAdmin && <span style={{ color: 'var(--c-green)' }}>✎ Ustiga bosing</span>}
      </div>
    </div>
  );
}
