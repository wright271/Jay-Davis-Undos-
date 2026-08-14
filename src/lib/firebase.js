/**
 * Firebase bootstrap.
 *
 * Config comes from src/lib/firebaseConfig.js, overridable per environment
 * with VITE_FIREBASE_* env vars. If no project is configured at all the app
 * falls back to on-device storage, so a fresh clone still runs with no backend
 * — handy for practice rounds and for local development.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { firebaseConfig as config } from './firebaseConfig.js';

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let app = null;
let db = null;
let auth = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
}

export { app, db, auth };

/** Subscribe to the signed-in admin user. Returns an unsubscribe function. */
export function watchAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signIn(email, password) {
  if (!auth) throw new Error('Firebase is not configured.');
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

/** Turn Firebase's error codes into something a person can act on. */
export function authErrorMessage(err) {
  switch (err?.code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your signal and try again.';
    default:
      return err?.message || 'Could not sign in.';
  }
}
