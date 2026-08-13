import React, { useMemo, useState } from 'react';
import { FLIGHTS } from '../lib/constants.js';
import { betterBallLeaderboard, byFlight, formatToPar, playerName, playerRound } from '../lib/scoring.js';
import { Card, Empty, Segmented } from './ui.jsx';
import ScorecardModal from './ScorecardModal.jsx';

/**
 * 2-man better ball. Teams are ranked inside the flight of their stronger
 * player, so a Championship + First pairing shows up under Championship.
 */
export default function TeamsTab({ teams, players, cards, holes, settings, onOpenAdmin }) {
  const [scope, setScope] = useState('flights');
  const [open, setOpen] = useState(null);

  const { rows, invalid } = useMemo(
    () => betterBallLeaderboard(teams, players, cards, holes, settings),
    [teams, players, cards, holes, settings],
  );

  const groups = useMemo(() => byFlight(rows, FLIGHTS.filter((f) => f.team)), [rows]);

  return (
    <div className="stack">
      {teams.length === 0 ? (
        <Empty icon="👥" title="No teams yet">
          Build the 2-man teams from the Admin screen below. Ladies and Junior players play
          individually and are not eligible for better ball.
        </Empty>
      ) : (
        <>
          <div className="controls">
            <span className="mode-note">Better ball · best score on each hole</span>
            <Segmented
              value={scope}
              onChange={setScope}
              size="sm"
              options={[
                { value: 'flights', label: 'By flight' },
                { value: 'all', label: 'Overall' },
              ]}
            />
          </div>

          {scope === 'all' ? (
            <Card title="All teams" subtitle={`${rows.length} team${rows.length === 1 ? '' : 's'}`}>
              <TeamTable rows={rows} onSelect={setOpen} showFlight />
            </Card>
          ) : (
            groups.map((g) => (
              <Card
                key={g.flight.id}
                title={`${g.flight.label} Flight`}
                subtitle={`${g.rows.length} team${g.rows.length === 1 ? '' : 's'}`}
              >
                <TeamTable rows={g.rows} onSelect={setOpen} />
              </Card>
            ))
          )}

          {invalid.length > 0 && (
            <Card title="Needs attention" className="card-warn">
              <ul className="issue-list">
                {invalid.map(({ team, members, problems }) => (
                  <li key={team.id}>
                    <b>{team.name || members.map(playerName).join(' / ') || 'Unnamed team'}</b>
                    <span className="muted"> — {problems.join(' ')}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {/* Admin lives here rather than in the tab bar. */}
      <div className="admin-launch">
        <button type="button" className="btn btn-primary btn-block" onClick={onOpenAdmin}>
          ⚙️ Admin — players, teams &amp; settings
        </button>
      </div>

      {open && <TeamCard team={open} holes={holes} cards={cards} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TeamTable({ rows, onSelect, showFlight = false }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="col-pos">#</th>
            <th>Team</th>
            {showFlight && <th>Flight</th>}
            <th className="num">Thru</th>
            <th className="num">Score</th>
            <th className="num">To Par</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.id} onClick={() => onSelect(r)} className={r.thru === 0 ? 'row-idle' : ''}>
              <td className="col-pos">{r.positionLabel}</td>
              <td className="col-name">
                {r.name}
                <small className="muted block">{r.members.map(playerName).join(' + ')}</small>
              </td>
              {showFlight && <td className="cap">{r.flight}</td>}
              <td className="num">{r.complete ? 'F' : r.thru || '—'}</td>
              <td className="num strong">{r.thru ? r.gross : '—'}</td>
              <td className="num">{r.thru ? formatToPar(r.toPar) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Team card showing both partners and the ball the team counted. */
function TeamCard({ team, holes, cards, onClose }) {
  const rounds = [
    ...team.members.map((m) => ({
      label: playerName(m),
      round: playerRound(m, cards[m.id], holes),
    })),
    { label: 'Better ball', round: team },
  ];

  return (
    <ScorecardModal
      title={team.name}
      subtitle={`${team.flight} flight · better ball`}
      holes={holes}
      rounds={rounds}
      onClose={onClose}
    />
  );
}
