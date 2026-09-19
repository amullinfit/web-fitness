// Declare your API endpoints here
const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';
const VAL_MY_PACES_URL = '/api/val-my-paces';
export const DEFAULT_THRESHOLD = 480; // 8:00/mi default fallback (480 seconds)

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

// --- Formatting & Parsing Helpers ---

export const formatTime = (totalSeconds) => {
    const sec = Math.max(0, Math.round(totalSeconds || 0));
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  export const formatMMSS = (totalSeconds) => {
    const sec = Math.max(0, Math.round(totalSeconds || 0));
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  export const parseMMSS = (str) => {
    if (!str) return 0;
    let cleanStr = String(str).trim().replace(/\/mi|\/km/g, '');
    if (cleanStr.includes(':')) {
      const parts = cleanStr.split(':');
      if (parts.length === 3) {
        return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseInt(parts[2], 10) || 0);
      }
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    }
    const num = parseInt(cleanStr, 10);
    if (isNaN(num)) return 0;
    if (num < 100) return num * 60;
    const mins = Math.floor(num / 100);
    const secs = num % 100;
    return mins * 60 + Math.min(secs, 59);
  };
  
  // Converts string "8:15/mi" or numeric m/s to total seconds per mile
  export const convertToPaceSec = (val) => {
    if (!val) return DEFAULT_THRESHOLD;
    if (typeof val === 'string') {
      return parseMMSS(val);
    }
    if (typeof val === 'number' && val > 0) {
      // If value is small (< 15), treat as m/s speed from Intervals.icu
      if (val < 15) {
        return Math.round(1609.344 / val);
      }
      // Otherwise treat as raw seconds
      return Math.round(val);
    }
    return DEFAULT_THRESHOLD;
  };
  
  export const formatDistance = (miles) => (miles || 0).toFixed(2) + ' mi';

  // --- Step Creation & Mapping Helpers ---

  // Updated PRESET_COLORS order: Grey, Green, Cyan, Blue, Yellow, Orange, Red
  export const PRESET_COLORS = [
    '#6c757d', // Grey / Zone 1
    '#28a745', // Green / Zone 2
    '#17a2b8', // Cyan / Zone 3
    '#007bff', // Blue / Zone 4
    '#ffc107', // Yellow / Zone 5a
    '#fd7e14', // Orange / Zone 5b
    '#dc3545', // Red / Zone 5c
  ];
  
  export const createStep = (type, mode = 'time') => {
    const id = `step-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const durationSec = mode === 'time' ? 600 : 0;
    const distanceMiles = mode === 'distance' ? 1.0 : 0;
  
    switch (type) {
      case 'warmup': return { id, type: 'warmup', durationSec, distanceMiles, targetPaceSec: 619 };
      case 'run': return { id, type: 'run', durationSec, distanceMiles, targetPaceSec: DEFAULT_THRESHOLD };
      case 'recovery': return { id, type: 'recovery', durationSec: mode === 'time' ? 120 : 0, distanceMiles: mode === 'distance' ? 0.25 : 0, targetPaceSec: 660 };
      case 'cooldown': return { id, type: 'cooldown', durationSec, distanceMiles, targetPaceSec: 619 };
      case 'repeat':
        return {
          id,
          type: 'repeat',
          iterations: 3,
          steps: [
            { id: `${id}-1`, type: 'run', durationSec, distanceMiles, targetPaceSec: DEFAULT_THRESHOLD },
            { id: `${id}-2`, type: 'recovery', durationSec: mode === 'time' ? 120 : 0, distanceMiles: mode === 'distance' ? 0.25 : 0, targetPaceSec: 660 }
          ],
        };
      default: return { id, type: 'run', durationSec, distanceMiles, targetPaceSec: DEFAULT_THRESHOLD };
    }
  };
  
  export const createDefaultSteps = (mode = 'time') => [
    createStep('warmup', mode),
    createStep('repeat', mode),
    createStep('cooldown', mode),
  ];
  
  export const mapIcuDocToSteps = (workout) => {
    const stepsSource = workout?.workout_doc?.steps || workout?.steps;
    if (!Array.isArray(stepsSource) || stepsSource.length === 0) {
      return createDefaultSteps('time');
    }
  
    const mapStep = (s, idx) => {
      const id = `step-loaded-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
      if (s.reps && Array.isArray(s.steps)) {
        return {
          id,
          type: 'repeat',
          iterations: s.reps,
          steps: s.steps.map(mapStep),
        };
      }
  
      let type = 'run';
      if (s.warmup || s.intensity === 'warmup') type = 'warmup';
      else if (s.cooldown || s.intensity === 'cooldown') type = 'cooldown';
      else if (s.intensity === 'rest') type = 'recovery';
  
      let targetPaceSec = DEFAULT_THRESHOLD;
      if (s.pace?.value) targetPaceSec = convertToPaceSec(s.pace.value);
      else if (s.pace?.start) targetPaceSec = convertToPaceSec(s.pace.start);
  
      const durationSec = s.duration || 300;
      const distanceMiles = s.distance ? s.distance / 1609.344 : (durationSec / targetPaceSec);
  
      return {
        id,
        type,
        durationSec,
        distanceMiles,
        targetPaceSec,
      };
    };
  
    return stepsSource.map(mapStep);
  };
  
  export const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createElementObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  