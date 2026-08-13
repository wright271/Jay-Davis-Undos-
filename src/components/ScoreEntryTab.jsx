import React, { useMemo, useState } from 'react';
import { flightLabel } from '../lib/constants.js';
import { playerRound, playerName, formatToPar } from '../lib/scoring.js';
import { Card, Empty, Segmented } from './ui.jsx';

/**
 * Score entry, built for a phone in one hand on the tee box.
 *
 * Players enter their score hole by hole; every leaderboard — individual,
 * better ball and skins — is derived from these cards, so a score is only ever
 * typed once.
 */
export default function ScoreEntryTab({ players, cards, holes, store, canEdit }) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [mode, setMode] = useState('hole');
  const [holeIndex, setHoleIndex] = useState(0);

  const player = players.find((p) => p.id === playerId) || players[0];

  const round = useMemo(
    () => (player ? playerRound(player, cards[player.id], holes) : null),
    [player, cards, holes],
  );

  if (players.length === 0) {
    return <Empty icon="✏️" title="No players yet">Add the field from the Admin screen first.</Empty>;
  }

  const hole = holes[holeIndex];
  const current = round?.byNumber[hole.number];
  const setScore = (h, value) => store.setHoleScore(player.id, h, value);

  return (
    <div className="stack">
      <Card>
        <div className="entry-picker">
          <select
            className="input select-lg"
            value={player.id}
            onChange={(e) => setPlayerId(e.target.value)}
            aria-label="Player"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {playerName(p)} — {flightLabel(p.flight)}
              </option>
            ))}
          </select>
          <div className="entry-summary">
            <span><b>{round.thru}</b> thru</span>
            <span><b>{round.gross || '—'}</b> strokes</span>
            <span><b>{formatToPar(round.toPar)}</b></span>
          </div>
        </div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'hole', label: 'Hole by hole' },
            { value: 'card', label: 'Full card' },
          ]}
        />
      </Card>

      {!canEdit && <p className="notice">Sign in from the Admin screen to post scores.</p>}

      {mode === 'hole' ? (
        <HoleEntry
          hole={hole}
          index={holeIndex}
          count={holes.length}
          cell={current}
          disabled={!canEdit}
          onMove={(d) => setHoleIndex((i) => Math.min(holes.length - 1, Math.max(0, i + d)))}
          onSet={(v) => setScore(hole.number, v)}
        />
      ) : (
        <FullCard round={round} holes={holes} disabled={!canEdit} onSet={setScore} />
      )}
    </div>
  );
}

function HoleEntry({ hole, index, count, cell, onMove, onSet, disabled }) {
  const par = hole.par;
  // Offer the scores people actually make, centred on par.
  const options = [par - 2, par - 1, par, par + 1, par + 2, par + 3, par + 4].filter((n) => n > 0);
  const labels = { [par - 2]: 'Eagle', [par - 1]: 'Birdie', [par]: 'Par', [par + 1]: 'Bogey', [par + 2]: 'Double' };

  return (
    <Card>
      <div className="hole-head">
        <button type="button" className="btn btn-ghost nav-arrow" onClick={() => onMove(-1)} disabled={index === 0}>
          ‹
        </button>
        <div className="hole-title">
          <span className="hole-number">Hole {hole.number}</span>
          <span className="muted">Par {par}</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost nav-arrow"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
        >
          ›
        </button>
      </div>

      <div className="score-pad">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            className={`score-btn ${cell?.gross === n ? 'on' : ''}`}
            disabled={disabled}
            onClick={() => {
              onSet(cell?.gross === n ? null : n);
              if (cell?.gross !== n && index < count - 1) setTimeout(() => onMove(1), 180);
            }}
          >
            <span className="score-num">{n}</span>
            {labels[n] && <span className="score-label">{labels[n]}</span>}
          </button>
        ))}
      </div>

      <div className="score-extra">
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min="1"
          max="20"
          placeholder="Other"
          value={cell?.gross ?? ''}
          disabled={disabled}
          onChange={(e) => onSet(e.target.value === '' ? null : Number(e.target.value))}
        />
        <button type="button" className="btn btn-ghost" disabled={disabled || !cell?.gross} onClick={() => onSet(null)}>
          Clear
        </button>
      </div>

      <div className="hole-progress">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`dot ${i === index ? 'now' : ''}`} />
        ))}
      </div>
    </Card>
  );
}

function FullCard({ round, holes, onSet, disabled }) {
  const half = Math.floor(holes.length / 2);
  return (
    <Card title="Full card" subtitle="Type a score against any hole">
      <div className="full-card">
        {[holes.slice(0, half), holes.slice(half)].map((nine, i) => (
          <div key={i} className="nine">
            {nine.map((h) => {
              const cell = round.byNumber[h.number];
              return (
                <div className="card-row" key={h.number}>
                  <span className="card-hole">{h.number}</span>
                  <span className="card-meta muted">par {h.par}</span>
                  <input
                    className="input input-score"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="20"
                    value={cell?.gross ?? ''}
                    disabled={disabled}
                    onChange={(e) => onSet(h.number, e.target.value === '' ? null : Number(e.target.value))}
                  />
                  <span className="card-net muted">{cell ? formatToPar(cell.toPar) : ''}</span>
                </div>
              );
            })}
            <div className="card-row card-row-total">
              <span className="card-hole">{i === 0 ? 'Out' : 'In'}</span>
              <span />
              <span className="num strong">
                {round.holes
                  .slice(i === 0 ? 0 : half, i === 0 ? half : holes.length)
                  .reduce((t, h) => t + (h.gross ?? 0), 0) || '—'}
              </span>
              <span />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
