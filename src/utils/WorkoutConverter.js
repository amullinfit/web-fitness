/**
 * 
 * WorkoutConverter.js 
 *
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