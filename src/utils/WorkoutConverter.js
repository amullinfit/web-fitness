/**
 * WorkoutConverter.js 
 */

export function convertStepsToWorkout(steps) {
  if (!steps) return null;

  return {
    category: "WORKOUT",
    updated: new Date().toISOString(),
    workout_doc: {
      steps: steps.map(({ id, ...rest }) => ({
        ...rest,
        description: "Your description here"
      })),
    },
    feedSource: "Web-Fitness"
  };
}

export function convertWorkoutToTargetFormat(workoutPayload, options = {}) {
  if (!workoutPayload) return null;

  const doc = workoutPayload.workout_doc || {};
  const processedSteps = doc.steps || [];

  return {
    id: workoutPayload.id ?? null,
    start_date_local: options.startDateLocal ?? null,
    icu_training_load: workoutPayload.icu_training_load ?? null,
    icu_atl: options.icuAtl ?? null,
    icu_ctl: options.icuCtl ?? null,
    type: workoutPayload.type ?? "Run",
    carbs_used: null,
    ss_p_max: null,
    ss_w_prime: null,
    ss_cp: null,
    calendar_id: 1,
    uid: options.uid ?? null,
    athlete_id: options.athleteId ?? null,
    category: "WORKOUT",
    end_date_local: options.endDateLocal ?? null,
    name: workoutPayload.name ?? "",
    description: workoutPayload.description ?? "",
    indoor: workoutPayload.indoor ?? null,
    color: workoutPayload.color ?? null,
    moving_time: workoutPayload.moving_time ?? null,
    icu_ftp: null,
    w_prime: null,
    p_max: null,
    atl_days: null,
    ctl_days: null,
    updated: workoutPayload.updated ?? new Date().toISOString(),
    not_on_fitness_chart: false,
    show_as_note: false,
    show_on_ctl_line: false,
    for_week: false,
    target: null,
    joules: workoutPayload.joules ?? null,
    joules_above_ftp: workoutPayload.joules_above_ftp ?? null,
    workout_doc: {
      steps: processedSteps,
      locales: doc.locales || [],
      options: doc.options || {},
      distance: doc.distance ?? workoutPayload.distance ?? 0,
      duration: doc.duration ?? workoutPayload.moving_time ?? 0,
    },
    push_errors: null,
    athlete_cannot_edit: false,
    hide_from_athlete: false,
    structure_read_only: false,
    created_by_id: options.athleteId ?? null,
    shared_event_id: null,
    entered: false,
    carbs_per_hour: null,
    sub_type: null,
    distance: workoutPayload.distance ?? null,
    tags: null,
    attachments: null,
    oauth_client_id: 173,
    external_id: null,
    load_target: null,
    time_target: null,
    distance_target: null,
    training_availability: "NORMAL",
    max_training_time: null,
    can_train_sports: null,
    plan_athlete_id: null,
    plan_folder_id: null,
    plan_workout_id: null,
    plan_applied: null,
    icu_intensity: null,
    strain_score: null,
    plan_name: null,
    paired_activity_id: null,
    feedSource: "WORKOUTS"
  };
}

// Detect Pace Method directly from step.pace schema
export const detectPaceMethod = (stepPace) => {
  if (!stepPace || typeof stepPace !== 'object') return 'Pace';

  const units = stepPace.units;
  const isRange = 'start' in stepPace || 'end' in stepPace;

  if (units === 'secs') {
    return isRange ? 'Pace Range' : 'Pace';
  } else if (units === '%pace') {
    return isRange ? 'Threshold % Range' : 'Threshold %';
  } else if (units === 'pace_zone') {
    return isRange ? 'Zone Range' : 'Zone';
  }

  return 'Pace';
};

// Helper returns pace in seconds
export function calculatePaceFromPct(thresholdPaceSec, inputPct) {
  if (!thresholdPaceSec || !inputPct || inputPct <= 0) return thresholdPaceSec;
  return Math.round(thresholdPaceSec / (inputPct / 100));
}

// Helper returns pace as % of threshold
export function calculatePctFromPace(thresholdPaceSec, inputPaceSec) {
  if (!thresholdPaceSec || !inputPaceSec || inputPaceSec <= 0) return 100;
  return Number(((thresholdPaceSec / inputPaceSec) * 100).toFixed(1));
}

// Helper to return zone identifier from pace
export function calculateZoneFromPace(zoneList, inputPaceSec) {
  const presets = Array.isArray(zoneList) ? zoneList : zoneList?.preset_colors;

  if (!Array.isArray(presets) || presets.length === 0 || !inputPaceSec) {
    return 'Z1';
  }

  for (let i = 0; i < presets.length; i++) {
    const currentZone = presets[i];
    const thresholdSec = currentZone.pace_val_sec || currentZone.targetPaceSec;
    if (thresholdSec && inputPaceSec >= thresholdSec) {
      return currentZone.name || currentZone.label || currentZone.zone || 'Z1';
    }
  }

  const highestZone = presets[presets.length - 1];
  return highestZone?.name || highestZone?.label || highestZone?.zone || 'Z1';
}

// Helper to return target pace seconds from zone identifier
export function calculatePaceFromZone(zoneList, targetZone) {
  const presets = Array.isArray(zoneList) ? zoneList : zoneList?.preset_colors;

  if (!Array.isArray(presets) || presets.length === 0 || targetZone == null) {
    return 480;
  }

  const matchedZone = presets.find(
    (item) =>
      item.name === targetZone ||
      item.label === targetZone ||
      String(item.zone) === String(targetZone) ||
      item.id === targetZone
  );

  return matchedZone?.targetPaceSec ?? matchedZone?.pace_val_sec ?? 480;
}

// Helper to convert value across pace methods
export const calculateNewPaceValue = (oldPaceMethod, oldPaceValue, newPaceMethod, threshold_spm, zoneList) => {
  let newPaceValue = oldPaceValue;

  const oldMethod = (oldPaceMethod || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/range/g, '');

  const newMethod = (newPaceMethod || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/range/g, '');

  if (oldMethod === newMethod) {
    return oldPaceValue;
  }

  const transitionKey = `${oldMethod}->${newMethod}`;

  switch (transitionKey) {
    case 'pace->zone': {
      newPaceValue = calculateZoneFromPace(zoneList, oldPaceValue);
      break;
    }
    case 'pace->threshold%': {
      newPaceValue = calculatePctFromPace(threshold_spm, oldPaceValue);
      break;
    }
    case 'zone->pace': {
      newPaceValue = calculatePaceFromZone(zoneList, oldPaceValue);
      break;
    }
    case 'zone->threshold%': {
      const paceInSec = calculatePaceFromZone(zoneList, oldPaceValue);
      newPaceValue = calculatePctFromPace(threshold_spm, paceInSec);
      break;
    }
    case 'threshold%->pace': {
      newPaceValue = calculatePaceFromPct(threshold_spm, oldPaceValue);
      break;
    }
    case 'threshold%->zone': {
      const paceInSec = calculatePaceFromPct(threshold_spm, oldPaceValue);
      newPaceValue = calculateZoneFromPace(zoneList, paceInSec);
      break;
    }
    default:
      break;
  }

  return newPaceValue;
};

export const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')}/mi`;
};

export const secondsToPaceStr = (secPerMile) => {
  if (!secPerMile || secPerMile <= 0) return "N/A";
  const roundedSec = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSec / 60);
  const secs = roundedSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}/mi`;
};

/**
 * Helper to normalize string representations like "0:00/mi" or "10:20/mi" to "MM:SS"
 */
const cleanPaceStr = (paceStr) => {
  if (!paceStr) return "";
  return paceStr.replace(/\/mi$/i, "").trim();
};

/**
 * Converts "MM:SS" pace string into total seconds.
 */
const parsePaceStrToSec = (paceStr) => {
  const cleaned = cleanPaceStr(paceStr);
  if (!cleaned || cleaned === "0:00") return 0;
  const parts = cleaned.split(":");
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

/**
 * Normalizes paces input to always return an array of zone objects.
 */
const extractZonesArray = (pacesInput) => {
  if (!pacesInput) return [];
  if (Array.isArray(pacesInput)) return pacesInput;
  if (Array.isArray(pacesInput.preset_colors)) return pacesInput.preset_colors;
  return [];
};

/**
 * Generates descriptive zone text string from a workout step and user's pace zones.
 * 
 * Rules:
 * 1. Single Zone (zone/value): Returns "SlowPace - FastPace".
 *    - If SlowPace is "0:00" or missing, it sets slow = FastPace + 2:00 (120s).
 * 2. Zone Range (start and end): Returns "FastPace (of start zone) - SlowPace (of end zone)".
 * 
 * - Should always return "FAST - SLOW" (e.g., "10:20 - 12:20" or "7:25 - 8:44")
 * 
 * @param {Object} step - Step object containing { zone, value, start, end }
 * @param {Object|Array} pacesInput - Paces object or array of preset_colors
 * @returns {string} Formatted range string (e.g., "10:20 - 12:20" or "7:25 - 8:44")
 */
export function getZoneDescriptiveText(step, pacesInput) {
  if (!step) return "";

  const zones = extractZonesArray(pacesInput);
  if (!zones.length) return "";

  // Helper to find a zone object by zone ID/number
  const findZone = (zoneNum) => zones.find((z) => Number(z.zone) === Number(zoneNum));

  const singleZoneNum = step.zone ?? step.value;
  const startZoneNum = step.start;
  const endZoneNum = step.end;

  // -------------------------------------------------------------------------
  // Case 1: Single Zone (e.g. Zone 1)
  // -------------------------------------------------------------------------
  if (singleZoneNum != null && startZoneNum == null) {
    const targetZone = findZone(singleZoneNum);
    if (!targetZone) return "";

    const fastPaceStr = cleanPaceStr(targetZone.pace_fast);
    let slowPaceStr = cleanPaceStr(targetZone.pace_slow);

    // If slow is "0:00" or empty, calculate 2:00 slower than fast pace
    if (!slowPaceStr || slowPaceStr === "0:00") {
      const fastSec = parsePaceStrToSec(fastPaceStr) || targetZone.pace_val_sec || 0;
      if (fastSec > 0) {
        slowPaceStr = formatSecPerMileToStr(fastSec + 120); // +2 mins slower
      }
    }

    return `${fastPaceStr} - ${slowPaceStr}`;
  }

  // -------------------------------------------------------------------------
  // Case 2: Zone Range (e.g. start: 4, end: 6)
  // -------------------------------------------------------------------------
  if (startZoneNum != null && endZoneNum != null) {
    // Determine fast (lower zone number) and slow (higher zone number)
    const fastZoneId = Math.min(Number(startZoneNum), Number(endZoneNum));
    const slowZoneId = Math.max(Number(startZoneNum), Number(endZoneNum));

    const fastZoneObj = findZone(fastZoneId);
    const slowZoneObj = findZone(slowZoneId);

    if (!fastZoneObj || !slowZoneObj) return "";

    // Fast end of the faster zone (e.g. fast end of Zone 4)
    const fastPaceStr = cleanPaceStr(fastZoneObj.pace_fast);

    // Slow end of the slower zone (e.g. slow end of Zone 6)
    let slowPaceStr = cleanPaceStr(slowZoneObj.pace_slow);

    if (!slowPaceStr || slowPaceStr === "0:00") {
      const slowZoneFastSec = parsePaceStrToSec(slowZoneObj.pace_fast) || slowZoneObj.pace_val_sec || 0;
      if (slowZoneFastSec > 0) {
        slowPaceStr = formatSecPerMileToStr(slowZoneFastSec + 120);
      }
    }

    return `${fastPaceStr} - ${slowPaceStr}`;
  }

  return "";
}