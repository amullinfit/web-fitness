import { useState, useMemo } from 'react';

const GEAR_REMOVE_URL = "/api/val-gear-remove";
const GEAR_ADD_URL = "/api/val-gear-add";
const GEAR_URL = "/api/val-gear";

const getDistanceInMiles = (gear) => {
  if (gear.distance_miles !== undefined) return gear.distance_miles;
  if (gear.distance_m !== undefined) return gear.distance_m / 1609.34;
  if (gear.distance !== undefined) {
    return gear.distance > 5000 ? gear.distance / 1609.34 : gear.distance;
  }
  return 0;
};

const isShoeGear = (gear) => {
  const type = (gear.type || '').toLowerCase();
  return type.includes('shoe');
};

const isUnassignedActivity = (gear) => {
  const name = (gear.name || '').toUpperCase();
  return name.includes('NOT ASSIGNED A SHOE') || name.includes('NOT TRACKED');
};

const hasRetiredDate = (gear) => Boolean(gear.retired);

const sortByDistanceDesc = (items) => {
  return [...items].sort((a, b) => getDistanceInMiles(b) - getDistanceInMiles(a));
};

export const isWorkoutCompleted = (workout) => {
  if (workout?.feedSource === 'HISTORICAL') return true;
  const hasPairedEvent = workout?.paired_event_id !== null && workout?.paired_event_id !== undefined;
  const hasCompliance = workout?.compliance !== null && workout?.compliance !== undefined;
  return hasPairedEvent || hasCompliance;
};

export const getGearInfo = (workout) => {
  if (!workout) return { shoeName: null, gearId: null, hasValidShoe: false };

  const shoeName = workout.shoe_name || workout.gear_name ||
    (Array.isArray(workout.gear) && workout.gear.length > 0 ? workout.gear[0]?.name : null) ||
    (typeof workout.gear === 'object' && !Array.isArray(workout.gear) ? workout.gear?.name : null);

  const gearId = workout.gear_id ||
    (Array.isArray(workout.gear) && workout.gear.length > 0
      ? (typeof workout.gear[0] === 'object' ? workout.gear[0].id : workout.gear[0])
      : typeof workout.gear === 'object' ? workout.gear?.id : null);

  const hasValidShoe = Boolean(shoeName) && String(gearId) !== '69215';

  return { shoeName, gearId, hasValidShoe };
};

export function useGearManagement(workouts, setWorkouts) {
  const [removingGearId, setRemovingGearId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [modalWorkoutId, setModalWorkoutId] = useState(null);
  const [availableGear, setAvailableGear] = useState([]);
  const [loadingGear, setLoadingGear] = useState(false);
  const [selectedGearId, setSelectedGearId] = useState(null);

  const showErrorMessage = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => {
      setErrorMessage(null);
    }, 6000);
  };

  const handleRemoveGear = async (workoutId, gearId) => {
    if (!workoutId || !gearId) {
      console.warn("Cannot remove gear: missing workoutId or gearId", { workoutId, gearId });
      showErrorMessage("Cannot remove gear: Missing Workout ID or Gear ID.");
      return;
    }

    setRemovingGearId(workoutId);
    setErrorMessage(null);

    // Optimistic state update: reset all gear fields consistently
    if (setWorkouts) {
      setWorkouts((prev) =>
        prev.map((w) => {
          const matchesId = 
            String(w.id) === String(workoutId) || 
            String(w.icu_activity_id) === String(workoutId);
          if (matchesId) {
            return {
              ...w,
              shoe_name: null,
              gear_name: null,
              gear_id: null,
              gear: [],
            };
          }
          return w;
        })
      );
    }

    try {
      const params = new URLSearchParams({ activityId: workoutId });
      const response = await fetch(`${GEAR_REMOVE_URL}?${params.toString()}`);
      const rawText = await response.text();
      let resData = {};

      try {
        resData = rawText ? JSON.parse(rawText) : {};
      } catch (e) {
        throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText}): ${rawText.slice(0, 80)}...`);
      }

      if (!response.ok) {
        const errorDetail = resData.details ? `: ${resData.details}` : '';
        const msg = resData.error || `Failed to remove gear (${response.status} ${response.statusText})${errorDetail}`;
        throw new Error(msg);
      }

      // Sync backend gear state if explicit gear list returned
      if (setWorkouts && resData.gear !== undefined) {
        const normalizedGear = Array.isArray(resData.gear) ? resData.gear : (resData.gear ? [resData.gear] : []);
        setWorkouts((prev) =>
          prev.map((w) => {
            const matchesId = String(w.id) === String(workoutId) || String(w.icu_activity_id) === String(workoutId);
            return matchesId ? { ...w, gear: normalizedGear } : w;
          })
        );
      }
    } catch (err) {
      console.error("Error executing api_gear_remove:", err);
      showErrorMessage(err.message || "Failed to remove gear.");
    } finally {
      setRemovingGearId(null);
    }
  };

  const handleOpenAddGearModal = async (workoutId) => {
    setModalWorkoutId(workoutId);
    setSelectedGearId(null);

    if (availableGear.length > 0) return;

    setLoadingGear(true);
    try {
      const response = await fetch(GEAR_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const json = await response.json();
      const list = Array.isArray(json) ? json : json?.gear || json?.items || [];
      setAvailableGear(list);
    } catch (err) {
      console.error("Error fetching gear for modal:", err);
      showErrorMessage("Failed to load available gear list.");
    } finally {
      setLoadingGear(false);
    }
  };

  const handleAddGear = async (workoutId, gearId) => {
    if (!workoutId || !gearId) {
      showErrorMessage("Cannot add gear: Missing Workout ID or Gear ID.");
      return;
    }

    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        activityId: workoutId,
        gearId: gearId,
      });

      const response = await fetch(`${GEAR_ADD_URL}?${params.toString()}`);
      const rawText = await response.text();
      let resData = {};
      try {
        resData = rawText ? JSON.parse(rawText) : {};
      } catch (e) {
        throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText}): ${rawText.slice(0, 80)}...`);
      }

      if (!response.ok) {
        const errorDetail = resData.details ? `: ${resData.details}` : '';
        const msg = resData.error || `Failed to add gear (${response.status} ${response.statusText})${errorDetail}`;
        throw new Error(msg);
      }

      const addedGearItem = availableGear.find((g) => String(g.id || g.gear_id) === String(gearId));
      const newShoeName = addedGearItem ? addedGearItem.name : 'Assigned Gear';

      if (setWorkouts) {
        setWorkouts((prev) =>
          prev.map((w) => {
            const matchesId = 
                String(w.id) === String(workoutId) || 
                String(w.icu_activity_id) === String(workoutId);
            if (matchesId) {
              const updatedGear = resData.gear
                ? (Array.isArray(resData.gear) ? resData.gear : [resData.gear])
                : (addedGearItem ? [addedGearItem] : [{ id: gearId, name: newShoeName }]);

              return {
                ...w,
                shoe_name: newShoeName,
                gear_name: newShoeName,
                gear_id: gearId,
                gear: updatedGear,
              };
            }
            return w;
          })
        );
      }
      setModalWorkoutId(null);
      setSelectedGearId(null);
    } catch (err) {
      console.error("Error executing api_gear_add:", err);
      showErrorMessage(err.message || "Failed to add gear.");
    }
  };

  const activeShoesList = useMemo(() => {
    const rawActive = availableGear.filter((item) => {
      return isShoeGear(item) && !hasRetiredDate(item) && !isUnassignedActivity(item);
    });
    return sortByDistanceDesc(rawActive);
  }, [availableGear]);

  return {
    removingGearId,
    errorMessage,
    setErrorMessage,
    modalWorkoutId,
    setModalWorkoutId,
    loadingGear,
    selectedGearId,
    setSelectedGearId,
    activeShoesList,
    handleRemoveGear,
    handleOpenAddGearModal,
    handleAddGear,
  };
}