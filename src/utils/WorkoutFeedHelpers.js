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

const indexPlannedWorkouts = (valList) => {
  const byId = new Map();

  for (const workout of valList) {
    if (!workout || workout.id === undefined || workout.id === null) continue;
    byId.set(String(workout.id), workout);
  }

  return byId;
};

const buildMergedWorkouts = (valList, historicalList, plannedById, mergeHistorical) => {
  const pairedEventIds = new Set();

  const updatedHistoricalList = historicalList.map((item) => {
    if (!item) return item;

    const pairedId = item.paired_event_id;
    const plannedMatch = pairedId === undefined || pairedId === null
      ? null
      : plannedById.get(String(pairedId));

    // Only suppress a planned event when its ID successfully matched this activity.
    if (plannedMatch && plannedMatch.id !== undefined && plannedMatch.id !== null) {
      pairedEventIds.add(String(plannedMatch.id));
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

    // IDs from the planned-event and activity feeds are separate namespaces.
    // Include the feed source so unrelated records with coincidentally equal IDs survive.
    const uniqueKey = item.id !== undefined && item.id !== null
      ? `${item.feedSource}:${String(item.id)}`
      : `${item.feedSource}:${item.name || item.title || 'workout'}:${item.start_date_local || item.icu_start_date || item.start_date || item.date || ''}`;

    if (!seenKeys.has(uniqueKey)) {
      seenKeys.add(uniqueKey);
      mergedList.push(item);
    }
  }

  return mergedList;
};

export const mergeDailyWorkoutFeeds = (valJson, historicalJson) => {
  const { valList, historicalList, sportSettings } = indexFeeds(valJson, historicalJson);
  const plannedById = indexPlannedWorkouts(valList);

  const workouts = buildMergedWorkouts(
    valList,
    historicalList,
    plannedById,
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
    }
  );

  return { workouts, sportSettings };
};

export const mergeMonthlyWorkoutFeeds = (valJson, historicalJson) => {
  const { valList, historicalList, sportSettings } = indexFeeds(valJson, historicalJson);
  const plannedById = indexPlannedWorkouts(valList);

  const workouts = buildMergedWorkouts(
    valList,
    historicalList,
    plannedById,
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
    }
  );

  return { workouts, sportSettings };
};
