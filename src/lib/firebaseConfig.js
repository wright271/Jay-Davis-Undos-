/**
 * Firebase web app config for the tournament project.
 *
 * These values are safe to keep in the repo: a Firebase web config identifies
 * the project, it does not grant access to it. The same values are compiled
 * into the JavaScript bundle that every phone downloads, so they are public
 * either way. What actually controls who can write is `database.rules.json`
 * (public read, organiser-only writes) — keep that file honest and this file
 * is uninteresting to an attacker.
 *
 * Any value can still be overridden per environment with a VITE_FIREBASE_*
 * env var, which is how you would point a staging build at a second project.
 */

const DEFAULT_CONFIG = {
  apiKey: 'AIzaSyBRJwJgTAGUHY6COl7oS1JxF4_INVeALRc',
  authDomain: 'jay-davis-undos.firebaseapp.com',
  projectId: 'jay-davis-undos',
  // Realtime Database instance URL. A database created in us-central1 gets the
  // firebaseio.com form below; any other region gets
  // https://<project>-default-rtdb.<region>.firebasedatabase.app instead. The
  // exact URL is shown at the top of the Data tab in the Firebase console —
  // if it differs from this, set VITE_FIREBASE_DATABASE_URL or edit here.
  databaseURL: 'https://jay-davis-undos-default-rtdb.firebaseio.com',
  storageBucket: 'jay-davis-undos.firebasestorage.app',
  messagingSenderId: '982252725642',
  appId: '1:982252725642:web:9d7f96b5ae7b73937d5473',
};

const pick = (envValue, fallback) => {
  const v = typeof envValue === 'string' ? envValue.trim() : '';
  return v || fallback;
};

export const firebaseConfig = {
  apiKey: pick(import.meta.env.VITE_FIREBASE_API_KEY, DEFAULT_CONFIG.apiKey),
  authDomain: pick(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, DEFAULT_CONFIG.authDomain),
  projectId: pick(import.meta.env.VITE_FIREBASE_PROJECT_ID, DEFAULT_CONFIG.projectId),
  databaseURL: pick(import.meta.env.VITE_FIREBASE_DATABASE_URL, DEFAULT_CONFIG.databaseURL),
  storageBucket: pick(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, DEFAULT_CONFIG.storageBucket),
  messagingSenderId: pick(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    DEFAULT_CONFIG.messagingSenderId,
  ),
  appId: pick(import.meta.env.VITE_FIREBASE_APP_ID, DEFAULT_CONFIG.appId),
};

/** Which tournament node under `tournaments/` this build reads. */
export const tournamentId = pick(import.meta.env.VITE_TOURNAMENT_ID, 'default');
