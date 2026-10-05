import React from 'react';

// Module-level fallback constant for threshold in sec/mi
export const FALLBACK_THRESHOLD = 540;

// API endpoints
const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';
const VAL_MY_PACES_URL = '/api/val-my-paces';

export const DEFAULT_THRESHOLD = (paces) => {
  return paces?.threshold_pace || FALLBACK_THRESHOLD;
};

/* =========================================================
   API FUNCTIONS
   ========================================================= */

export async function fetchFoldersApi() {
  console.log('[Save Flow] [Folders 1/3] fetchFoldersApi called');

  try {
    const endpoint = `${VAL_WORKOUTBUILDER_URL}?action=get_folders`;

    console.log('[Save Flow] [Folders 2/3] GET:', endpoint);

    const res = await fetch(endpoint, {
      method: 'GET',
    });

    console.log(
      '[Save Flow] [Folders 3/3] Response:',
      res.status,
      res.statusText
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch folders`);
    }

    const data = await res.json();

    console.log(
      '[Save Flow] [Folders] Parsed response:',
      data
    );

    return Array.isArray(data) ? data : (data?.folders || []);
  } catch (err) {
    console.error(
      '[Save Flow] [Folders ERROR]',
      err
    );

    throw err;
  }
}


export async function fetchWorkoutsApi(folderId = null) {
  console.log(
    '[Save Flow] [Workouts 1/4] fetchWorkoutsApi called',
    { folderId }
  );

  try {
    const url = folderId
      ? `${VAL_WORKOUTBUILDER_URL}?action=get_workouts&folder_id=${encodeURIComponent(folderId)}`
      : `${VAL_WORKOUTBUILDER_URL}?action=get_workouts`;

    console.log(
      '[Save Flow] [Workouts 2/4] GET:',
      url
    );

    const res = await fetch(url, {
      method: 'GET',
    });

    console.log(
      '[Save Flow] [Workouts 3/4] Response:',
      res.status,
      res.statusText
    );

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: Failed to fetch workouts`
      );
    }

    const data = await res.json();

    console.log(
      '[Save Flow] [Workouts 4/4] Parsed response:',
      data
    );

    const folders = Array.isArray(data?.folders)
      ? data.folders
      : [];

    const workouts = folders.flatMap((folder) =>
      Array.isArray(folder.children)
        ? folder.children.map((workout) => ({
            ...workout,
            folderId:
              workout.folder_id ??
              folder.id,
          }))
        : []
    );

    console.log(
      '[Save Flow] [Workouts] Normalized workout count:',
      workouts.length
    );

    return {
      folders,
      workouts,
    };
  } catch (err) {
    console.error(
      '[Save Flow] [Workouts ERROR]',
      err
    );

    throw err;
  }
}


export async function createFolderApi(folderName) {
  console.log(
    '[Save Flow] [Folder Create 1/4] createFolderApi:',
    folderName
  );

  try {
    const body = {
      action: 'create_folder',
      name: folderName,
      type: 'FOLDER',
    };

    console.log(
      '[Save Flow] [Folder Create 2/4] Request body:',
      body
    );

    const res = await fetch(
      VAL_WORKOUTBUILDER_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    console.log(
      '[Save Flow] [Folder Create 3/4] Response:',
      res.status,
      res.statusText
    );

    if (!res.ok) {
      let errorDetails = '';

      try {
        const errJson = await res.json();

        errorDetails =
          errJson?.error ||
          errJson?.message ||
          errJson?.details ||
          JSON.stringify(errJson);
      } catch {
        errorDetails = await res.text();
      }

      throw new Error(
        `Server status ${res.status}: ${errorDetails}`
      );
    }

    const data = await res.json();

    console.log(
      '[Save Flow] [Folder Create 4/4] Created folder:',
      data
    );

    return data;
  } catch (err) {
    console.error(
      '[Save Flow] [Folder Create ERROR]',
      err
    );

    throw err;
  }
}


/* =========================================================
   SAVE WORKOUT API
   ========================================================= */

/**
 * Saves a workout through /api/val-workoutbuilder.
 *
 * IMPORTANT:
 * The canonical workout structure is:
 *
 * {
 *   id,
 *   name,
 *   folder_id,
 *   workout_doc: {
 *     steps: [...]
 *   }
 * }
 *
 * isNew=true forces a CREATE operation.
 */
export async function saveWorkoutApi(payload, isNew = false) {
  console.log(
    '=================================================='
  );

  console.log(
    '[Save Flow] [1/8] saveWorkoutApi ENTERED'
  );

  console.log(
    '[Save Flow] [1/8] isNew:',
    isNew
  );

  console.log(
    '[Save Flow] [1/8] Raw payload received:',
    payload
  );


  /* -----------------------------------------------------
     STEP 2 — Validate incoming payload
     ----------------------------------------------------- */

  if (!payload || typeof payload !== 'object') {
    console.error(
      '[Save Flow] [2/8] INVALID PAYLOAD:',
      payload
    );

    throw new Error(
      'Cannot save workout: payload is missing or invalid.'
    );
  }

  let workoutData;

  try {
    /*
     * Deep clone so we don't accidentally mutate React state.
     */
    workoutData = JSON.parse(
      JSON.stringify(payload)
    );
  } catch (err) {
    console.error(
      '[Save Flow] [2/8] Failed to clone payload:',
      err
    );

    throw new Error(
      'Cannot save workout: payload could not be serialized.'
    );
  }

  console.log(
    '[Save Flow] [2/8] Cloned workout payload:',
    workoutData
  );


  /* -----------------------------------------------------
     STEP 3 — Determine CREATE vs UPDATE
     ----------------------------------------------------- */

  if (isNew) {
    console.log(
      '[Save Flow] [3/8] Save As New requested — removing existing IDs.'
    );

    delete workoutData.id;
    delete workoutData._id;
  }

  const action = workoutData.id
    ? 'update_workout'
    : 'create_workout';

  const method = workoutData.id
    ? 'PUT'
    : 'POST';

  console.log(
    '[Save Flow] [3/8] Operation determined:',
    {
      action,
      method,
      id: workoutData.id ?? null,
      isNew,
    }
  );


  /* -----------------------------------------------------
     STEP 4 — Normalize folder ID
     ----------------------------------------------------- */

  let folderId =
    workoutData.saveFolderId ??
    workoutData.folderId ??
    workoutData.folder_id ??
    null;

  if (
    folderId === '' ||
    folderId === 'root' ||
    folderId === undefined
  ) {
    folderId = null;
  } else if (
    typeof folderId === 'string' &&
    /^\d+$/.test(folderId.trim())
  ) {
    folderId = Number(folderId);
  }

  console.log(
    '[Save Flow] [4/8] Normalized folder ID:',
    folderId
  );


  /* -----------------------------------------------------
     STEP 5 — Extract workout name and steps
     ----------------------------------------------------- */

  const workoutName =
    workoutData.name ||
    workoutData.title ||
    workoutData.workout_doc?.name ||
    'Untitled Workout';

  const steps =
    workoutData.workout_doc?.steps ||
    workoutData.steps ||
    [];

  if (!Array.isArray(steps)) {
    console.error(
      '[Save Flow] [5/8] INVALID STEPS:',
      steps
    );

    throw new Error(
      'Cannot save workout: workout steps are not an array.'
    );
  }

  console.log(
    '[Save Flow] [5/8] Workout content extracted:',
    {
      workoutName,
      stepCount: steps.length,
      steps,
    }
  );


  /* -----------------------------------------------------
     STEP 6 — Generate Intervals.icu description
     ----------------------------------------------------- */

  const icuDescription =
    convertStepsToIcuText(steps);

  console.log(
    '[Save Flow] [6/8] Generated Intervals.icu description:',
    icuDescription
  );


  /*
   * Preserve the workout_doc structure.
   *
   * This is important because the frontend works with:
   *
   * baseWorkout.workout_doc.steps
   */
  const workoutDoc = {
    ...(workoutData.workout_doc || {}),
    name: workoutName,
    steps,
  };

  /*
   * This is the actual request body sent to the
   * /api/val-workoutbuilder proxy.
   */
  const bodyPayload = {
    action,

    ...(workoutData.id
      ? { id: workoutData.id }
      : {}),

    name: workoutName,

    /*
     * The description is generated from the actual steps.
     * This is what Intervals.icu expects.
     */
    description: icuDescription,

    type:
      workoutData.type ||
      'Run',

    folder_id: folderId,

    workout_doc: workoutDoc,
  };

  console.log(
    '[Save Flow] [6/8] FINAL BACKEND PAYLOAD:',
    bodyPayload
  );

  console.log(
    '[Save Flow] [6/8] FINAL BACKEND PAYLOAD JSON:',
    JSON.stringify(bodyPayload, null, 2)
  );


  /* -----------------------------------------------------
     STEP 7 — Send HTTP request
     ----------------------------------------------------- */

  console.log(
    '[Save Flow] [7/8] Sending request:',
    {
      endpoint: VAL_WORKOUTBUILDER_URL,
      method,
      action,
      id: workoutData.id ?? null,
    }
  );

  let res;

  try {
    res = await fetch(
      VAL_WORKOUTBUILDER_URL,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      }
    );
  } catch (networkError) {
    console.error(
      '[Save Flow] [7/8] NETWORK ERROR:',
      networkError
    );

    throw networkError;
  }

  console.log(
    '[Save Flow] [7/8] HTTP response:',
    {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
    }
  );


  /* -----------------------------------------------------
     STEP 8 — Read and validate response
     ----------------------------------------------------- */

  let responseText = '';

  try {
    responseText = await res.text();
  } catch (readError) {
    console.error(
      '[Save Flow] [8/8] Failed reading response body:',
      readError
    );

    throw new Error(
      'Save request completed but the server response could not be read.'
    );
  }

  console.log(
    '[Save Flow] [8/8] RAW RESPONSE BODY:',
    responseText
  );


  let savedResult = null;

  if (responseText) {
    try {
      savedResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        '[Save Flow] [8/8] Response was not valid JSON:',
        parseError
      );

      if (!res.ok) {
        throw new Error(
          `Save failed (${res.status} ${res.statusText}): ${responseText}`
        );
      }

      /*
       * HTTP 200 but non-JSON response.
       *
       * Do NOT silently call this a successful save.
       */
      throw new Error(
        `Save returned HTTP ${res.status}, but the server did not return valid JSON.`
      );
    }
  }


  console.log(
    '[Save Flow] [8/8] PARSED RESPONSE:',
    savedResult
  );


  /*
   * HTTP-level validation.
   */
  if (!res.ok) {
    const errorMessage =
      savedResult?.error ||
      savedResult?.message ||
      savedResult?.details ||
      `HTTP ${res.status} ${res.statusText}`;

    console.error(
      '[Save Flow] [8/8] HTTP SAVE FAILURE:',
      errorMessage
    );

    throw new Error(
      `Failed to save workout: ${errorMessage}`
    );
  }


  /*
   * Application-level validation.
   *
   * Some APIs return HTTP 200 even when the operation failed.
   */
  if (
    savedResult?.success === false ||
    savedResult?.saved === false ||
    savedResult?.ok === false ||
    savedResult?.error
  ) {
    const errorMessage =
      savedResult?.error ||
      savedResult?.message ||
      savedResult?.details ||
      'The backend reported that the workout was not saved.';

    console.error(
      '[Save Flow] [8/8] BACKEND REPORTED SAVE FAILURE:',
      savedResult
    );

    throw new Error(
      errorMessage
    );
  }


  /*
   * Try to identify the saved workout ID.
   */
  const returnedId =
    savedResult?.id ??
    savedResult?.workout_id ??
    savedResult?.workout?.id ??
    savedResult?.data?.id ??
    savedResult?.data?.workout_id ??
    null;


  console.log(
    '[Save Flow] [8/8] Returned workout ID:',
    returnedId
  );


  /*
   * This is an important diagnostic.
   *
   * An update should normally return some indication of which
   * workout was updated. A create should normally return the
   * newly-created workout ID.
   */
  if (!returnedId && !workoutData.id) {
    console.warn(
      '[Save Flow] [8/8] WARNING: HTTP request succeeded, but no workout ID was returned.',
      savedResult
    );
  }


  console.log(
    '[Save Flow] [8/8] SAVE REQUEST COMPLETED SUCCESSFULLY:',
    savedResult
  );

  console.log(
    '=================================================='
  );

  return savedResult;
}


/* =========================================================
   PACES API
   ========================================================= */

export async function fetchMyPacesApi() {
  console.log(
    '[App Debug BuilderHelpers] fetchMyPacesApi called'
  );

  try {
    const res = await fetch(
      VAL_MY_PACES_URL,
      {
        method: 'GET',
      }
    );

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: Failed to fetch paces`
      );
    }

    return await res.json();
  } catch (err) {
    console.error(
      '[App Debug BuilderHelpers] fetchMyPacesApi error:',
      err
    );

    throw err;
  }
}


/* =========================================================
   FORMATTING / PARSING HELPERS
   ========================================================= */

export const formatTime = (totalSeconds) => {
  const sec = Math.max(
    0,
    Math.round(totalSeconds || 0)
  );

  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor(
    (sec % 3600) / 60
  );
  const secs = sec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(
      2,
      '0'
    )}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(mins).padStart(
    2,
    '0'
  )}:${String(secs).padStart(2, '0')}`;
};


export const formatMMSS = (totalSeconds) => {
  const sec = Math.max(
    0,
    Math.round(totalSeconds || 0)
  );

  const mins = Math.floor(sec / 60);
  const secs = sec % 60;

  return `${String(mins).padStart(
    2,
    '0'
  )}:${String(secs).padStart(2, '0')}`;
};


export const parseMMSS = (str) => {
  if (!str) return 0;

  let cleanStr = String(str)
    .trim()
    .replace(/\/mi|\/km/g, '');

  if (cleanStr.includes(':')) {
    const parts = cleanStr.split(':');

    if (parts.length === 3) {
      return (
        (parseInt(parts[0], 10) || 0) * 3600 +
        (parseInt(parts[1], 10) || 0) * 60 +
        (parseInt(parts[2], 10) || 0)
      );
    }

    return (
      (parseInt(parts[0], 10) || 0) * 60 +
      (parseInt(parts[1], 10) || 0)
    );
  }

  const num = parseInt(
    cleanStr,
    10
  );

  if (isNaN(num)) return 0;

  if (num < 100) {
    return num * 60;
  }

  const mins = Math.floor(num / 100);
  const secs = num % 100;

  return mins * 60 + Math.min(secs, 59);
};


export const convertToPaceSec = (
  val,
  paces = null
) => {
  if (!val) {
    return DEFAULT_THRESHOLD(paces);
  }

  if (typeof val === 'string') {
    return parseMMSS(val);
  }

  if (
    typeof val === 'number' &&
    val > 0
  ) {
    if (val < 15) {
      return Math.round(
        1609.344 / val
      );
    }

    return Math.round(val);
  }

  return DEFAULT_THRESHOLD(paces);
};


export const formatDistance = (miles) => {
  return (
    (miles || 0).toFixed(2) +
    ' mi'
  );
};


/* =========================================================
   PRESET CALCULATIONS
   ========================================================= */

export function calculateDynamicPresets(
  paces,
  thresholdPaceSec,
  paceMethod
) {
  if (
    !paces ||
    !Array.isArray(paces.preset_colors)
  ) {
    const DEFAULT_PACE_ZONE_NAMES = [
      'Zone_1',
      'Zone_2',
      'Zone_3',
      'Zone_4',
      'Zone_5a',
      'Zone_5b',
      'Zone_5c',
      'Zone 6',
    ];

    const DEFAULT_PACE_ZONE_COLORS = [
      '#b0b0b0',
      '#88d8b0',
      '#28a745',
      '#ffc107',
      '#fd7e14',
      '#ff6b6b',
      '#dc3545',
      '#6f42c1',
    ];

    const DEFAULT_PACE_VAL_SEC = [
      619,
      538,
      525,
      495,
      479,
      444,
      330,
      293,
    ];

    return DEFAULT_PACE_ZONE_NAMES.map(
      (name, idx) => ({
        label: name,
        displayPace: formatMMSS(
          DEFAULT_PACE_VAL_SEC[idx]
        ),
        targetPaceSec:
          DEFAULT_PACE_VAL_SEC[idx],
        color:
          DEFAULT_PACE_ZONE_COLORS[
            idx %
              DEFAULT_PACE_ZONE_COLORS.length
          ],
        colorLabel: '',
      })
    );
  }

  return paces.preset_colors.map((p) => {
    const label =
      p.zone_name ||
      `Zone ${p.zone}`;

    const color =
      p.color ||
      '#cccccc';

    const colorLabel =
      p.label ||
      'n/a';

    let paceSec =
      p.pace_val_sec;

    if (!paceSec) {
      if (p.pace_fast) {
        paceSec =
          parseMMSS(
            p.pace_fast
          );
      } else if (
        p.pace_value_num
      ) {
        paceSec =
          convertToPaceSec(
            p.pace_value_num,
            paces
          );
      } else {
        paceSec =
          thresholdPaceSec;
      }
    }

    let displayPace =
      formatMMSS(paceSec);

    if (
      paceMethod ===
      'Threshold %'
    ) {
      const pct =
        p.pace_zone_pct ||
        Math.round(
          (thresholdPaceSec /
            paceSec) *
            100
        );

      displayPace =
        `${pct}%`;
    } else if (
      paceMethod?.includes(
        'Range'
      ) &&
      p.pace_slow &&
      p.pace_fast
    ) {
      displayPace =
        `${p.pace_slow}-${p.pace_fast}`;
    } else if (
      paceMethod?.includes(
        'Range'
      )
    ) {
      const lowPace =
        Math.round(
          paceSec * 0.97
        );

      const highPace =
        Math.round(
          paceSec * 1.03
        );

      displayPace =
        `${formatMMSS(
          lowPace
        )}-${formatMMSS(
          highPace
        )}`;
    }

    return {
      zone: p.zone_name,
      label,
      displayPace,
      targetPaceSec:
        paceSec,
      color,
      colorLabel,
      paceSlow:
        p.pace_slow,
      paceFast:
        p.pace_fast,
      pct:
        p.pace_zone_pct,
    };
  });
}


/* =========================================================
   STEP CREATION
   ========================================================= */

export const createStep = (
  type,
  mode = 'time'
) => {
  const id =
    `step-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 4)}`;

  const durationSec =
    mode === 'time'
      ? 600
      : 0;

  const distanceMiles =
    mode === 'distance'
      ? 3.0
      : 0;

  const metric =
    mode === 'time'
      ? { duration: durationSec }
      : { distance: distanceMiles };

  switch (type) {
    case 'warmup':
      return {
        id,
        warmup: true,
        ...metric,
        intensity: 'warmup',
        pace: {
          units: 'secs',
          value: 621,
        },
      };

    case 'run':
      return {
        id,
        ...metric,
        intensity: 'active',
        pace: {
          units: 'secs',
          value:
            DEFAULT_THRESHOLD(),
        },
      };

    case 'recovery':
      return {
        id,
        ...metric,
        intensity: 'recovery',
        pace: {
          units: 'secs',
          value: 622,
        },
      };

    case 'cooldown':
      return {
        id,
        cooldown: true,
        ...metric,
        intensity: 'active',
        pace: {
          units: 'secs',
          value: 623,
        },
      };

    case 'repeat':
      return {
        id,
        type: 'repeat',
        iterations: 3,
        steps: [
          {
            id: `${id}-1`,
            ...(mode === 'time'
              ? {
                  duration:
                    durationSec / 3,
                }
              : {
                  distance:
                    distanceMiles / 3,
                }),
            pace: {
              units: 'secs',
              value: 445,
            },
          },
          {
            id: `${id}-2`,
            ...(mode === 'time'
              ? {
                  duration:
                    durationSec / 3,
                }
              : {
                  distance:
                    distanceMiles / 3,
                }),
            pace: {
              units: 'secs',
              value: 540,
            },
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
        pace: {
          units: 'secs',
          value:
            DEFAULT_THRESHOLD(),
        },
      };
  }
};


export const createDefaultSteps = (
  mode = 'time'
) => {
  return [
    createStep(
      'warmup',
      mode
    ),
    createStep(
      'repeat',
      mode
    ),
    createStep(
      'cooldown',
      mode
    ),
  ];
};


/* =========================================================
   BASE WORKOUT ID HELPERS
   ========================================================= */

export const addIdsToBaseWorkout = (
  baseWorkout
) => {
  if (
    !baseWorkout?.workout_doc?.steps
  ) {
    return baseWorkout;
  }

  const timestamp =
    new Date()
      .toISOString()
      .replace(
        /[-T:]/g,
        ''
      )
      .slice(0, 14);

  const generateStepId =
    (idx) =>
      `step-loaded-${timestamp}-${idx}-${Math.random()
        .toString(36)
        .substring(2, 6)}`;

  const processSteps =
    (steps) => {
      return steps.map(
        (step, idx) => {
          const updatedStep = {
            ...step,
            id:
              step.id ||
              generateStepId(
                idx
              ),
          };

          if (
            Array.isArray(
              updatedStep.steps
            )
          ) {
            updatedStep.steps =
              processSteps(
                updatedStep.steps
              );
          }

          return updatedStep;
        }
      );
    };

  return {
    ...baseWorkout,
    workout_doc: {
      ...baseWorkout.workout_doc,
      steps:
        processSteps(
          baseWorkout
            .workout_doc
            .steps
        ),
    },
  };
};


export const removeIdsFromBaseWorkout = (
  baseWorkout
) => {
  if (
    !baseWorkout?.workout_doc?.steps
  ) {
    return baseWorkout;
  }

  const stripStepId =
    (steps) => {
      return steps.map(
        (step) => {
          const {
            id,
            steps:
              childSteps,
            ...cleanStep
          } = step;

          if (
            Array.isArray(
              childSteps
            )
          ) {
            cleanStep.steps =
              stripStepId(
                childSteps
              );
          }

          return cleanStep;
        }
      );
    };

  return {
    ...baseWorkout,
    workout_doc: {
      ...baseWorkout.workout_doc,
      steps:
        stripStepId(
          baseWorkout
            .workout_doc
            .steps
        ),
    },
  };
};


/* =========================================================
   ICU DOCUMENT -> UI STEPS
   ========================================================= */

export const mapIcuDocToSteps = (
  workout,
  mode = 'time'
) => {
  const stepsSource =
    workout?.workout_doc?.steps ||
    workout?.steps;

  if (
    !Array.isArray(
      stepsSource
    ) ||
    stepsSource.length === 0
  ) {
    return createDefaultSteps(
      'time'
    );
  }

  const mapStep =
    (s, idx) => {
      const id =
        `step-loaded-${new Date()
          .toISOString()
          .replace(
            /[-T:]/g,
            ''
          )
          .slice(0, 14)}-${idx}-${Math.random()
          .toString(36)
          .substr(2, 4)}`;

      if (
        s.reps &&
        Array.isArray(
          s.steps
        )
      ) {
        return {
          id,
          type: 'repeat',
          iterations:
            s.reps,
          steps:
            s.steps.map(
              mapStep
            ),
        };
      }

      let type = 'run';

      if (
        s.warmup ||
        s.intensity ===
          'warmup'
      ) {
        type = 'warmup';
      } else if (
        s.cooldown ||
        s.intensity ===
          'cooldown'
      ) {
        type = 'cooldown';
      } else if (
        s.intensity ===
        'rest'
      ) {
        type = 'recovery';
      }

      let targetPaceSec =
        DEFAULT_THRESHOLD();

      if (
        s.pace?.value
      ) {
        targetPaceSec =
          convertToPaceSec(
            s.pace.value
          );
      } else if (
        s.pace?.start
      ) {
        targetPaceSec =
          convertToPaceSec(
            s.pace.start
          );
      }

      const durationSec =
        s.duration ||
        s.durationSec ||
        300;

      const distanceMiles =
        s.distance
          ? s.distance /
            1609.344
          : durationSec /
            targetPaceSec;

      return {
        id,
        type,
        durationSec,
        distanceMiles,
        targetPaceSec,
      };
    };

  return stepsSource.map(
    mapStep
  );
};


/* =========================================================
   FILE DOWNLOAD
   ========================================================= */

export const downloadFile = (
  content,
  filename,
  mimeType
) => {
  console.log(
    '[App Debug BuilderHelpers] downloadFile:',
    filename
  );

  const blob =
    new Blob(
      [content],
      {
        type: mimeType,
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      'a'
    );

  link.href = url;
  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );
};


/* =========================================================
   INTERVALS.ICU TEXT FORMATTER
   ========================================================= */

/**
 * Converts the UI step model into the plain-text workout
 * description expected by Intervals.icu.
 */
export function convertStepsToIcuText(
  steps = []
) {
  const lineArray = [];

  const formatSingleStep =
    (s) => {
      let durationStr = '';

      /*
       * Support both:
       * durationSec
       * duration
       */
      const durationValue =
        s.durationSec ??
        s.duration;

      if (
        durationValue
      ) {
        const mins =
          Math.floor(
            durationValue /
              60
          );

        const secs =
          durationValue %
          60;

        durationStr =
          secs > 0
            ? `${mins}m${secs}s`
            : `${mins}m`;
      } else if (
        s.distanceMiles
      ) {
        durationStr =
          `${s.distanceMiles.toFixed(
            2
          )}mi`;
      } else if (
        s.distance
      ) {
        /*
         * If distance is already
         * expressed in miles.
         */
        durationStr =
          `${Number(
            s.distance
          ).toFixed(2)}mi`;
      } else {
        durationStr =
          '10m';
      }

      let intensityLabel =
        s.type
          ? s.type
              .charAt(0)
              .toUpperCase() +
            s.type.slice(1)
          : 'Run';

      /*
       * Repeat children sometimes don't
       * have a type. Treat them as Run.
       */
      if (
        !s.type &&
        s.intensity ===
          'recovery'
      ) {
        intensityLabel =
          'Recovery';
      }

      let paceStr = '';

      if (
        s.targetPaceSec
      ) {
        paceStr =
          formatMMSS(
            s.targetPaceSec
          ) +
          '/mi';
      } else if (
        s.pace?.value
      ) {
        paceStr =
          formatMMSS(
            convertToPaceSec(
              s.pace.value
            )
          ) +
          '/mi';
      }

      return `${durationStr} ${intensityLabel} ${paceStr}`.trim();
    };


  const parseStep =
    (step) => {
      if (
        step.type ===
          'repeat' &&
        Array.isArray(
          step.steps
        )
      ) {
        const reps =
          step.iterations ||
          step.reps ||
          1;

        lineArray.push(
          `${reps}x`
        );

        step.steps.forEach(
          (child) => {
            const line =
              formatSingleStep(
                child
              );

            if (line) {
              lineArray.push(
                `- ${line}`
              );
            }
          }
        );

        return;
      }

      const line =
        formatSingleStep(
          step
        );

      if (line) {
        lineArray.push(
          `- ${line}`
        );
      }
    };


  steps.forEach(
    parseStep
  );

  return lineArray.join(
    '\n'
  );
}
