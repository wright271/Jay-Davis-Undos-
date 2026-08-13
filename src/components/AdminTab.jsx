import React, { useEffect, useMemo, useState } from 'react';
import { FLIGHTS, FLIGHT_BY_ID, flightLabel, DEFAULT_HOLES } from '../lib/constants.js';
import { playerName, teamFlight, teamProblems, totalPar, flightRank } from '../lib/scoring.js';
import { uid } from '../lib/store.js';
import { isFirebaseConfigured, signIn, signOut, authErrorMessage } from '../lib/firebase.js';
import { Card, Field, Toggle, Segmented, Empty, Badge, DangerButton } from './ui.jsx';

const SECTIONS = [
  { id: 'players', label: 'Players' },
  { id: 'teams', label: 'Teams' },
  { id: 'course', label: 'Course' },
  { id: 'settings', label: 'Settings' },
];

export default function AdminTab(props) {
  const { canEdit, user, onClose } = props;
  const [section, setSection] = useState('players');

  return (
    <div className="stack admin">
      <div className="admin-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          ‹ Back to teams
        </button>
        <SignInBox user={user} />
      </div>

      {!canEdit ? (
        <Empty icon="🔒" title="Sign in to make changes">
          Anyone can follow the leaderboards; posting scores and editing the field needs an
          organiser account.
        </Empty>
      ) : (
        <>
          <Segmented value={section} onChange={setSection} size="sm" options={SECTIONS.map((s) => ({ value: s.id, label: s.label }))} />
          {section === 'players' && <PlayersSection {...props} />}
          {section === 'teams' && <TeamsSection {...props} />}
          {section === 'course' && <CourseSection {...props} />}
          {section === 'settings' && <SettingsSection {...props} />}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function SignInBox({ user }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isFirebaseConfigured) return <Badge tone="info">Local mode</Badge>;
  if (user) {
    return (
      <div className="signin-row">
        <span className="muted small">{user.email}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => signOut()}>Sign out</button>
      </div>
    );
  }
  if (!open) {
    return <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>Sign in</button>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      setOpen(false);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="signin-form" onSubmit={submit}>
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? '…' : 'Go'}</button>
      {error && <p className="error small">{error}</p>}
    </form>
  );
}

/* ---------------------------------------------------------------- */

const blankPlayer = () => ({ id: uid(), firstName: '', lastName: '', flight: 'championship' });

function PlayersSection({ players, store, teams }) {
  const [draft, setDraft] = useState(blankPlayer);
  const [filter, setFilter] = useState('all');
  const [bulk, setBulk] = useState('');

  const shown = filter === 'all' ? players : players.filter((p) => p.flight === filter);
  const sorted = [...shown].sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

  const add = async (e) => {
    e.preventDefault();
    if (!draft.firstName.trim() && !draft.lastName.trim()) return;
    await store.upsertPlayer(draft);
    setDraft(blankPlayer());
  };

  const importBulk = async () => {
    // One player per line: First, Last, Flight
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const [first = '', last = '', flight = ''] = line.split(',').map((s) => s.trim());
      const flightId = FLIGHTS.find(
        (f) => f.id === flight.toLowerCase() || f.label.toLowerCase() === flight.toLowerCase(),
      )?.id;
      await store.upsertPlayer({
        id: uid(),
        firstName: first,
        lastName: last,
        flight: flightId || 'championship',
      });
    }
    setBulk('');
  };

  return (
    <>
      <Card title="Add a player">
        <form className="form-grid" onSubmit={add}>
          <Field label="First name">
            <input className="input" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input className="input" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
          <Field label="Flight">
            <select className="input" value={draft.flight} onChange={(e) => setDraft({ ...draft, flight: e.target.value })}>
              {FLIGHTS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </Field>
          <button className="btn btn-primary">Add player</button>
        </form>
      </Card>

      <Card
        title={`Field — ${players.length}`}
        actions={
          <select className="input input-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All flights</option>
            {FLIGHTS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        }
      >
        {sorted.length === 0 ? (
          <p className="muted pad">Nobody in this flight yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Flight</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <PlayerRow key={p.id} player={p} store={store} teams={teams} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Bulk import" subtitle="One player per line: First, Last, Flight">
        <textarea
          className="input textarea"
          rows={4}
          placeholder={'Jay, Davis, Championship\nSarah, Lee, Ladies'}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <button type="button" className="btn" disabled={!bulk.trim()} onClick={importBulk}>
          Import
        </button>
      </Card>
    </>
  );
}

function PlayerRow({ player, store, teams }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player);
  useEffect(() => setDraft(player), [player]);

  const onTeam = teams.some((t) => (t.playerIds || []).includes(player.id));

  if (!editing) {
    return (
      <tr>
        <td className="col-name">
          {playerName(player)}
          {onTeam && <small className="muted block">on a team</small>}
        </td>
        <td className="cap">{flightLabel(player.flight)}</td>
        <td className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
          <DangerButton onConfirm={() => store.removePlayer(player.id)} />
        </td>
      </tr>
    );
  }

  const save = async () => {
    await store.upsertPlayer(draft);
    setEditing(false);
  };

  return (
    <tr className="editing">
      <td>
        <div className="inline-inputs">
          <input className="input input-sm" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          <input className="input input-sm" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
        </div>
      </td>
      <td>
        <select className="input input-sm" value={draft.flight} onChange={(e) => setDraft({ ...draft, flight: e.target.value })}>
          {FLIGHTS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </td>
      <td className="row-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------------- */

function TeamsSection({ teams, players, store, settings }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [name, setName] = useState('');

  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  // Ladies and Junior players are individual-only, so they never appear here.
  const eligible = players.filter((p) => FLIGHT_BY_ID[p.flight]?.team);
  const taken = new Set(teams.flatMap((t) => t.playerIds || []));

  const pair = [byId[a], byId[b]].filter(Boolean);
  const preview = pair.length === 2 ? teamFlight(pair, settings) : null;
  const problems = pair.length === 2 ? teamProblems({ id: 'draft' }, pair, settings) : [];

  const create = async (e) => {
    e.preventDefault();
    if (pair.length !== 2 || problems.length) return;
    await store.upsertTeam({
      id: uid(),
      name: name.trim() || pair.map((p) => p.lastName || playerName(p)).join(' / '),
      playerIds: [a, b],
    });
    setA('');
    setB('');
    setName('');
  };

  const options = (exclude) =>
    eligible
      .filter((p) => p.id !== exclude)
      .map((p) => (
        <option key={p.id} value={p.id} disabled={taken.has(p.id)}>
          {playerName(p)} — {flightLabel(p.flight)}{taken.has(p.id) ? ' · on a team' : ''}
        </option>
      ));

  return (
    <>
      <Card title="Build a 2-man team" subtitle="The team plays in the stronger player's flight">
        <form className="form-grid" onSubmit={create}>
          <Field label="Player 1">
            <select className="input" value={a} onChange={(e) => setA(e.target.value)}>
              <option value="">Choose…</option>
              {options(b)}
            </select>
          </Field>
          <Field label="Player 2">
            <select className="input" value={b} onChange={(e) => setB(e.target.value)}>
              <option value="">Choose…</option>
              {options(a)}
            </select>
          </Field>
          <Field label="Team name" hint="Optional — defaults to both surnames">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Davis / Wright" />
          </Field>
          {preview && (
            <p className="preview-note">
              Plays in the <b className="cap">{preview}</b> flight
            </p>
          )}
          {problems.map((p) => (
            <p className="error small" key={p}>{p}</p>
          ))}
          <button className="btn btn-primary" disabled={pair.length !== 2 || problems.length > 0}>
            Create team
          </button>
        </form>
        {eligible.length < 2 && (
          <p className="muted pad">
            Add at least two Championship, First or Senior players — Ladies and Junior flights play
            individually.
          </p>
        )}
      </Card>

      <Card title={`Teams — ${teams.length}`}>
        {teams.length === 0 ? (
          <p className="muted pad">No teams yet.</p>
        ) : (
          <ul className="team-list">
            {teams.map((t) => {
              const members = (t.playerIds || []).map((id) => byId[id]).filter(Boolean);
              const issues = teamProblems(t, members, settings);
              const flight = teamFlight(members, settings);
              return (
                <li key={t.id}>
                  <div>
                    <b>{t.name}</b>
                    <small className="muted block">
                      {members.map((m) => `${playerName(m)} (${flightLabel(m.flight)})`).join('  +  ')}
                    </small>
                    {issues.length > 0 ? (
                      <small className="error block">{issues.join(' ')}</small>
                    ) : (
                      <Badge tone="ok">{flightLabel(flight)} flight</Badge>
                    )}
                  </div>
                  <DangerButton onConfirm={() => store.removeTeam(t.id)} confirmLabel="Remove?" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

/* ---------------------------------------------------------------- */

function CourseSection({ tournament, holes, store }) {
  const [draft, setDraft] = useState(holes);
  useEffect(() => setDraft(holes), [holes]);

  const setPar = (i, value) =>
    setDraft(draft.map((h, idx) => (idx === i ? { ...h, par: Number(value) || 0 } : h)));

  const dirty = JSON.stringify(draft) !== JSON.stringify(holes);
  const half = Math.floor(draft.length / 2);
  const sum = (arr) => arr.reduce((t, h) => t + h.par, 0);

  return (
    <Card
      title="Course card"
      subtitle={`Par ${totalPar(draft)} — ${sum(draft.slice(0, half))} out, ${sum(draft.slice(half))} in`}
      actions={
        <div className="card-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(DEFAULT_HOLES)}>
            Reset
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!dirty}
            onClick={() => store.saveTournament({ holes: draft })}
          >
            Save card
          </button>
        </div>
      }
    >
      <div className="form-grid two">
        <Field label="Course name">
          <input
            className="input"
            defaultValue={tournament.courseName || ''}
            onBlur={(e) => store.saveTournament({ courseName: e.target.value })}
          />
        </Field>
      </div>

      <div className="par-grid">
        {draft.map((h, i) => (
          <label className="par-cell" key={h.number}>
            <span className="par-hole">{h.number}</span>
            <input
              className="input input-sm input-score"
              type="number"
              min="3"
              max="6"
              value={h.par}
              onChange={(e) => setPar(i, e.target.value)}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- */

function SettingsSection({ tournament, settings, store }) {
  const save = (patch) => store.saveTournament({ settings: { ...settings, ...patch } });

  return (
    <>
      <Card title="Tournament">
        <div className="form-grid two">
          <Field label="Name">
            <input className="input" defaultValue={tournament.name} onBlur={(e) => store.saveTournament({ name: e.target.value })} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" defaultValue={tournament.date} onChange={(e) => store.saveTournament({ date: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="Skins" subtitle="Championship, First and Senior flights only">
        <Field label="Game">
          <Segmented
            value={settings.skinsScope}
            onChange={(v) => save({ skinsScope: v })}
            options={[
              { value: 'field', label: 'Whole field' },
              { value: 'flight', label: 'Per flight' },
            ]}
          />
        </Field>
        <Toggle
          checked={settings.skinsCarryover}
          onChange={(v) => save({ skinsCarryover: v })}
          label="Carry tied holes forward"
          hint="A halved hole adds its skin to the next hole won"
        />
        <Field label="Value per skin" hint="Set to 0 to hide payouts">
          <input
            className="input input-score"
            type="number"
            min="0"
            value={settings.skinsValuePerHole ?? 0}
            onChange={(e) => save({ skinsValuePerHole: Number(e.target.value) || 0 })}
          />
        </Field>
      </Card>

      <Card
        title="Flight strength"
        subtitle="Decides which flight a mixed better-ball team plays in — lower is stronger"
      >
        <div className="rank-grid">
          {FLIGHTS.filter((f) => f.team).map((f) => (
            <Field key={f.id} label={f.label}>
              <input
                className="input input-score"
                type="number"
                step="0.5"
                value={flightRank(f.id, settings)}
                onChange={(e) =>
                  save({ flightRanks: { ...(settings.flightRanks || {}), [f.id]: Number(e.target.value) } })
                }
              />
            </Field>
          ))}
        </div>
        <p className="muted small">
          Default order is Championship, First, then Senior. Senior is an age flight rather than a
          skill flight, so change these numbers if a Senior + First team should play Senior.
        </p>
      </Card>
    </>
  );
}
