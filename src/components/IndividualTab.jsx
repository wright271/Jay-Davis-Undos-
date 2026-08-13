import React, { useMemo, useState } from 'react';
import { FLIGHTS } from '../lib/constants.js';
import { individualLeaderboard, byFlight, formatToPar } from '../lib/scoring.js';
import { Card, Segmented, Empty, Badge } from './ui.jsx';
import ScorecardModal from './ScorecardModal.jsx';

/**
 * Individual leaderboard. Every player in the field turns in a card here,
 * including the players who also make up a better-ball team.
 */
export default function IndividualTab({ players, cards, holes }) {
  const [scope, setScope] = useState('flights');
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => individualLeaderboard(players, cards, holes), [players, cards, holes]);
  const groups = useMemo(() => (scope === 'flights' ? byFlight(rows, FLIGHTS) : null), [rows, scope]);

  if (players.length === 0) {
    return (
      <Empty title="No players yet">
        Add the field from the Admin screen — the button is at the bottom of the Teams tab.
      </Empty>
    );
  }

  return (
    <div className="stack">
      <div className="controls">
        <span className="mode-note">Stroke play</span>
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
        <Card title="Overall" subtitle={`${rows.length} players`}>
          <LeaderTable rows={rows} onSelect={setOpen} />
        </Card>
      ) : (
        groups.map((g) => (
          <Card
            key={g.flight.id}
            title={`${g.flight.label} Flight`}
            subtitle={`${g.rows.length} player${g.rows.length === 1 ? '' : 's'}`}
            actions={!g.flight.team && <Badge tone="info">Individual only</Badge>}
          >
            <LeaderTable rows={g.rows} onSelect={setOpen} />
          </Card>
        ))
      )}

      {open && (
        <ScorecardModal
          title={open.name}
          subtitle={`${open.player.flight ?? ''} flight`}
          holes={holes}
          rounds={[{ label: open.name, round: open }]}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function LeaderTable({ rows, onSelect }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="col-pos">#</th>
            <th>Player</th>
            <th className="num">Thru</th>
            <th className="num">Score</th>
            <th className="num">To Par</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player.id} onClick={() => onSelect(r)} className={r.thru === 0 ? 'row-idle' : ''}>
              <td className="col-pos">{r.positionLabel}</td>
              <td className="col-name">{r.name}</td>
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
