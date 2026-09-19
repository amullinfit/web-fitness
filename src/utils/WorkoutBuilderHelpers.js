// src/utils/WorkoutBuilderHelper.js

// Declare your API endpoints here
export const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';
export const VAL_MY_PACES_URL = '/api/val-my-paces';


// --- API Functions ---

export async function fetchFoldersApi() {
  const res = await fetch(`${VAL_WORKOUTBUILDER_URL}?action=get_folders`, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch folders');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.folders || []);
}

export async function fetchWorkoutsApi(folderId = null) {
  const url = folderId 
    ? `${VAL_WORKOUTBUILDER_URL}?action=get_workouts&folder_id=${folderId}` 
    : `${VAL_WORKOUTBUILDER_URL}?action=get_workouts`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch workouts');
  const data = await res.json();
  if (data && Array.isArray(data.children)) return data.children;
  return Array.isArray(data) ? data : (data.workouts || []);
}

export async function createFolderApi(folderName) {
  const res = await fetch(VAL_WORKOUTBUILDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_folder', name: folderName, type: 'FOLDER' }),
  });
  if (!res.ok) {
    let errorDetails = '';
    try {
      const errJson = await res.json();
      errorDetails = JSON.stringify(errJson.details || errJson, null, 2);
    } catch {
      errorDetails = await res.text();
    }
    throw new Error(`Server returned status ${res.status}:\n${errorDetails}`);
  }
  return await res.json();
}

export async function saveWorkoutApi(action, workoutId, workoutData) {
  const method = action === 'update_workout' ? 'PUT' : 'POST';
  const res = await fetch(VAL_WORKOUTBUILDER_URL, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, workoutId, workoutData }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to ${action === 'update_workout' ? 'update' : 'create'} workout: ${errorText}`);
  }
  return await res.json();
}

export async function fetchMyPacesApi() {
  const res = await fetch(VAL_MY_PACES_URL, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch paces from Intervals.icu');
  return await res.json();
}