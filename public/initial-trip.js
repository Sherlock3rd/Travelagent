import { STORAGE_KEY, blankState, validateState } from './model.js';

// Seed a new browser only. Existing local edits, including an intentionally
// empty trip, always win over the published snapshot.
export async function loadInitialTrip(storage, readPublished, key = STORAGE_KEY) {
  const saved = storage.getItem(key);
  if (saved !== null) return { state: validateState(JSON.parse(saved)), serialized: saved };
  const published = await readPublished();
  const newer = storage.getItem(key);
  if (newer !== null) return { state: validateState(JSON.parse(newer)), serialized: newer };
  if (!published) return { state: blankState(), serialized: null };
  const state = validateState(published);
  const serialized = JSON.stringify(state);
  storage.setItem(key, serialized);
  return { state, serialized };
}
