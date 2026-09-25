/**
 * 
 * WorkoutConverter.js 
 *
 */

export function convertStepsToWorkout(steps) {
  if (!steps) return null;

  return {
      category: "WORKOUT",
      updated: new Date().toISOString(),
      workout_doc: {
        steps: steps.map(({ id, ...rest }) => ({
          ...rest,
          description: "Your description here" // Replace with desired value or function logic
        })),
      },
      feedSource: "Web-Fitness"
  };
}

/*
 * Transforms a raw workoutPayloadObject (source array schema)
 * into the target wrapper JSON structure expected by the API/UI.
 * 
 * @param {Object} workoutPayload - The single workout payload object.
 * @param {Object} [options] - Optional custom metadata values.
 * @returns {Object} The transformed JSON structure.
 */
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

// Helper to determine Pace Method from step.pace schema
export const detectPaceMethod = (stepPace, fallbackMethod) => {
  if (!stepPace || typeof stepPace !== 'object') return fallbackMethod || 'Pace';

  const unit = stepPace.unit;
  const isRange = 'start' in stepPace || 'end' in stepPace;

  if (unit === 'secs') {
    return isRange ? 'Pace Range' : 'Pace';
  } else if (unit === '%pace') {
    return isRange ? 'Threshold % Range' : 'Threshold %';
  } else if (unit === 'pace_zone') {
    return isRange ? 'Zone Range' : 'Zone';
  }

  return fallbackMethod || 'Pace';
};

// Helper returns pace in seconds (converts 80% of 495 --> 619)
export function calculatePaceFromPct(thresholdPaceSec, inputPct) {
  if (!thresholdPaceSec || !inputPct || inputPct <= 0) return thresholdPaceSec;
  return Math.round(thresholdPaceSec / (inputPct / 100));
};

// Helper return pace as a % of threshold (converts 495, 619 --> 80)
export function calculatePctFromPace(thresholdPaceSec, inputPaceSec) {
  if (!thresholdPaceSec || !inputPaceSec || inputPaceSec <= 0) return 100;
  return Number(((thresholdPaceSec / inputPaceSec) * 100).toFixed(1));
};


// Helper to return zone # (converts 495 to 1 (aka zone 1))
export function calculateZoneFromPace(zoneList, inputPaceSec) {
  const presets = zoneList?.preset_colors;

  // Safety check for empty or invalid data
  if (!Array.isArray(presets) || presets.length === 0 || !inputPaceSec) {
    return 1;
  }

  // Iterate top-to-bottom through zones (620s down to 295s)
  for (let i = 0; i < presets.length; i++) {
    const currentZone = presets[i];

    // If target pace is slower than or equal to the zone threshold, it falls into this zone
    if (inputPaceSec >= currentZone.pace_val_sec) {
      return currentZone.zone;
    }
  }

  // Fallback for extreme efforts faster than the highest zone (e.g. < 295s)
  const highestZone = presets[presets.length - 1];
  return highestZone.zone;
}

// Helper to return pace from zone (1 (aka Zone 1) -> 495)
export function calculatePaceFromZone(zoneList, targetZoneNumber) {
  const presets = zoneList?.preset_colors;

  // Safety check for empty data or missing target
  if (!Array.isArray(presets) || presets.length === 0 || targetZoneNumber == null) {
    return null;
  }

  // Convert input to Number to guarantee accurate comparison
  const searchZoneNum = Number(targetZoneNumber);

  // Find exact zone matching the numeric "zone" property
  const matchedZone = presets.find((item) => Number(item.zone) === searchZoneNum);

  if (!matchedZone) {
    return null; // Zone number not found
  }

  return matchedZone.pace_val_sec;
}

// Helper to convert value for paces
// threshold_spm as sec/mi (ie, 495 for a 8:15 pace)
export const calculateNewPaceValue = (oldPaceMethod, oldPaceValue, newPaceMethod, threshold_spm, zoneList) => {
  let newPaceValue = 0;

  const oldMethod = (oldPaceMethod || '')
  .toLowerCase()
  .replace(/\s+/g, '')       // Removes all whitespace (spaces, tabs, etc.)
  .replace(/range/g, '');    // Removes all instances of "range"

  const newMethod = (newPaceMethod || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/range/g, '');
    
  if (oldMethod === newMethod) {
    newPaceValue = OldPaceValue;
  }

  const transitionKey = `${oldMethod}->${newMethod}`;
  
  switch (transitionKey) {
    case 'pace->zone': {
      // from 495 to Z4
      newPaceValue = calculateZoneFromPace(zoneList, oldPaceValue);
      break;
    }

    case 'pace->threshold%': {
      // from 495 to 100%
      newPaceValue = calculatePctFromPace(threshold_spm, oldPaceValue);
      break;
    }
  
    case 'zone->pace': {
      // from Z4 to 495
      newPaceValue = calculatePaceFromZone(zoneList, oldPaceValue);
      break;}
  
    case 'zone->threshold%': {
      // from Z4 to 100%
      newPaceValue = calculatePctFromPace(threshold_spm, calculatePaceFromZone(zonelist, oldPaceValue));
      break;}
  
    case 'threshold%->pace': {
      // from 100% to 495
      newPaceValue = calculatePaceFromPct(threshold_spm, oldPaceValue);
      break;}
  
    case 'threshold%->zone': {
      // from 100% to Z4
      newPaceValue = calculateZoneFromPace(zonelist, calculatePaceFromPct(threshold_spm, oldPaceValue));
      break;}
  
    default:
      break;
  }

  return newPaceValue;
};

// 3.2512 -> "8:15/mi"
export const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
};

// Helper to convert seconds per mile directly to mm:ss string
export const secondsToPaceStr = (secPerMile) => {
  if (!secPerMile || secPerMile <= 0) return "N/A";
  const roundedSec = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSec / 60);
  const secs = roundedSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
};

