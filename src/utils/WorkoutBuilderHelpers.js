//
// WorkoutBuilderHelpers.js
//
import React from 'react';

// Module-level fallback constant for threshold in sec/mi
export const FALLBACK_THRESHOLD = 540; 

// Declare API endpoints
const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';
const VAL_MY_PACES_URL = '/api/val-my-paces';

export const DEFAULT_THRESHOLD = (paces) => {
  return paces?.threshold_pace || FALLBACK_THRESHOLD;
};

// --- API Functions ---

export async function fetchFoldersApi() {
  console.log('[App Debug BuilderHelpers] fetchFoldersApi called');
  try {
    const res = await fetch(`${VAL_WORKOUTBUILDER_URL}?action=get_folders`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch folders`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.folders || []);
  } catch (err) {
    console.error('[App Debug BuilderHelpers] fetchFoldersApi error:', err);
    throw err;
  }
}

export async function fetchWorkoutsApi(folderId = null) {
  console.log('[App Debug BuilderHelpers] fetchWorkoutsApi called with folderId:', folderId);
  try {
    const url = folderId 
      ? `${VAL_WORKOUTBUILDER_URL}?action=get_workouts&folder_id=${folderId}` 
      : `${VAL_WORKOUTBUILDER_URL}?action=get_workouts`;

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch workouts`);

    const data = await res.json();

    // Extract folders from root 'folders' array
    const folders = Array.isArray(data?.folders) ? data.folders : [];

    // Extract all workouts nested inside each folder's 'children' array
    const workouts = folders.flatMap((folder) =>
      Array.isArray(folder.children)
        ? folder.children.map((workout) => ({
            ...workout,
            folderId: workout.folder_id || folder.id,
          }))
        : []
    );

    return { folders, workouts };
  } catch (err) {
    console.error('[App Debug BuilderHelpers] fetchWorkoutsApi error:', err);
    throw err;
  }
}

export async function createFolderApi(folderName) {
  console.log('[App Debug BuilderHelpers] createFolderApi called with folderName:', folderName);
  try {
    const res = await fetch(VAL_WORKOUTBUILDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_folder', name: folderName, type: 'FOLDER' }),
    });
    if (!res.ok) {
      let errorDetails = '';
      try {
        const errJson = await res.json();
        errorDetails = errJson.error || errJson.details || JSON.stringify(errJson);
      } catch {
        errorDetails = await res.text();
      }
      throw new Error(`Server status ${res.status}: ${errorDetails}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[App Debug BuilderHelpers] createFolderApi error:', err);
    throw err;
  }
}

export async function saveWorkoutApi(payload, isNew = false) {
  console.log('[App Debug BuilderHelpers] saveWorkoutApi called with payload:', payload, 'isNew:', isNew);
  
  try {
    let workoutData = JSON.parse(JSON.stringify(payload || {}));

    if (isNew) {
      delete workoutData.id;
      delete workoutData._id;
      if (workoutData.workout_doc) {
        workoutData = addIdsToBaseWorkout(workoutData);
      }
    }

    const action = workoutData.id ? 'update_workout' : 'create_workout';
    const method = workoutData.id ? 'PUT' : 'POST';

    let folderId = workoutData.saveFolderId ?? workoutData.folderId ?? workoutData.folder_id ?? null;
    if (folderId === '' || folderId === 'root' || folderId === undefined) {
      folderId = null;
    } else if (typeof folderId === 'string' && /^\d+$/.test(folderId.trim())) {
      folderId = Number(folderId);
    }

    const workoutName = workoutData.name || workoutData.title || workoutData.workout_doc?.name || 'Untitled Workout';
    const steps = workoutData.workout_doc?.steps || workoutData.steps || [];
    
    // 1. Generate text description required by Intervals.icu API
    const icuDescription = convertStepsToIcuText(steps);

    const workoutDoc = {
      ...(workoutData.workout_doc || {}),
      name: workoutName,
      steps: steps,
    };

    // 2. Build complete payload for proxy backend / Intervals.icu API
    const bodyPayload = {
      action,
      ...(workoutData.id ? { id: workoutData.id } : {}),
      name: workoutName,
      description: icuDescription, // Required by Intervals.icu
      type: workoutData.type || 'Run', // Required by Intervals.icu
      folder_id: folderId,
      workout_doc: workoutDoc,
    };

    const res = await fetch(VAL_WORKOUTBUILDER_URL, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      let errorText = '';
      try {
        const errJson = await res.json();
        errorText = errJson.error || errJson.message || JSON.stringify(errJson);
      } catch {
        errorText = await res.text();
      }
      throw new Error(`Failed to save workout (${res.status}): ${errorText || 'Unknown error'}`);
    }

    const savedResult = await res.json();
    console.log('[App Debug BuilderHelpers] saveWorkoutApi succeeded:', savedResult);
    return savedResult;
  } catch (err) {
    console.error('[App Debug BuilderHelpers] saveWorkoutApi execution failed:', err);
    throw err;
  }
}


export async function fetchMyPacesApi() {
  console.log('[App Debug BuilderHelpers] fetchMyPacesApi called');
  try {
    const res = await fetch(VAL_MY_PACES_URL, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch paces`);
    return await res.json();
  } catch (err) {
    console.error('[App Debug BuilderHelpers] fetchMyPacesApi error:', err);
    throw err;
  }
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

export const convertToPaceSec = (val, paces = null) => {
  if (!val) return DEFAULT_THRESHOLD(paces);
  if (typeof val === 'string') {
    return parseMMSS(val);
  }
  if (typeof val === 'number' && val > 0) {
    if (val < 15) {
      return Math.round(1609.344 / val);
    }
    return Math.round(val);
  }
  return DEFAULT_THRESHOLD(paces);
};

export const formatDistance = (miles) => {
  return (miles || 0).toFixed(2) + ' mi';
};

// --- Preset Calculations ---

export function calculateDynamicPresets(paces, thresholdPaceSec, paceMethod) {
  if (!paces || !Array.isArray(paces.preset_colors)) {
    const DEFAULT_PACE_ZONE_NAMES  = ["Zone_1", "Zone_2", "Zone_3", "Zone_4", "Zone_5a", "Zone_5b", "Zone_5c", "Zone 6"];
    const DEFAULT_PACE_ZONE_COLORS = ["#b0b0b0", "#88d8b0", "#28a745", "#ffc107", "#fd7e14", "#ff6b6b", "#dc3545", "#6f42c1"];
    const DEFAULT_PACE_VAL_SEC     = [619, 538, 525, 495, 479, 444, 330, 293];

    return DEFAULT_PACE_ZONE_NAMES.map((name, idx) => ({
      label: name,
      displayPace: formatMMSS(DEFAULT_PACE_VAL_SEC[idx]),
      targetPaceSec: DEFAULT_PACE_VAL_SEC[idx],
      color: DEFAULT_PACE_ZONE_COLORS[idx % DEFAULT_PACE_ZONE_COLORS.length],
      colorLabel: '',
    }));
  }

  return paces.preset_colors.map((p) => {
    const label = p.zone_name || `Zone ${p.zone}`;
    const color = p.color || '#cccccc';
    const colorLabel = p.label || 'n/a';
    
    let paceSec = p.pace_val_sec;
    if (!paceSec) {
      if (p.pace_fast) {
        paceSec = parseMMSS(p.pace_fast);
      } else if (p.pace_value_num) {
        paceSec = convertToPaceSec(p.pace_value_num, paces);
      } else {
        paceSec = thresholdPaceSec;
      }
    }

    let displayPace = formatMMSS(paceSec);
    
    if (paceMethod === 'Threshold %') {
      const pct = p.pace_zone_pct || Math.round((thresholdPaceSec / paceSec) * 100);
      displayPace = `${pct}%`;
    } else if (paceMethod?.includes('Range') && p.pace_slow && p.pace_fast) {
      displayPace = `${p.pace_slow}-${p.pace_fast}`;
    } else if (paceMethod?.includes('Range')) {
      const lowPace = Math.round(paceSec * 0.97);
      const highPace = Math.round(paceSec * 1.03);
      displayPace = `${formatMMSS(lowPace)}-${formatMMSS(highPace)}`;
    }

    return {
      zone: p.zone_name,
      label,
      displayPace,
      targetPaceSec: paceSec,
      color,
      colorLabel,
      paceSlow: p.pace_slow,
      paceFast: p.pace_fast,
      pct: p.pace_zone_pct
    };
  });
}

// --- Step Creation & Mapping Helpers ---

export const createStep = (type, mode = 'time') => {
  const id = `step-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const durationSec = mode === 'time' ? 600 : 0;
  const distanceMiles = mode === 'distance' ? 3.0 : 0;

  const metric = mode === 'time' ? { duration: durationSec } : { distance: distanceMiles };

  switch (type) {
    case 'warmup':
      return {
        id,
        warmup: true,
        ...metric,
        intensity: 'warmup',
        pace: { units: 'secs', value: 621 },
      };

    case 'run':
      return {
        id,
        ...metric,
        intensity: 'active',
        pace: { units: 'secs', value: DEFAULT_THRESHOLD() },
      };

    case 'recovery':
      return {
        id,
        ...metric,
        intensity: 'recovery',
        pace: { units: 'secs', value: 622 },
      };

    case 'cooldown':
      return {
        id,
        cooldown: true,
        ...metric,
        intensity: 'active',
        pace: { units: 'secs', value: 623 },
      };

    case 'repeat':
      return {
        id,
        type: 'repeat',
        iterations: 3,
        steps: [
          {
            id: `${id}-1`,
            ...(mode === 'time' ? { duration: durationSec / 3 } : { distance: distanceMiles / 3 }),
            pace: { units: 'secs', value: 445 },
          },
          {
            id: `${id}-2`,
            ...(mode === 'time' ? { duration: durationSec / 3 } : { distance: distanceMiles / 3 }),
            pace: { units: 'secs', value: 540 },
          },
        ],
        reps: 3,
      };

    default:
      return {
        id,
        type: 'run',
        ...metric,
        intensity: 'active',
        pace: { units: 'secs', value: DEFAULT_THRESHOLD() },
      };
  }
};

export const createDefaultSteps = (mode = 'time') => {
  return [
    createStep('warmup', mode),
    createStep('repeat', mode),
    createStep('cooldown', mode),
  ];
};

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
      const { id, steps: childSteps, ...cleanStep } = step;

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

    let targetPaceSec = DEFAULT_THRESHOLD();
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
  console.log('[App Debug BuilderHelpers] downloadFile called with filename:', filename);
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

// convert step array into plain text DSL format required by intervals.icu
export function convertStepsToIcuText(steps = []) {
  const lineArray = [];

  const parseStep = (step) => {
    if (step.type === 'repeat' && Array.isArray(step.steps)) {
      const reps = step.iterations || step.reps || 1;
      lineArray.push(`${reps}x`);
      step.steps.forEach((child) => {
        const line = formatSingleStep(child);
        if (line) lineArray.push(`- ${line}`);
      });
    } else {
      const line = formatSingleStep(step);
      if (line) lineArray.push(`- ${line}`);
    }
  };

  const formatSingleStep = (s) => {
    let durationStr = '';
    if (s.durationSec) {
      const mins = Math.floor(s.durationSec / 60);
      const secs = s.durationSec % 60;
      durationStr = secs > 0 ? `${mins}m${secs}s` : `${mins}m`;
    } else if (s.distanceMiles) {
      durationStr = `${s.distanceMiles.toFixed(2)}mi`;
    } else {
      durationStr = '10m';
    }

    let intensityLabel = s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : 'Run';
    let paceStr = '';

    if (s.targetPaceSec) {
      paceStr = formatMMSS(s.targetPaceSec) + '/mi';
    } else if (s.pace?.value) {
      paceStr = formatMMSS(convertToPaceSec(s.pace.value)) + '/mi';
    }

    return `${durationStr} ${intensityLabel} ${paceStr}`.trim();
  };

  steps.forEach(parseStep);
  return lineArray.join('\n');
}