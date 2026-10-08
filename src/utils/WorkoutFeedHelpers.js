const indexFeeds = (valJson, historicalJson) => {
  const valList = (valJson?.planned || valJson?.workouts || (Array.isArray(valJson) ? valJson : []))
    .map((item) => ({ ...item, feedSource: 'WORKOUTS' }));

  const historicalList = (historicalJson?.activities || historicalJson?.workouts || (Array.isArray(historicalJson) ? historicalJson : []))
    .map((item) => ({ ...item, feedSource: 'HISTORICAL' }));

  const sportSettings = Array.isArray(valJson?.sportSettings)
    ? valJson.sportSettings
    : Array.isArray(historicalJson?.sportSettings)
    ? historicalJson.sportSettings
    : [];

  return { valList, historicalList, sportSettings };
};

const indexPlannedWorkouts = (valList, getLocalDateString, safeStringLower) => {
  const byId = new Map();
  const byDateType = new Map();

  for (const workout of valList) {
    if (!workout) continue;

    if (workout.id !== undefined && workout.id !== null) {
      byId.set(String(workout.id), workout);
    }

    const itemDate = getLocalDateString(
      workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date
    );
    const itemType = safeStringLower(workout.type || workout.sport || 'workout');

    if (itemDate) {
      const key = `${itemDate}-${itemType}`;
      const matches = byDateType.get(key) || [];
      matches.push(workout);
      byDateType.set(key, matches);
    }
  }

  return { byId, byDateType };
};

const buildMergedWorkouts = (
  valList,
  historicalList,
  plannedById,
  plannedByDateType,
  getLocalDateString,
  safeStringLower,
  findDateTypeMatch,
  mergeHistorical,
  hasDedupeId
) => {
  const pairedEventIds = new Set();
  const pairedPlannedWorkouts = new Set();

  const updatedHistoricalList = historicalList.map((item) => {
    if (!item) return item;

    let plannedMatch = null;

    if (item.paired_event_id !== null && item.paired_event_id !== undefined) {
      const pairedId = String(item.paired_event_id);
      pairedEventIds.add(pairedId);
      plannedMatch = plannedById.get(pairedId);
    }

    if (!plannedMatch) {
      const itemDate = getLocalDateString(
        item.start_date_local || item.icu_start_date || item.start_date || item.date
      );
      const itemType = safeStringLower(item.type || item.sport || 'workout');
      const matches = plannedByDateType.get(`${itemDate}-${itemType}`) || [];
      plannedMatch = findDateTypeMatch(matches, pairedPlannedWorkouts);
    }

    if (plannedMatch) {
      pairedPlannedWorkouts.add(plannedMatch);
      if (plannedMatch.id) pairedEventIds.add(String(plannedMatch.id));
    }

    return plannedMatch ? mergeHistorical(item, plannedMatch) : item;
  });

  const remainingValList = valList.filter((workout) => {
    if (!workout || workout.id === undefined || workout.id === null) return true;
    return !pairedEventIds.has(String(workout.id));
  });

  const mergedList = [];
  const seenKeys = new Set();

  for (const item of [...updatedHistoricalList, ...remainingValList]) {
    if (!item) continue;
    const rawDate = item.start_date_local || item.icu_start_date || item.start_date || item.date;
    const itemDate = rawDate ? getLocalDateString(rawDate) : '';
    const itemType = safeStringLower(item.type || item.sport || 'workout');
    const uniqueKey = hasDedupeId(item.id)
      ? String(item.id)
      : `${item.name || itemType}-${itemDate}-${item.feedSource}`;

    if (!seenKeys.has(uniqueKey)) {
      seenKeys.add(uniqueKey);
      mergedList.push(item);
    }
  }

  return mergedList;
};

export const mergeDailyWorkoutFeeds = (valJson, historicalJson, helpers) => {
  const { getLocalDateString, safeStringLower } = helpers;
  const { valList, historicalList, sportSettings } = indexFeeds(valJson, historicalJson);
  const { byId, byDateType } = indexPlannedWorkouts(valList, getLocalDateString, safeStringLower);

  const workouts = buildMergedWorkouts(
    valList,
    historicalList,
    byId,
    byDateType,
    getLocalDateString,
    safeStringLower,
    (matches) => matches[matches.length - 1] || null,
    (item, plannedMatch) => {
      const plannedName = plannedMatch.name || plannedMatch.title;
      return plannedName
        ? {
            ...item,
            name: plannedName,
            title: plannedName,
            workout_doc: item.workout_doc || plannedMatch.workout_doc
          }
        : item;
    },
    (id) => Boolean(id)
  );

  return { workouts, sportSettings };
};

export const mergeMonthlyWorkoutFeeds = (valJson, historicalJson, helpers) => {
  const { getLocalDateString, safeStringLower } = helpers;
  const { valList, historicalList, sportSettings } = indexFeeds(valJson, historicalJson);
  const { byId, byDateType } = indexPlannedWorkouts(valList, getLocalDateString, safeStringLower);

  const workouts = buildMergedWorkouts(
    valList,
    historicalList,
    byId,
    byDateType,
    getLocalDateString,
    safeStringLower,
    (matches, pairedWorkouts) => matches.find((workout) => !pairedWorkouts.has(workout)) || null,
    (item, plannedMatch) => {
      const plannedName = plannedMatch.name || plannedMatch.title;
      return {
        ...item,
        name: plannedName || item.name || item.title,
        title: plannedName || item.title || item.name,
        workout_doc: item.workout_doc || plannedMatch.workout_doc || null,
        intervals: (item.intervals && item.intervals.length > 0)
          ? item.intervals
          : (plannedMatch.intervals || item.intervals || null),
        description: item.description || plannedMatch.description || ''
      };
    },
    (id) => id !== null && id !== undefined
  );

  return { workouts, sportSettings };
};
