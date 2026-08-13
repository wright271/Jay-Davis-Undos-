import React, { useMemo } from 'react';
import { skinsGames, skinsEligible, playerName } from '../lib/scoring.js';
import { Card, Empty, Badge } from './ui.jsx';

const money = (n) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Skins. Championship, First and Senior flights only — Ladies and Junior
 * players are not in the game, per the tournament conditions.
 */
export default function SkinsTab({ players, cards, holes, settings }) {
  const games = useMemo(() => skinsGames(players, cards, holes, settings), [players, cards, holes, settings]);
  const eligible = useMemo(() => skinsEligible(players), [players]);

  if (eligible.length === 0) {
    return (
      <Empty icon="💰" title="Nobody in the skins game yet">
        Skins are played by the Championship, First and Senior flights.
      </Empty>
    );
  }

  return (
    <div className="stack">
      <div className="controls">
        <span className="mode-note">
          Low score wins the hole
          {settings.skinsCarryover ? ' · carryover' : ' · no carryover'}
          {` · ${eligible.length} players`}
        </span>
      </div>

      {games.map((game) => (
        <SkinsGame key={game.key} game={game} />
      ))}

      <p className="footnote">
        Ladies and Junior flights play for individual prizes only and are excluded from skins.
      </p>
    </div>
  );
}

function SkinsGame({ game }) {
  const { result, label, players } = game;
  const { winners, holes: holeResults, carrying, valuePerHole, skinsAwarded } = result;

  return (
    <>
      <Card
        title={label}
        subtitle={`${players.length} players · ${skinsAwarded} skin${skinsAwarded === 1 ? '' : 's'} won`}
        actions={carrying > 0 && <Badge tone="warn">{carrying} carrying</Badge>}
      >
        {winners.length === 0 ? (
          <p className="muted pad">No skins won yet — every hole halved so far.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="num">Skins</th>
                  <th>Holes</th>
                  {valuePerHole > 0 && <th className="num">Payout</th>}
                </tr>
              </thead>
              <tbody>
                {winners.map((w) => (
                  <tr key={w.player.id}>
                    <td className="col-name">{playerName(w.player)}</td>
                    <td className="num strong">{w.skins}</td>
                    <td className="muted">{w.holes.join(', ')}</td>
                    {valuePerHole > 0 && <td className="num">{money(w.payout)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Hole by hole" subtitle="Outright low score wins; ties push">
        <div className="skins-grid">
          {holeResults.map((h) => (
            <div key={h.number} className={`skin-cell skin-${h.status}`}>
              <div className="skin-hole">
                <span className="skin-num">{h.number}</span>
                <span className="skin-par">par {h.par}</span>
              </div>
              {h.status === 'won' && (
                <>
                  <div className="skin-winner">{playerName(h.winner)}</div>
                  <div className="skin-detail">
                    {h.best} {h.skins > 1 && <b>×{h.skins}</b>}
                  </div>
                </>
              )}
              {h.status === 'tied' && (
                <>
                  <div className="skin-winner muted">Halved</div>
                  <div className="skin-detail muted">
                    {h.best} · {h.tiedBy} tied
                  </div>
                </>
              )}
              {h.status === 'pending' && <div className="skin-winner muted">—</div>}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
