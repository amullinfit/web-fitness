import React from 'react';

// ============================================================
// Constants
// ============================================================

export const FALLBACK_THRESHOLD = 540; // seconds per mile

const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';
const VAL_MY_PACES_URL = '/api/val-my-paces';

export const DEFAULT_THRESHOLD = (paces) => {
  return paces?.threshold_pace || FALLBACK_THRESHOLD;
};

// ============================================================
// API - Folders
// ============================================================

export async function fetchFoldersApi() {
  console.log(
    '[WorkoutBuilder API] [Folders 1/3] fetchFoldersApi() called'
  );

  const endpoint = `${VAL_WORKOUTBUILDER_URL}?action=get_folders`;

  console.log(
    '[WorkoutBuilder API] [Folders 2/3] GET',
    endpoint
  );

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
    });

    console.log(
      '[WorkoutBuilder API] [Folders 2/3] Response:',
      {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      }
    );

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: Failed to fetch folders`
      );
    }

    const data = await res.json();

    console.log(
      '[WorkoutBuilder API] [Folders 3/3] Folder data received:',
      data
    );

    return Array.isArray(data)
      ? data
      : (data?.folders || []);
  } catch (err) {
    console.error(
      '[WorkoutBuilder API] [Folders ERROR]',
      err
    );

    throw err;
  }
}

// ============================================================
// API - Workouts
// ============================================================

export async function fetchWorkoutsApi(folderId = null) {
  console.log(
    '[WorkoutBuilder API] [Workouts 1/4] fetchWorkoutsApi() called',
    { folderId }
  );

  const url = folderId
    ? `${VAL_WORKOUTBUILDER_URL}?action=get_workouts&folder_id=${encodeURIComponent(folderId)}`
    : `${VAL_WORKOUTBUILDER_URL}?action=get_workouts`;

  console.log(
    '[WorkoutBuilder API] [Workouts 2/4] GET',
    url
  );

  try {
    const res = await fetch(url, {
      method: 'GET',
    });

    console.log(
      '[WorkoutBuilder API] [Workouts 2/4] Response:',
      {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      }
    );

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: Failed to fetch workouts`
      );
    }

    const data = await res.json();

    console.log(
      '[WorkoutBuilder API] [Workouts 3/4] Raw workout response:',
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
      '[WorkoutBuilder API] [Workouts 4/4] Parsed workout list:',
      {
        folderCount: folders.length,
        workoutCount: workouts.length,
        workouts,
      }
    );

    return {
      folders,
      workouts,
    };
  } catch (err) {
    console.error(
      '[WorkoutBuilder API] [Workouts ERROR]',
      err
    );

    throw err;
  }
}

// ============================================================
// API - Create Folder
// ============================================================

export async function createFolderApi(folderName) {
  console.log(
    '[WorkoutBuilder API] [Create Folder 1/4] createFolderApi() called',
    { folderName }
  );

  if (!folderName || !String(folderName).trim()) {
    throw new Error('Folder name is required.');
  }

  const body = {
    action: 'create_folder',
    name: String(folderName).trim(),
    type: 'FOLDER',
  };

  console.log(
    '[WorkoutBuilder API] [Create Folder 2/4] POST request:',
    {
      endpoint: VAL_WORKOUTBUILDER_URL,
      body,
    }
  );

  try {
    const res = await fetch(VAL_WORKOUTBUILDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(
      '[WorkoutBuilder API] [Create Folder 3/4] Response:',
      {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      }
    );

    if (!res.ok) {
      let errorDetails = '';

      try {
        const errJson = await res.json();

        errorDetails =
          errJson?.error ||
          errJson?.details ||
          errJson?.message ||
          JSON.stringify(errJson);
      } catch {
        errorDetails = await res.text();
      }

      throw new Error(
        `Server status ${res.status}: ${errorDetails}`
      );
    }

    const result = await res.json();

    console.log(
      '[WorkoutBuilder API] [Create Folder 4/4] Folder created:',
      result
    );

    return result;
  } catch (err) {
    console.error(
      '[WorkoutBuilder API] [Create Folder ERROR]',
      err
    );

    throw err;
  }
}

// ============================================================
// API - SAVE WORKOUT
//
// This is the single authoritative save function.
//
// Expected input from WorkoutBuilder:
//
// {
//   id,
//   name,
//   description,
//   folder_id,
//   document
// }
//
// OR:
//
// {
//   id,
//   name,
//   folder_id,
//   workout_doc: {
//     steps: []
//   }
// }
//
// The function normalizes either form before sending it to
// /api/val-workoutbuilder.
// ============================================================

export async function saveWorkoutApi(
  payload,
  isNew = false
) {
  console.log(
    '============================================================'
  );

  console.log(
    '[Save Flow] [1/8] saveWorkoutApi() ENTERED'
  );

  console.log(
    '[Save Flow] [1/8] Arguments:',
    {
      payload,
      isNew,
    }
  );

  if (!payload || typeof payload !== 'object') {
    console.error(
      '[Save Flow] [ERROR] Invalid save payload:',
      payload
    );

    throw new Error(
      'Cannot save workout: save payload is missing or invalid.'
    );
  }

  try {
    // ----------------------------------------------------------
    // STEP 2 - Clone the payload
    // ----------------------------------------------------------

    console.log(
      '[Save Flow] [2/8] Cloning and normalizing payload...'
    );

    let workoutData;

    try {
      workoutData = JSON.parse(
        JSON.stringify(payload)
      );
    } catch (cloneError) {
      console.error(
        '[Save Flow] [ERROR] Could not clone payload:',
        cloneError
      );

      throw new Error(
        'Cannot save workout: payload contains invalid data.'
      );
    }

    console.log(
      '[Save Flow] [2/8] Cloned payload:',
      workoutData
    );

    // ----------------------------------------------------------
    // STEP 3 - Determine whether this is CREATE or UPDATE
    // ----------------------------------------------------------

    if (isNew) {
      console.log(
        '[Save Flow] [3/8] Save-As-New requested. Removing existing IDs.'
      );

      delete workoutData.id;
      delete workoutData._id;
      delete workoutData.workout_id;

      if (workoutData.workout_doc) {
        workoutData = addIdsToBaseWorkout(
          workoutData
        );
      }
    }

    const workoutId =
      workoutData.id ??
      workoutData.workout_id ??
      workoutData._id ??
      null;

    const action = workoutId
      ? 'update_workout'
      : 'create_workout';

    const method = workoutId
      ? 'PUT'
      : 'POST';

    console.log(
      '[Save Flow] [3/8] Save operation determined:',
      {
        isNew,
        workoutId,
        action,
        method,
      }
    );

    // ----------------------------------------------------------
    // STEP 4 - Normalize folder
    // ----------------------------------------------------------

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
      '[Save Flow] [4/8] Folder normalized:',
      {
        originalFolderId:
          workoutData.saveFolderId ??
          workoutData.folderId ??
          workoutData.folder_id ??
          null,
        normalizedFolderId: folderId,
      }
    );

    // ----------------------------------------------------------
    // STEP 5 - Extract workout information
    // ----------------------------------------------------------

    const workoutName =
      workoutData.name ||
      workoutData.title ||
      workoutData.workout_doc?.name ||
      'Untitled Workout';

    let steps =
      workoutData.workout_doc?.steps ||
      workoutData.steps ||
      [];

    if (!Array.isArray(steps)) {
      console.warn(
        '[Save Flow] [5/8] Workout steps were not an array. Using empty array.',
        steps
      );

      steps = [];
    }

    console.log(
      '[Save Flow] [5/8] Workout data extracted:',
      {
        workoutName,
        stepCount: steps.length,
        steps,
      }
    );

    // ----------------------------------------------------------
    // STEP 6 - Generate Intervals.icu text description
    // ----------------------------------------------------------

    console.log(
      '[Save Flow] [6/8] Converting steps to Intervals.icu text...'
    );

    const icuDescription =
      convertStepsToIcuText(steps);

    console.log(
      '[Save Flow] [6/8] Generated Intervals.icu description:',
      icuDescription
    );

    // ----------------------------------------------------------
    // STEP 7 - Build final backend payload
    // ----------------------------------------------------------

    const workoutDoc = {
      ...(workoutData.workout_doc || {}),
      name: workoutName,
      steps,
    };

    const bodyPayload = {
      action,

      ...(workoutId
        ? { id: workoutId }
        : {}),

      name: workoutName,

      description:
        workoutData.description ||
        icuDescription,

      type:
        workoutData.type ||
        'Run',

      folder_id: folderId,

      workout_doc: workoutDoc,
    };

    console.log(
      '[Save Flow] [7/8] FINAL API PAYLOAD:',
      bodyPayload
    );

    console.log(
      '[Save Flow] [7/8] FINAL API REQUEST:',
      {
        endpoint: VAL_WORKOUTBUILDER_URL,
        method,
        action,
        id: workoutId,
      }
    );

    // ----------------------------------------------------------
    // STEP 8 - Actually call backend
    // ----------------------------------------------------------

    console.log(
      '[Save Flow] [8/8] Sending request to save API...'
    );

    const requestStart = Date.now();

    const res = await fetch(
      VAL_WORKOUTBUILDER_URL,
      {
        method,
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          bodyPayload
        ),
      }
    );

    const requestDuration =
      Date.now() - requestStart;

    console.log(
      '[Save Flow] [8/8] Save API responded:',
      {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        durationMs: requestDuration,
      }
    );

    // ----------------------------------------------------------
    // Handle HTTP error
    // ----------------------------------------------------------

    if (!res.ok) {
      let errorText = '';

      try {
        const errJson =
          await res.json();

        console.error(
          '[Save Flow] [API ERROR] Backend JSON error:',
          errJson
        );

        errorText =
          errJson?.error ||
          errJson?.message ||
          errJson?.details ||
          JSON.stringify(errJson);
      } catch {
        errorText =
          await res.text();

        console.error(
          '[Save Flow] [API ERROR] Backend text error:',
          errorText
        );
      }

      throw new Error(
        `Failed to save workout (${res.status}): ${
          errorText || 'Unknown server error'
        }`
      );
    }

    // ----------------------------------------------------------
    // Parse successful response
    // ----------------------------------------------------------

    let savedResult;

    try {
      savedResult =
        await res.json();
    } catch (jsonError) {
      console.error(
        '[Save Flow] [ERROR] Backend returned invalid JSON:',
        jsonError
      );

      throw new Error(
        'Workout may have been saved, but the server returned an invalid response.'
      );
    }

    console.log(
      '[Save Flow] [SUCCESS] Save API returned:',
      savedResult
    );

    console.log(
      '[Save Flow] [SUCCESS] Workout save operation completed.'
    );

    console.log(
      '============================================================'
    );

    return savedResult;

  } catch (err) {
    console.error(
      '[Save Flow] [FATAL ERROR] saveWorkoutApi() failed:',
      err
    );

    console.error(
      '[Save Flow] [FATAL ERROR] Error message:',
      err?.message
    );

    console.error(
      '[Save Flow] [FATAL ERROR] Stack:',
      err?.stack
    );

    console.log(
      '============================================================'
    );

    throw err;
  }
}

// ============================================================
// API - My Paces
// ============================================================

export async function fetchMyPacesApi() {
  console.log(
    '[WorkoutBuilder API] [Paces 1/3] fetchMyPacesApi() called'
  );

  try {
    const res = await fetch(
      VAL_MY_PACES_URL,
      {
        method: 'GET',
      }
    );

    console.log(
      '[WorkoutBuilder API] [Paces 2/3] Response:',
      {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      }
    );

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: Failed to fetch paces`
      );
    }

    const data = await res.json();

    console.log(
      '[WorkoutBuilder API] [Paces 3/3] Pace data:',
      data
    );

    return data;
  } catch (err) {
    console.error(
      '[WorkoutBuilder API] [Paces ERROR]',
      err
    );

    throw err;
  }
}

// ============================================================
// Formatting & Parsing Helpers
// ============================================================

export const formatTime = (
  totalSeconds
) => {
  const sec = Math.max(
    0,
    Math.round(
      totalSeconds || 0
    )
  );

  const hrs = Math.floor(
    sec / 3600
  );

  const mins = Math.floor(
    (sec % 3600) / 60
  );

  const secs =
    sec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(
      mins
    ).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  }

  return `${String(
    mins
  ).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;
};

export const formatMMSS = (
  totalSeconds
) => {
  const sec = Math.max(
    0,
    Math.round(
      totalSeconds || 0
    )
  );

  const mins = Math.floor(
    sec / 60
  );

  const secs =
    sec % 60;

  return `${String(
    mins
  ).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;
};

export const parseMMSS = (
  str
) => {
  if (!str) return 0;

  let cleanStr = String(str)
    .trim()
    .replace(
      /\/mi|\/km/g,
      ''
    );

  if (cleanStr.includes(':')) {
    const parts =
      cleanStr.split(':');

    if (parts.length === 3) {
      return (
        (parseInt(
          parts[0],
          10
        ) || 0) *
          3600 +
        (parseInt(
          parts[1],
          10
        ) || 0) *
          60 +
        (parseInt(
          parts[2],
          10
        ) || 0)
      );
    }

    return (
      (parseInt(
        parts[0],
        10
      ) || 0) *
        60 +
      (parseInt(
        parts[1],
        10
      ) || 0)
    );
  }

  const num =
    parseInt(
      cleanStr,
      10
    );

  if (isNaN(num)) {
    return 0;
  }

  if (num < 100) {
    return num * 60;
  }

  const mins =
    Math.floor(
      num / 100
    );

  const secs =
    num % 100;

  return (
    mins * 60 +
    Math.min(
      secs,
      59
    )
  );
};

export const convertToPaceSec = (
  val,
  paces = null
) => {
  if (!val) {
    return DEFAULT_THRESHOLD(
      paces
    );
  }

  if (
    typeof val ===
    'string'
  ) {
    return parseMMSS(val);
  }

  if (
    typeof val ===
      'number' &&
    val > 0
  ) {
    if (val < 15) {
      return Math.round(
        1609.344 / val
      );
    }

    return Math.round(val);
  }

  return DEFAULT_THRESHOLD(
    paces
  );
};

export const formatDistance = (
  miles
) => {
  return (
    (miles || 0).toFixed(2) +
    ' mi'
  );
};

// ============================================================
// Preset Calculations
// ============================================================

export function calculateDynamicPresets(
  paces,
  thresholdPaceSec,
  paceMethod
) {
  if (
    !paces ||
    !Array.isArray(
      paces.preset_colors
    )
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
        displayPace:
          formatMMSS(
            DEFAULT_PACE_VAL_SEC[
              idx
            ]
          ),
        targetPaceSec:
          DEFAULT_PACE_VAL_SEC[
            idx
          ],
        color:
          DEFAULT_PACE_ZONE_COLORS[
            idx %
              DEFAULT_PACE_ZONE_COLORS.length
          ],
        colorLabel: '',
      })
    );
  }

  return paces.preset_colors.map(
    (p) => {
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
        formatMMSS(
          paceSec
        );

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

        displayPace = `${pct}%`;
      } else if (
        paceMethod?.includes(
          'Range'
        ) &&
        p.pace_slow &&
        p.pace_fast
      ) {
        displayPace = `${p.pace_slow}-${p.pace_fast}`;
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

        displayPace = `${formatMMSS(
          lowPace
        )}-${formatMMSS(
          highPace
        )}`;
      }

      return {
        zone:
          p.zone_name,
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
    }
  );
}

// ============================================================
// Step Creation
// ============================================================

export const createStep = (
  type,
  mode = 'time'
) => {
  const id = `step-${Date.now()}-${Math.random()
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
      ? {
          duration:
            durationSec,
        }
      : {
          distance:
            distanceMiles,
        };

  switch (type) {
    case 'warmup':
      return {
        id,
        warmup: true,
        ...metric,
        intensity:
          'warmup',
        pace: {
          units: 'secs',
          value: 621,
        },
      };

    case 'run':
      return {
        id,
        ...metric,
        intensity:
          'active',
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
        intensity:
          'recovery',
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
        intensity:
          'active',
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
            ...(mode ===
            'time'
              ? {
                  duration:
                    durationSec /
                    3,
                }
              : {
                  distance:
                    distanceMiles /
                    3,
                }),
            pace: {
              units: 'secs',
              value: 445,
            },
          },
          {
            id: `${id}-2`,
            ...(mode ===
            'time'
              ? {
                  duration:
                    durationSec /
                    3,
                }
              : {
                  distance:
                    distanceMiles /
                    3,
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
        intensity:
          'active',
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

// ============================================================
// IDs
// ============================================================

export const addIdsToBaseWorkout = (
  baseWorkout
) => {
  if (
    !baseWorkout?.workout_doc
      ?.steps
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
      .slice(
        0,
        14
      );

  const generateStepId =
    (idx) =>
      `step-loaded-${timestamp}-${idx}-${Math.random()
        .toString(36)
        .substring(
          2,
          6
        )}`;

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
    !baseWorkout?.workout_doc
      ?.steps
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

// ============================================================
// ICU Document -> Builder Steps
// ============================================================

export const mapIcuDocToSteps = (
  workout,
  mode = 'time'
) => {
  const stepsSource =
    workout?.workout_doc
      ?.steps ||
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

  const mapStep = (
    s,
    idx
  ) => {
    const id = `step-loaded-${new Date()
      .toISOString()
      .replace(
        /[-T:]/g,
        ''
      )
      .slice(
        0,
        14
      )}-${idx}-${Math.random()
      .toString(36)
      .substr(
        2,
        4
      )}`;

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

    let type =
      'run';

    if (
      s.warmup ||
      s.intensity ===
        'warmup'
    ) {
      type =
        'warmup';
    } else if (
      s.cooldown ||
      s.intensity ===
        'cooldown'
    ) {
      type =
        'cooldown';
    } else if (
      s.intensity ===
      'rest'
    ) {
      type =
        'recovery';
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

// ============================================================
// File Download
// ============================================================

export const downloadFile = (
  content,
  filename,
  mimeType
) => {
  console.log(
    '[WorkoutBuilder] downloadFile()',
    {
      filename,
      mimeType,
    }
  );

  const blob =
    new Blob(
      [content],
      {
        type: mimeType,
      }
    );

  // Correct browser API:
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

// ============================================================
// Convert Steps -> Intervals.icu Text
//
// This produces the text description sent to the backend.
// ============================================================

export function convertStepsToIcuText(
  steps = []
) {
  console.log(
    '[WorkoutBuilder] convertStepsToIcuText() called',
    {
      stepCount:
        Array.isArray(
          steps
        )
          ? steps.length
          : 0,
    }
  );

  const lineArray = [];

  const parseStep = (
    step
  ) => {
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
    } else {
      const line =
        formatSingleStep(
          step
        );

      if (line) {
        lineArray.push(
          `- ${line}`
        );
      }
    }
  };

  const formatSingleStep =
    (s) => {
      let durationStr =
        '';

      // Support both the builder's
      // durationSec representation and
      // the original duration field.
      const durationSec =
        s.durationSec ??
        s.duration;

      if (
        durationSec
      ) {
        const mins =
          Math.floor(
            durationSec /
              60
          );

        const secs =
          durationSec %
          60;

        durationStr =
          secs > 0
            ? `${mins}m${secs}s`
            : `${mins}m`;
      } else if (
        s.distanceMiles
      ) {
        durationStr = `${s.distanceMiles.toFixed(
          2
        )}mi`;
      } else if (
        s.distance
      ) {
        durationStr = `${s.distance}mi`;
      } else {
        durationStr =
          '10m';
      }

      let intensityLabel =
        s.type
          ? s.type
              .charAt(
                0
              )
              .toUpperCase() +
            s.type.slice(
              1
            )
          : 'Run';

      if (
        s.warmup ||
        s.intensity ===
          'warmup'
      ) {
        intensityLabel =
          'Warmup';
      } else if (
        s.cooldown ||
        s.intensity ===
          'cooldown'
      ) {
        intensityLabel =
          'Cooldown';
      } else if (
        s.intensity ===
          'recovery' ||
        s.intensity ===
          'rest'
      ) {
        intensityLabel =
          'Recovery';
      }

      let paceStr =
        '';

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

  if (
    !Array.isArray(
      steps
    )
  ) {
    return '';
  }

  steps.forEach(
    parseStep
  );

  const result =
    lineArray.join(
      '\n'
    );

  console.log(
    '[WorkoutBuilder] convertStepsToIcuText() result:',
    result
  );

  return result;
}
