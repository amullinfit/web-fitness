//
// Modal_Workout_Edit.jsx
//
import React, { useState, useMemo, useEffect } from 'react';
import RenderWorkoutChart from '../utils/RenderWorkoutChart';
import { formatTime, formatDistance, mapIcuDocToSteps } from '../utils/WorkoutBuilderHelpers.js';
import '../CSS/Modal_Workout_Edit.css';

import WorkoutChart from '../components/WorkoutChart';

export default function Modal_Workout_Edit({
  isOpen,
  onClose,
  onSelectWorkout,
  currentFolderId = '',
  folders = [],
  workouts = [],
  workoutMode = 'time',
  presets = {}
}) {
  // Determine default folder ID based on priority:
  // 1. Explicit currentFolderId
  // 2. Folder named "Workouts"
  // 3. First available folder in list
  // 4. Root ("") if no folders exist
  const defaultFolderId = useMemo(() => {
    if (currentFolderId !== null && currentFolderId !== undefined && currentFolderId !== '') {
      return String(currentFolderId);
    }

    if (folders && folders.length > 0) {
      const workoutsFolder = folders.find(
        (f) => (f.name || f.title || '').trim().toLowerCase() === 'workouts'
      );
      if (workoutsFolder) {
        return String(workoutsFolder.id);
      }
      return String(folders[0].id);
    }

    return '';
  }, [currentFolderId, folders]);

  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId);

  // Sync state if defaultFolderId updates (e.g. when modal opens or folders load)
  useEffect(() => {
    setSelectedFolderId(defaultFolderId);
  }, [defaultFolderId, isOpen]);

  if (!isOpen) return null;

  // Filter workouts belonging to the selected folder
  const filteredWorkouts = useMemo(() => {
    if (selectedFolderId === '') {
      return workouts.filter((w) => !w.folder_id && !w.folderId);
    }
    return workouts.filter(
      (w) => String(w.folder_id ?? w.folderId) === String(selectedFolderId)
    );
  }, [workouts, selectedFolderId]);

  // Helper to calculate totals for each workout card preview
  const getWorkoutSummary = (workout) => {
    // Extract the ICU document field using all common property aliases
    const rawDoc = workout?.workout_doc ?? workout?.document ?? workout?.icu_doc;
    
    // Ensure stringified JSON is parsed if necessary
    const parsedDoc = typeof rawDoc === 'string' ? JSON.parse(rawDoc) : rawDoc;

    const steps = mapIcuDocToSteps(parsedDoc, workoutMode);

    const calcTotals = (list) => {
      let timeSec = 0;
      let distMiles = 0;

      (list || []).forEach((s) => {
        if (s.type === 'repeat') {
          const reps = s.iterations || 1;
          const [subTime, subDist] = calcTotals(s.steps || []);
          timeSec += subTime * reps;
          distMiles += subDist * reps;
        } else {
          if (workoutMode === 'time') {
            const dur = s.durationSec || 0;
            const pace = s.targetPaceSec || 0;
            timeSec += dur;
            distMiles += pace > 0 ? dur / pace : 0;
          } else {
            const dist = s.distanceMiles || 0;
            const pace = s.targetPaceSec || 0;
            distMiles += dist;
            timeSec += dist * pace;
          }
        }
      });

      return [timeSec, distMiles];
    };

    const [totalSec, totalMiles] = calcTotals(steps);

    return {
      steps,
      durationText: formatTime(totalSec),
      distanceText: formatDistance(totalMiles)
    };
  };


  return (
    <div className="modal-overlay">
      <div className="modal-container modal-workout-select">
        <div className="modal-header">
          <h2 className="modal-title">Select Workout</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Folder Selection Dropdown */}
        <div className="form-group">
          <label className="form-label">Folder</label>
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="form-select"
          >
            {/* Show Root option only when no folders exist */}
            {(!folders || folders.length === 0) && (
              <option value="">(Root / No Folder)</option>
            )}
            {folders.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name || f.title}
              </option>
            ))}
          </select>
        </div>

        {/* Workouts Grid */}
        <div className="workout-selection-list">
          <label className="form-label">Workouts ({filteredWorkouts.length})</label>
          {filteredWorkouts.length === 0 ? (
            <p className="no-workouts-message">No workouts found in this folder.</p>
          ) : (
            <div className="workout-cards-grid">
              {filteredWorkouts.map((workout) => {

                const { steps, durationText, distanceText } = getWorkoutSummary(workout);

                console.log('[App Debug] MWE: workout: ', workout);
                console.log('[App Debug] MWE: steps: ', steps);
                console.log('[App Debug] MWE: duration: ', durationText);
                console.log('[App Debug] MWE: distance: ', distanceText);

                return (
                  <div
                    key={workout.id}
                    className="workout-select-card"
                    onClick={() => onSelectWorkout(workout.id)}
                  >
                    <div className="workout-card-header">
                      <span className="workout-card-title">
                        {workout.name || workout.title || `Workout ${workout.id}`}
                      </span>
                      <div className="workout-card-meta">
                        <span>⏱ {durationText}</span>
                        <span>📏 {distanceText}</span>
                      </div>
                    </div>
                    <div className="workout-card-chart">
                      <RenderWorkoutChart
                        steps={steps}
                        height={60}
                        workoutMode={workoutMode}
                        presets={presets}
                      />
                    </div>
 
                    <div className="workout-card-header">
                      <span className="workout-card-title">
                        {workout.name || workout.title || `Workout ${workout.id}`}
                      </span>
                      <div className="workout-card-meta">
                        <span>⏱ {durationText}</span>
                        <span>📏 {distanceText}</span>
                      </div>
                      <WorkoutChart
                        workout={workout}
                        thresholdPace={480}
                        chartHeight={"60px"}
                        showYAxis={true}
                        showWorkoutName={false}
                        showThresholdPace={false}
                        showYAxisLabels={true}
                        showLegend={false}
                        minimalXAxis={true}
                        showHoverDetails={false}
                      />
                    </div>

                    <div className="workout-card-chart">
                      <WorkoutChart
                        workout={workout}
                        thresholdPace={480}
                        chartHeight={"60px"}
                        showYAxis={true}
                        showWorkoutName={false}
                        showThresholdPace={false}
                        showYAxisLabels={true}
                        showLegend={false}
                        minimalXAxis={true}
                        showHoverDetails={false}
                      />
                    </div>


                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}