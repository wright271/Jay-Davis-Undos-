import React from 'react';
import { nineSplits, formatToPar } from '../lib/scoring.js';

/** Colour a score relative to par, the way a TV leaderboard does. */
function scoreClass(gross, par) {
  if (gross === null || gross === undefined) return '';
  const d = gross - par;
  if (d <= -2) return 'sc-eagle';
  if (d === -1) return 'sc-birdie';
  if (d === 0) return 'sc-par';
  if (d === 1) return 'sc-bogey';
  return 'sc-double';
}

/**
 * Hole-by-hole card. Takes one or more rounds so it can show a single player
 * or both partners of a better-ball team side by side.
 */
export default function ScorecardModal({ title, subtitle, holes, rounds, onClose }) {
  const half = Math.floor(holes.length / 2);
  const nines = [
    { label: 'Out', slice: holes.slice(0, half) },
    { label: 'In', slice: holes.slice(half) },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="muted cap">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </header>

        <div className="modal-body">
          {nines.map((nine) => (
            <div className="table-wrap card-table" key={nine.label}>
              <table className="table scorecard">
                <thead>
                  <tr>
                    <th className="col-label">Hole</th>
                    {nine.slice.map((h) => (
                      <th key={h.number} className="num">{h.number}</th>
                    ))}
                    <th className="num total">{nine.label}</th>
                  </tr>
                  <tr className="subhead">
                    <th className="col-label">Par</th>
                    {nine.slice.map((h) => (
                      <th key={h.number} className="num">{h.par}</th>
                    ))}
                    <th className="num total">{nine.slice.reduce((t, h) => t + h.par, 0)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map(({ label, round }) => {
                    const splits = nineSplits(round.holes);
                    const nineTotal = nine.label === 'Out' ? splits.out : splits.in;
                    return (
                      <tr key={label}>
                        <th className="col-label">{label}</th>
                        {nine.slice.map((h) => {
                          const value = round.byNumber?.[h.number]?.gross;
                          return (
                            <td key={h.number} className={`num score ${scoreClass(value, h.par)}`}>
                              {value ?? '·'}
                            </td>
                          );
                        })}
                        <td className="num total">{nineTotal ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <div className="card-totals">
            {rounds.map(({ label, round }) => (
              <div className="total-row" key={label}>
                <span className="total-name">{label}</span>
                <span className="total-figures">
                  <b>{round.gross || '—'}</b> strokes · {formatToPar(round.toPar)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
