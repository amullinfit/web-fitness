/**
 * WorkoutConverter.js 
 */

import {
  formatSecPerMileToStr
} from './WorkoutChartHelpers.js'

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
  if (!paceSec || !thresholdSec || paceSec <= 0) return 100;
  return Math.round((thresholdSec / paceSec) * 100);
}

/**
 * Calculates pace in seconds from a % of threshold.
 */
export function calculatePaceFromPct(pct, thresholdSec) {
  if (!pct || !thresholdSec || pct <= 0) return thresholdSec || 480;
  return Math.round(thresholdSec / (pct / 100));
}

/**
 * Finds the matching zone identifier in zoneList for a given pace in seconds.
 */
export function calculateZoneFromPace(zoneList = [], paceSec) {
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
 * Helper to normalize string representations like "0:00/mi" or "10:20/mi" to "mm:ss"
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
 * Resolves and sorts fast/slow zone objects from start/end zone identifiers.
 * Higher zone number = Faster pace (fastZoneObj)
 * Lower zone number = Slower pace (slowZoneObj)
 *
 * @param {number|string|null} startZone - Start zone number
 * @param {number|string|null} endZone - End zone number
 * @param {Function} findZoneFn - Function to look up a zone object by its zone number
 * @returns {{ fastZoneObj: Object|null, slowZoneObj: Object|null }}
 */
function getSortedZoneObjs(startZone, endZone, findZoneFn) {
  const startNum = startZone != null ? Number(startZone) : null;
  const endNum = endZone != null ? Number(endZone) : null;

  if (startNum == null && endNum == null) {
    return { fastZoneObj: null, slowZoneObj: null };
  }

  let fastZoneNum, slowZoneNum;

  if (startNum != null && endNum != null) {
    fastZoneNum = Math.max(startNum, endNum); // Higher zone ID = faster pace
    slowZoneNum = Math.min(startNum, endNum); // Lower zone ID = slower pace
  } else {
    fastZoneNum = startNum ?? endNum;
    slowZoneNum = startNum ?? endNum;
  }

  return {
    fastZoneObj: findZoneFn(fastZoneNum) || null,
    slowZoneObj: findZoneFn(slowZoneNum) || null,
  };
}

/**
 * Generates descriptive zone text string from a workout step and user's pace zones.
 *
 * Handles units:
 * - "secs": Absolute pace in seconds
 * - "%pace": Percentage of threshold pace (100% threshold zone)
 * - "pace_zone" (or step object with zone/start/end): Numeric zone lookup
 *
 * @param {Object} step - Step object (or step.pace sub-object)
 * @param {Object|Array} pacesInput - Paces object or array of preset_colors
 * @returns {string} Formatted range or single pace string (e.g., "7:25 - 8:44" or "8:15")
 */
export function getDescriptiveText(step, pacesInput) {
  if (!step) return "";

  // Support passing either the outer step object or the step.pace sub-object
  const targetPace = step.pace || step;
  const { units, value, start, end, zone } = targetPace;

  const zones = extractZonesArray(pacesInput);

  // Helper to standardise range output as "FAST_PACE - SLOW_PACE"
  const formatOutputRange = (secA, secB) => {
    if (!secA && !secB) return "";
    if (secA && !secB) return formatSecPerMileToStr(secA);
    if (!secA && secB) return formatSecPerMileToStr(secB);

    if (secA === secB) return formatSecPerMileToStr(secA);

    const fastSec = Math.min(secA, secB);
    const slowSec = Math.max(secA, secB);
    return `${formatSecPerMileToStr(fastSec)} - ${formatSecPerMileToStr(slowSec)}`;
  };

  // -------------------------------------------------------------------------
  // 1. Handling %pace (Percentage of Threshold)
  // -------------------------------------------------------------------------
  if (units === "%pace") {
    // 1. Resolve threshold seconds from pacesInput root properties
    let thresholdSec = 0;

    thresholdSec = pacesInput.run_pace_sec;

    if (!thresholdSec) return "ee:ee";

    // Convert percentage effort to pace time in seconds (Pace = Threshold / %Effort)
    const calcPaceFromPct = (pct) => (pct > 0 ? thresholdSec / (pct / 100) : 0);

    const singlePct = value != null ? value : (start == null && end == null ? zone : null);
    if (singlePct != null) {
      return formatSecPerMileToStr(calcPaceFromPct(Number(singlePct)));
    }

    if (start != null || end != null) {
      const secStart = start != null ? calcPaceFromPct(Number(start)) : null;
      const secEnd = end != null ? calcPaceFromPct(Number(end)) : null;
      return formatOutputRange(secStart, secEnd);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Handling Seconds ("secs")
  // -------------------------------------------------------------------------
  if (units === "secs") {
    if (value != null) {
      return formatSecPerMileToStr(Number(value));
    }
    if (start != null || end != null) {
      return formatOutputRange(Number(start), Number(end));
    }
  }

  // -------------------------------------------------------------------------
  // 3. Handling Zone Lookup ("pace_zone" or default zone numbers)
  // -------------------------------------------------------------------------
  if (!zones.length) return "";

  const findZone = (zNum) => zones.find((z) => Number(z.zone) === Number(zNum));

  const singleZoneNum = value;
  const startZoneNum = start;
  const endZoneNum = end;

  // Single Zone target
  if (singleZoneNum != null) {
    const targetZone = findZone(singleZoneNum);
    if (!targetZone) return "";

    let fastSec = parsePaceStrToSec(targetZone.pace_fast) || targetZone.pace_val_sec || 0;
    let slowSec = parsePaceStrToSec(targetZone.pace_slow);

    if (!slowSec) {
      slowSec = fastSec ? fastSec + 120 : 0; // +2 mins fallback if slow pace is missing/0:00
    }

    return formatOutputRange(fastSec, slowSec);
  }

  // Zone Range target (e.g. Zone 4 to Zone 6)
  if (startZoneNum != null || endZoneNum != null) {
    // Inside getDescriptiveText():
    const { fastZoneObj, slowZoneObj } = getSortedZoneObjs(startZoneNum, endZoneNum, findZone);

    const fastSec = fastZoneObj ? parsePaceStrToSec(fastZoneObj.pace_fast): null;
    
    const slowSec = slowZoneObj ? parsePaceStrToSec(fastZoneObj.pace_slow): null;

    return formatOutputRange(fastSec, slowSec);
  }

  return "";
}