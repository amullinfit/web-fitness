//
// Modal_Workout_Edit.jsx
//
import React, { useState, useMemo, useEffect } from 'react';
import RenderWorkoutChart from '../utils/RenderWorkoutChart';
import { formatTime, formatDistance, mapIcuDocToSteps } from '../utils/WorkoutBuilderHelpers.js';
import '../CSS/Modal_Workout_Edit.css';

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
  // Find "Workouts" folder ID if currentFolderId is not explicitly provided
  const defaultFolderId = useMemo(() => {
    if (currentFolderId !== null && currentFolderId !== undefined && currentFolderId !== '') {
      return String(currentFolderId);
    }
    const workoutsFolder = folders.find(
      (f) => (f.name || f.title || '').trim().toLowerCase() === 'workouts'
    );
    return workoutsFolder ? String(workoutsFolder.id) : '';
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
    
    console.log('[App Debug] MWE: workout: ', workout);

    const steps = mapIcuDocToSteps(workout.document, workoutMode);

    const calcTotals = (list) => {
      let timeSec = 0;
      let distMiles = 0;

      list.forEach((s) => {
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

      console.log('[App Debug] MWE: time/dist: ', timeSec, distMiles);

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

        {/* Step 1: Choose Folder */}
        <div className="form-group">
          <label className="form-label">Folder</label>
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="form-select"
          >
            <option value="">(Root / No Folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name || f.title}
              </option>
            ))}
          </select>
        </div>

        {/* Step 1: Choose Folder */}
        <div className="form-group">
          <label className="form-label">Folder</label>
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="form-select"
          >
            <option value="">(Root / No Folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name || f.title}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: List Workouts in Selected Folder */}
        <div className="workout-selection-list">
          <label className="form-label">Workouts ({filteredWorkouts.length})</label>
          {filteredWorkouts.length === 0 ? (
            <p className="no-workouts-message">No workouts found in this folder.</p>
          ) : (
            <div className="workout-cards-grid">
              {filteredWorkouts.map((workout) => {
                const { steps, durationText, distanceText } = getWorkoutSummary(workout);
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