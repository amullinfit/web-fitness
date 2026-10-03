/**
 * WorkoutConverter.js 
 */

export function convertStepsToWorkout(steps) {
  console.log('[App Debug Converter] convertStepsToWorkout called with steps:', steps);
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
  console.log('[App Debug Converter] convertWorkoutToTargetFormat called with workoutPayload:', workoutPayload, 'options:', options);
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

/**
 * Detects paceMethod string from a step's `pace` object schema.
 */
export function detectPaceMethod(pace) {
  console.log('[App Debug Converter] detectPaceMethod called with pace:', pace);
  if (!pace || typeof pace !== 'object') return 'Pace';
  const isRange = pace.start !== undefined || pace.end !== undefined;

  switch (pace.units) {
    case '%pace':
      return isRange ? 'Threshold % Range' : 'Threshold %';
    case 'pace_zone':
      return isRange ? 'Zone Range' : 'Zone';
    case 'secs':
    default:
      return isRange ? 'Pace Range' : 'Pace';
  }
}

/**
 * Calculates % of threshold from a given pace in seconds.
 * Higher % = Faster running (fewer sec/mi).
 */
export function calculatePctFromPace(paceSec, thresholdSec) {
  console.log('[App Debug Converter] calculatePctFromPace called with paceSec:', paceSec, 'thresholdSec:', thresholdSec);
  if (!paceSec || !thresholdSec || paceSec <= 0) return 100;
  return Math.round((thresholdSec / paceSec) * 100);
}

/**
 * Calculates pace in seconds from a % of threshold.
 */
export function calculatePaceFromPct(pct, thresholdSec) {
  console.log('[App Debug Converter] calculatePaceFromPct called with pct:', pct, 'thresholdSec:', thresholdSec);
  if (!pct || !thresholdSec || pct <= 0) return thresholdSec || 480;
  return Math.round(thresholdSec / (pct / 100));
}

/**
 * Finds the matching zone identifier in zoneList for a given pace in seconds.
 */
export function calculateZoneFromPace(zoneList = [], paceSec) {
  console.log('[App Debug Converter] calculateZoneFromPace called with zoneList count:', zoneList?.length, 'paceSec:', paceSec);
  if (!Array.isArray(zoneList) || zoneList.length === 0 || paceSec == null) {
    return 1;
  }

  for (const z of zoneList) {
    const fastSec = parsePaceStrToSec(z.pace_fast);
    const slowSec = parsePaceStrToSec(z.pace_slow);

    // Zone 1 check: handles 0:00/mi slow pace (any pace >= fastSec, i.e., 620s or slower)
    if (slowSec === 0) {
      if (paceSec >= fastSec) return z.zone;
    } else if (slowSec >= paceSec && paceSec >= fastSec) {
      return z.zone;
    }
  }

  // Fallback for extremely fast paces faster than the highest zone (e.g., < 295)
  return zoneList[zoneList.length - 1]?.zone ?? 1;
}

/**
 * Resolves fastest pace in seconds for a matched zone in zoneList.
 */
export function calculatePaceFromZone(zoneList = [], zoneIdentifier) {
  console.log('[App Debug Converter] calculatePaceFromZone called with zoneIdentifier:', zoneIdentifier);
  if (zoneIdentifier == null || !Array.isArray(zoneList) || zoneList.length === 0) {
    return 480;
  }

  // Direct numeric comparison using the numeric zone ID
  const matched = zoneList.find((z) => z.zone === zoneIdentifier);

  return matched?.pace_val_sec ?? 480;
}

/**
 * Converts a step's `pace` payload when changing paceMethod.
 * Supports ranges (fast & slow) across all 3 unit types (%pace, pace_zone, secs).
 */
export function convertStepPaceTarget(currentPace,
                                      newPaceMethod, 
                                      thresholdSec = 480, 
                                      zoneList = []) 
  {
    console.log('[App Debug Converter] convertStepPaceTarget called', { currentPace, newPaceMethod, thresholdSec });
    const defaultThresholdSec = thresholdSec > 0 ? thresholdSec : 480;

    // Step 1: Normalize existing pace object into fastSec and slowSec
    let fastSec = defaultThresholdSec;
    let slowSec = defaultThresholdSec;

    if (typeof currentPace === 'object' && currentPace !== null) {
      const isCurrentRange = currentPace.start !== undefined || currentPace.end !== undefined;

      if (currentPace.units === '%pace') {
        if (!isCurrentRange) {
          fastSec = calculatePaceFromPct(currentPace.value ?? 100, defaultThresholdSec);
          slowSec = fastSec;
        } else {
          const startPct = currentPace.start ?? 100;
          const endPct = currentPace.end ?? 100;
          // Higher % = FASTER pace (fewer sec/mi)
          const fastPct = Math.max(startPct, endPct);
          const slowPct = Math.min(startPct, endPct);
          fastSec = calculatePaceFromPct(fastPct, defaultThresholdSec);
          slowSec = calculatePaceFromPct(slowPct, defaultThresholdSec);
        }
      } else if (currentPace.units === 'pace_zone') {
        if (!isCurrentRange) {
          fastSec = calculatePaceFromZone(currentPace.value, zoneList);
          slowSec = fastSec;
        } else {
          fastSec = calculatePaceFromZone(currentPace.start, zoneList);
          slowSec = calculatePaceFromZone(currentPace.end, zoneList);
        }
      } else {
        // units === 'secs' or missing
        if (!isCurrentRange) {
          fastSec = currentPace.value ?? defaultThresholdSec;
          slowSec = fastSec;
        } else {
          const p1 = currentPace.start ?? defaultThresholdSec;
          const p2 = currentPace.end ?? defaultThresholdSec + 15;
          fastSec = Math.min(p1, p2);
          slowSec = Math.max(p1, p2);
        }
      }
    } else if (typeof currentPace === 'number') {
      fastSec = currentPace;
      slowSec = currentPace;
    }

    // Step 2: Convert normalized seconds to requested target shape
    const defaultZoneVal = String(zoneList[0]?.zone ?? zoneList[0]?.id ?? '1');

    switch (newPaceMethod) {
      case 'Pace':
        return { units: 'secs', value: fastSec };

      case 'Pace Range':
        return { units: 'secs', start: fastSec, end: slowSec };

      case 'Threshold %':
        return {
          units: '%pace',
          value: calculatePctFromPace(fastSec, defaultThresholdSec),
        };

      case 'Threshold % Range': {
        // start = lower % (slower pace), end = higher % (faster pace)
        const slowPct = calculatePctFromPace(slowSec, defaultThresholdSec);
        const fastPct = calculatePctFromPace(fastSec, defaultThresholdSec);
        return {
          units: '%pace',
          start: Math.min(slowPct, fastPct),
          end: Math.max(slowPct, fastPct),
        };
      }

      case 'Zone':
        return {
          units: 'pace_zone',
          value: calculateZoneFromPace(fastSec, zoneList) || defaultZoneVal,
        };

      case 'Zone Range':
        return {
          units: 'pace_zone',
          start: calculateZoneFromPace(fastSec, zoneList) || defaultZoneVal,
          end: calculateZoneFromPace(slowSec, zoneList) || defaultZoneVal,
        };

      default:
        return { units: 'secs', value: fastSec };
    }
  }

// Helper to convert value across pace methods
export const calculateNewPaceValue = (oldPaceMethod, oldPaceValue, newPaceMethod, threshold_spm, zoneList) => {
  console.log('[App Debug Converter] calculateNewPaceValue called', { oldPaceMethod, oldPaceValue, newPaceMethod, threshold_spm });
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
  console.log('[App Debug Converter] metersPerSecondToPaceStr called with mps:', mps);
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')}/mi`;
};

export const secondsToPaceStr = (secPerMile) => {
  console.log('[App Debug Converter] secondsToPaceStr called with secPerMile:', secPerMile);
  if (!secPerMile || secPerMile <= 0) return "N/A";
  const roundedSec = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSec / 60);
  const secs = roundedSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}/mi`;
};

/**
 * Helper to normalize string representations like "0:00/mi" or "10:20/mi" to "mm:ss"
 */
const cleanPaceStr = (paceStr) => {
  console.log('[App Debug Converter] cleanPaceStr called with paceStr:', paceStr);
  if (!paceStr) return "";
  return paceStr.replace(/\/mi$/i, "").trim();
};

/**
 * Converts "MM:SS" pace string into total seconds.
 */
const parsePaceStrToSec = (paceStr) => {
  console.log('[App Debug Converter] parsePaceStrToSec called with paceStr:', paceStr);
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
  console.log('[App Debug Converter] extractZonesArray called');
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
  console.log('[App Debug Converter] getZoneDescriptiveText called with step:', step);
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