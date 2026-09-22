import React, { useState, useEffect, useMemo } from 'react';
import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from '../utils/WorkoutTextSection';
import '../CSS/DailyView.css';
import { usePaces } from '../utils/PacesContext.jsx'; 

const VAL_WORKOUTS_URL = "/api/val-workouts";
const HISTORICAL_URL = "/api/val-historical";
const GEAR_REMOVE_URL = "/api/val-gear-remove";
const GEAR_ADD_URL = "/api/val-gear-add";
const GEAR_URL = "/api/val-gear";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handleChange = (e) => setIsMobile(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isMobile;
}

const safeStringLower = (val) => {
  if (!val) return "";
  if (typeof val === 'string') return val.toLowerCase();
  return String(val.id || val.type || val.name || val).toLowerCase();
};

// Updated helper accepting paces context fallback
const getThresholdPaceForSport = (workout, sportSettings, contextPaces) => {
  
  return contextPaces?.threshold_pace || null;

};

const getLocalDateString = (dateInput) => {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) return dateInput.split('T')[0];
    if (dateInput.length >= 10) return dateInput.slice(0, 10);
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const isWorkoutCompleted = (workout) => {
  if (workout.feedSource === 'HISTORICAL') {
    return true;
  }

  const hasPairedEvent = workout.paired_event_id !== null && workout.paired_event_id !== undefined;
  const hasCompliance = workout.compliance !== null && workout.compliance !== undefined;

  return hasPairedEvent || hasCompliance;
};

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

export default function DailyView() {

  const { paces, loading: pacesLoading } = usePaces();

  const [workouts, setWorkouts] = useState([]);
  const [sportSettings, setSportSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [removingGearId, setRemovingGearId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [modalWorkoutId, setModalWorkoutId] = useState(null);
  const [availableGear, setAvailableGear] = useState([]);
  const [loadingGear, setLoadingGear] = useState(false);
  const [selectedGearId, setSelectedGearId] = useState(null);

  const isMobile = useIsMobile(768);

  const showErrorMessage = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => {
      setErrorMessage(null);
    }, 6000);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetch(VAL_WORKOUTS_URL).then((res) => res.json()).catch((err) => {
        console.error("Error fetching val-workouts:", err);
        return null;
      }),
      fetch(HISTORICAL_URL).then((res) => res.json()).catch((err) => {
        console.error("Error fetching historical activities:", err);
        return null;
      })
    ])
      .then(([valJson, historicalJson]) => {
        if (!isMounted) return;

        const valList = (valJson?.planned || valJson?.workouts || (Array.isArray(valJson) ? valJson : []))
          .map((item) => ({ ...item, feedSource: 'WORKOUTS' }));

        const historicalList = (historicalJson?.activities || historicalJson?.workouts || (Array.isArray(historicalJson) ? historicalJson : []))
          .map((item) => ({ ...item, feedSource: 'HISTORICAL' }));

        const settings = Array.isArray(valJson?.sportSettings)
          ? valJson.sportSettings
          : Array.isArray(historicalJson?.sportSettings)
          ? historicalJson.sportSettings
          : [];

        const plannedWorkoutsById = new Map();
        const plannedWorkoutsByDateType = new Map();

        valList.forEach((workout) => {
          if (!workout) return;

          if (workout.id !== undefined && workout.id !== null) {
            plannedWorkoutsById.set(String(workout.id), workout);
          }

          const itemDate = getLocalDateString(workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date);
          const itemType = safeStringLower(workout.type || workout.sport || 'workout');
          if (itemDate) {
            plannedWorkoutsByDateType.set(`${itemDate}-${itemType}`, workout);
          }
        });

        const pairedEventIds = new Set();

        const updatedHistoricalList = historicalList.map((item) => {
          if (!item) return item;

          let plannedMatch = null;

          if (item.paired_event_id !== null && item.paired_event_id !== undefined) {
            const pairedIdStr = String(item.paired_event_id);
            pairedEventIds.add(pairedIdStr);
            plannedMatch = plannedWorkoutsById.get(pairedIdStr);
          }

          if (!plannedMatch) {
            const itemDate = getLocalDateString(item.start_date_local || item.icu_start_date || item.start_date || item.date);
            const itemType = safeStringLower(item.type || item.sport || 'workout');
            plannedMatch = plannedWorkoutsByDateType.get(`${itemDate}-${itemType}`);

            if (plannedMatch && plannedMatch.id) {
              pairedEventIds.add(String(plannedMatch.id));
            }
          }

          if (plannedMatch) {
            const plannedName = plannedMatch.name || plannedMatch.title;
            if (plannedName) {
              return {
                ...item,
                name: plannedName,
                title: plannedName,
                workout_doc: item.workout_doc || plannedMatch.workout_doc
              };
            }
          }

          return item;
        });

        const filteredValList = valList.filter((workout) => {
          if (!workout || workout.id === undefined || workout.id === null) return true;
          return !pairedEventIds.has(String(workout.id));
        });

        const rawMerged = [...updatedHistoricalList, ...filteredValList];
        const seenKeys = new Set();
        const mergedList = [];

        for (const item of rawMerged) {
          if (!item) continue;
          const itemDate = getLocalDateString(item.start_date_local || item.icu_start_date || item.start_date || item.date);
          const itemType = safeStringLower(item.type || item.sport || 'workout');
          const uniqueKey = item.id ? String(item.id) : `${item.name || itemType}-${itemDate}-${item.feedSource}`;

          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            mergedList.push(item);
          }
        }

        setWorkouts(mergedList);
        setSportSettings(settings);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading workout data:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRemoveGear = async (workoutId, gearId) => {
    if (!workoutId || !gearId) {
      console.warn("Cannot remove gear: missing workoutId or gearId", { workoutId, gearId });
      showErrorMessage("Cannot remove gear: Missing Workout ID or Gear ID.");
      return;
    }

    setRemovingGearId(workoutId);
    setErrorMessage(null);

    const previousWorkouts = [...workouts];

    setWorkouts((prev) =>
      prev.map((w) => {
        const matchesId = String(w.id) === String(workoutId) || 
                          String(w.icu_activity_id) === String(workoutId);
        if (matchesId) {
          return {
            ...w,
            shoe_name: null,
            gear_name: null,
            gear_id: null,
            gear: null
          };
        }
        return w;
      })
    );

    try {
      const params = new URLSearchParams({
        activityId: workoutId,
      });
      
      const response = await fetch(`${GEAR_REMOVE_URL}?${params.toString()}`, {
        method: 'GET',
      });
      
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

      if (Array.isArray(resData.gear)) {
        setWorkouts((prev) =>
          prev.map((w) => {
            const matchesId = String(w.id) === String(workoutId) || 
                              String(w.icu_activity_id) === String(workoutId);
            return matchesId ? { ...w, gear: resData.gear } : w;
          })
        );
      }
    } catch (err) {
      console.error("Error executing api_gear_remove, rolling back state:", err);
      setWorkouts(previousWorkouts);
      showErrorMessage(err.message || "Failed to remove gear. Restored original state.");
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
    const previousWorkouts = [...workouts];

    try {
      const params = new URLSearchParams({
        activityId: workoutId,
        gearId: gearId,
      });

      const response = await fetch(`${GEAR_ADD_URL}?${params.toString()}`, {
        method: 'GET',
      });

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

      const addedGearItem = availableGear.find(g => String(g.id || g.gear_id) === String(gearId));
      const newShoeName = addedGearItem ? addedGearItem.name : 'Assigned Shoe';

      setWorkouts((prev) =>
        prev.map((w) => {
          const matchesId = String(w.id) === String(workoutId) || 
                            String(w.icu_activity_id) === String(workoutId);
          if (matchesId) {
            return {
              ...w,
              shoe_name: newShoeName,
              gear_name: newShoeName,
              gear_id: gearId,
              gear: addedGearItem || gearId
            };
          }
          return w;
        })
      );

      setModalWorkoutId(null);
      setSelectedGearId(null);
    } catch (err) {
      console.error("Error executing api_gear_add, rolling back state:", err);
      setWorkouts(previousWorkouts);
      showErrorMessage(err.message || "Failed to add gear. Restored original state.");
    }
  };

  const activeShoesList = useMemo(() => {
    const rawActive = availableGear.filter((item) => {
      return isShoeGear(item) && !hasRetiredDate(item) && !isUnassignedActivity(item);
    });
    return sortByDistanceDesc(rawActive);
  }, [availableGear]);

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);

  const nextDateObj = useMemo(() => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    return next;
  }, [selectedDate]);

  const nextDateStr = useMemo(() => getLocalDateString(nextDateObj), [nextDateObj]);

  const selectedDayWorkouts = useMemo(() => {
    if (!Array.isArray(workouts)) return [];
    return workouts.filter((w) => {
      const rawDate = w.start_date_local || w.icu_start_date || w.start_date || w.date;
      return getLocalDateString(rawDate) === selectedDateStr;
    });
  }, [workouts, selectedDateStr]);

  const nextDayWorkouts = useMemo(() => {
    if (!Array.isArray(workouts)) return [];
    return workouts.filter((w) => {
      const rawDate = w.start_date_local || w.icu_start_date || w.start_date || w.date;
      return getLocalDateString(rawDate) === nextDateStr;
    });
  }, [workouts, nextDateStr]);

  const handlePrevDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const handleToday = () => setSelectedDate(new Date());

  if (loading) return <div className="daily-view-loading">Loading Daily Workouts & Activities...</div>;

  const formatHeaderDate = (dateObj) => {
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderWorkoutCard = (workout, index, isSelectedDate) => {
    const thresholdPaceMps = getThresholdPaceForSport(workout, sportSettings, paces);
    
    const workoutDateStr = getLocalDateString(
      workout.start_date_local || workout.icu_start_date || workout.start_date || workout.date
    );

    const completed = isWorkoutCompleted(workout);
    const isPast = workoutDateStr < todayStr;
    const isMissed = isPast && !completed;

    const shoeName = workout.shoe_name || workout.gear_name || 
      (typeof workout.gear === 'object' && !Array.isArray(workout.gear) ? workout.gear?.name : null);
    
    const gearId = workout.gear_id || 
      (Array.isArray(workout.gear) && workout.gear.length > 0 
        ? (typeof workout.gear[0] === 'object' ? workout.gear[0].id : workout.gear[0])
        : typeof workout.gear === 'object' ? workout.gear?.id : null);

    const activityId = workout.icu_activity_id || workout.activity_id || workout.id;
    const isRemoving = removingGearId === activityId;

    const hasValidShoe = shoeName && String(gearId) !== '69215';

    // Extract props passed to WorkoutChart for inspection
    const chartDataDebug = {
      workout: workout,
      thresholdPace: thresholdPaceMps,
      chartHeight: isMobile ? "110px" : "140px",
      pacesContextData: paces || null
    };

    return (
      <div key={activityId || index} className="daily-workout-card">
        {/* Header Bar */}
        <div className="daily-workout-card-header">
          <div className="daily-workout-header-left">
            <span className="daily-workout-type">
              {workout.type || workout.sport || 'Activity'}
            </span>
            {completed && <span className="status-badge badge-completed">COMPLETED</span>}
            {isMissed && <span className="status-badge badge-missed">MISSED</span>}
          </div>

          {/* Top Right: Shoe Tag with del-btn or add-btn */}
          <div className="daily-workout-header-right">
            {hasValidShoe ? (
              <span className="daily-workout-type daily-shoe-type">
                <span>👟 {shoeName}</span>
                <button
                  type="button"
                  className="del-btn remove-gear-btn"
                  title={`Activity ID: ${activityId} | Gear ID: ${gearId}`}
                  disabled={isRemoving}
                  onClick={() => handleRemoveGear(activityId, gearId)}
                >
                  {isRemoving ? <span className="gear-spinner" /> : '✕'}
                </button>
                <div className="gear-id-tooltip">
                  <span><strong>Activity ID:</strong> {activityId || 'N/A'}</span>
                  <span><strong>Gear ID:</strong> {gearId || 'N/A'}</span>
                </div>
              </span>
            ) : (
              <button
                type="button"
                className="add-btn"
                title="Add Shoe"
                onClick={() => handleOpenAddGearModal(activityId)}
              >
                +
              </button>
            )}
          </div>
        </div>

        {/* Workout Title */}
        <h3 className="daily-workout-title">
          {workout.name || workout.title || `${workout.type || 'Workout'}`}
        </h3>

        {/* Selected Date Debug Data Display */}
        {isSelectedDate && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>
              Properties (workout):
            </label>
            <textarea
              readOnly
              value={JSON.stringify(chartDataDebug, null, 2)}
              rows={8}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '8px',
                backgroundColor: '#1e1e1e',
                color: '#00ff66',
                border: '1px solid #333',
                borderRadius: '4px',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {(workout.workout_doc || workout.intervals) && (
          <WorkoutChart
            workout={workout}
            thresholdPace={thresholdPaceMps}
            chartHeight={isMobile ? "110px" : "140px"}
          />
        )}

        <WorkoutTextSection workout={workout} sportSettings={sportSettings} />
      </div>
    );
  };

  const renderDaySection = (dateObj, dateStr, dayWorkouts, isSelectedDate = false) => {
    const isToday = dateStr === todayStr;

    if (isToday) {
      console.log('[App Debug] DV: ');
      console.log('[App Debug] DV: ');
      console.log('[App Debug] DV: dayWorkouts: ', dayWorkouts);
      console.log('[App Debug] DV: ');
      console.log('[App Debug] DV: ');
    }

    return (
      <div className="daily-day-column">
        <div className="daily-day-section-header">
          <h3 className="daily-day-section-title">
            {formatHeaderDate(dateObj)}
          </h3>
          {isToday && <span className="daily-today-indicator">TODAY</span>}
        </div>

        {dayWorkouts.length === 0 ? (
          <div className="daily-empty-card">
            No workouts scheduled for {isToday ? 'today' : dateStr}.
          </div>
        ) : (
          <div className="daily-workouts-list">
            {dayWorkouts.map((workout, idx) => renderWorkoutCard(workout, idx, isSelectedDate))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="daily-view-container">
      {errorMessage && (
        <div className="daily-toast-error">
          <span className="daily-toast-message">⚠️ {errorMessage}</span>
          <button 
            type="button" 
            className="daily-toast-close" 
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="daily-nav-bar">
        <div className="daily-nav-buttons">
          <button onClick={handlePrevDay} className="nav-btn">
            ← Prev
          </button>
          <button
            onClick={handleToday}
            className={`nav-btn ${selectedDateStr === todayStr ? 'nav-btn-today-active' : 'nav-btn-today'}`}
          >
            Today
          </button>
          <button onClick={handleNextDay} className="nav-btn">
            Next →
          </button>
        </div>
      </div>

      <div className="daily-two-day-grid">
        {renderDaySection(selectedDate, selectedDateStr, selectedDayWorkouts, true)}
        {renderDaySection(nextDateObj, nextDateStr, nextDayWorkouts, false)}
      </div>

      {modalWorkoutId && (
        <div className="gear-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="gear-modal-content" style={{
            backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Select Shoe to Add</h3>
            {loadingGear ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading available shoes...</div>
            ) : activeShoesList.length === 0 ? (
              <p style={{ color: '#666' }}>No active shoes available.</p>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #eee', borderRadius: '4px' }}>
                {activeShoesList.map((shoe) => {
                  const shoeId = shoe.id || shoe.gear_id;
                  const isSelected = String(selectedGearId) === String(shoeId);
                  const dist = getDistanceInMiles(shoe);
                  return (
                    <div 
                      key={shoeId} 
                      onClick={() => setSelectedGearId(shoeId)}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                        backgroundColor: isSelected ? '#e8f5e9' : 'transparent'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="selectShoeRadio" 
                        checked={isSelected} 
                        onChange={() => setSelectedGearId(shoeId)}
                        style={{ marginRight: '10px' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontWeight: '500', color: '#333' }}>{shoe.name}</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>{dist.toFixed(1)} miles</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="nav-btn" 
                onClick={() => { setModalWorkoutId(null); setSelectedGearId(null); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="nav-btn"
                style={{ backgroundColor: '#2e7d32', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: selectedGearId ? 'pointer' : 'not-allowed', opacity: selectedGearId ? 1 : 0.6 }}
                disabled={!selectedGearId}
                onClick={() => handleAddGear(modalWorkoutId, selectedGearId)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}