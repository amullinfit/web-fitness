//
// WorkoutBUilderHelpers.js
//
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// 
// 
// 
    // 1. Consume context
    import { usePaces } from '../utils/PacesContext.jsx';

    const { paces, loading: pacesLoading } = usePaces();

    const DEFAULT_THRESHOLD = paces?.threshold_pace;

    // - Declare API endpoints
    const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';
    const VAL_MY_PACES_URL = '/api/val-my-paces';


// 
// 
// 
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// 
// 
// 
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

  // 1. Extract folders from root 'folders' array
  const folders = Array.isArray(data?.folders) ? data.folders : [];

  // 2. Extract all workouts nested inside each folder's 'children' array
  const workouts = folders.flatMap((folder) =>
    Array.isArray(folder.children)
      ? folder.children.map((workout) => ({
          ...workout,
          // Guarantee folder_id is attached to every workout
          folderId: workout.folder_id || folder.id,
        }))
      : []
  );

  // Return formatted payload containing both folders and extracted workouts
  return {
    folders,
    workouts,
  };
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

export async function saveWorkoutApi(payload) {
  const action = payload.id ? 'update_workout' : 'create_workout';
  const method = payload.id ? 'PUT' : 'POST';
  const res = await fetch(VAL_WORKOUTBUILDER_URL, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save workout: ${errorText}`);
  }
  return await res.json();
}

export async function fetchMyPacesApi() {
  const res = await fetch(VAL_MY_PACES_URL, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch paces from Intervals.icu');
  return await res.json();
}

// 
// 
// 
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// 
// 
// 
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

// 
// 
// 
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// 
// 
// 
// - Data retrieval & Parsing Helpers ---

  // Dynamically compute preset values from intervals.icu data
  export function calculateDynamicPresets(paces, thresholdPaceSec, paceMethod) {
    // If paces or preset_colors array doesn't exist, use fallback logic
    if (!paces || !Array.isArray(paces.preset_colors)) {

      // Fallback zone config if PacesContext is not available
      const DEFAULT_PACE_ZONE_NAMES  = [  "Zone_1", "Zone_2", "Zone_3", "Zone_4","Zone_5a","Zone_5b","Zone_5c", "Zone 6"];
      const DEFAULT_PACE_ZONE_COLORS = [ "#b0b0b0","#88d8b0","#28a745","#ffc107","#fd7e14","#ff6b6b","#dc3545","#6f42c1"];
      const DEFAULT_PACE_ZONES       = [        80,       92,     94.3,      100,    103.4,    111.5,    128.9,      169];
      const DEFAULT_PACE_VAL_SEC     = [       619,      538,      525,      495,      479,      444,      330,      293];
      const DEFAULT_PACE_STR         = ["10:19/mi","8:58/mi","8:45/mi","8:15/mi","7:59/mi","7:24/mi","6:24/mi","4:53/mi"];

      return DEFAULT_PACE_ZONE_NAMES.map((name, idx) => ({
        label: name,
        displayPace: formatMMSS(DEFAULT_PACE_VAL_SEC[idx]),
        targetPaceSec: DEFAULT_PACE_VAL_SEC[idx],
        color: DEFAULT_PACE_ZONE_COLORS[idx % DEFAULT_PACE_ZONE_COLORS.length],
        colorLabel: '',
      }));
    }

    return paces.preset_colors.map((preset) => {
      // Extract properties directly from the preset_colors object
      const label = preset.zone_name || `Zone ${preset.zone}`;
      const color = preset.color || '#cccccc';
      const colorLabel = preset.label || '';
      
      // Determine the base pace seconds (prefer pace_val_sec from JSON if present)
      let paceSec = preset.pace_val_sec;
      if (!paceSec) {
        if (preset.pace_fast) {
          paceSec = parseMMSS(preset.pace_fast);
        } else if (preset.pace_value_num) {
          paceSec = convertToPaceSec(preset.pace_value_num);
        } else {
          paceSec = thresholdPaceSec;
        }
      }

      // Format display pace based on the requested paceMethod
      let displayPace = formatMMSS(paceSec);
      
      if (paceMethod === 'Threshold %') {
        const pct = preset.pace_zone_pct || Math.round((thresholdPaceSec / paceSec) * 100);
        displayPace = `${pct}%`;
      } else if (paceMethod?.includes('Range') && preset.pace_slow && preset.pace_fast) {
        displayPace = `${preset.pace_slow}-${preset.pace_fast}`;
      } else if (paceMethod?.includes('Range')) {
        const lowPace = Math.round(paceSec * 0.97);
        const highPace = Math.round(paceSec * 1.03);
        displayPace = `${formatMMSS(lowPace)}-${formatMMSS(highPace)}`;
      }

      return {
        zone: preset.zone_name,
        label,
        displayPace,
        targetPaceSec: paceSec,
        color,
        colorLabel,
        paceSlow: preset.pace_slow,
        paceFast: preset.pace_fast,
        pct: preset.pace_zone_pct
      };
    });
  }
// 
// 
// 
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// 
// 
// 
// --- Step Creation & Mapping Helpers ---

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

  export const addIdsToBaseWorkout = (baseWorkout) => {
    if (!baseWorkout?.workout_doc?.steps) return baseWorkout;
  
    const timestamp = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
  
    const generateStepId = (idx) => 
      `step-loaded-${timestamp}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
  
    const processSteps = (steps) => {
      return steps.map((step, idx) => {
        const updatedStep = {
          ...step,
          id: step.id || generateStepId(idx)
        };
  
        // Recursively add IDs to nested child steps (e.g. inside repeaters)
        if (Array.isArray(updatedStep.steps)) {
          updatedStep.steps = processSteps(updatedStep.steps);
        }
  
        return updatedStep;
      });
    };
  
    return {
      ...baseWorkout,
      workout_doc: {
        ...baseWorkout.workout_doc,
        steps: processSteps(baseWorkout.workout_doc.steps)
      }
    };
  };
    
  export const removeIdsFromBaseWorkout = (baseWorkout) => {
    if (!baseWorkout?.workout_doc?.steps) return baseWorkout;
  
    const stripStepId = (steps) => {
      return steps.map((step) => {
        // Destructure to separate 'id' from the rest of the step properties
        const { id, steps: childSteps, ...cleanStep } = step;
  
        // Recursively strip IDs from nested child steps if present
        if (Array.isArray(childSteps)) {
          cleanStep.steps = stripStepId(childSteps);
        }
  
        return cleanStep;
      });
    };
  
    return {
      ...baseWorkout,
      workout_doc: {
        ...baseWorkout.workout_doc,
        steps: stripStepId(baseWorkout.workout_doc.steps)
      }
    };
  };
  
  export const mapIcuDocToSteps = (workout, mode = 'time') => {
    const stepsSource = workout?.workout_doc?.steps || workout?.steps;
    if (!Array.isArray(stepsSource) || stepsSource.length === 0) {
      return createDefaultSteps('time');
    }
  
    const mapStep = (s, idx) => {
      // step.id = date(YYYYMMSS)-idx-randomstring
      const id = `step-loaded-${new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14)}-${idx}-${Math.random().toString(36).substr(2, 4)}`;

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
  
      const durationSec = s.duration || s.durationSec || 300;
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