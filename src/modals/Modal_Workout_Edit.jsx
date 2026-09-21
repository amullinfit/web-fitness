import React from 'react';
import { modalOverlayStyle, modalContentStyle } from './modalStyles';

export default function Modal_Workout_Edit({
  isOpen,
  onClose,
  selectedEditFolderId,
  setSelectedEditFolderId,
  folders,
  fetchWorkoutsApi,
  setWorkoutsList,
  setStatusMessage,
  setApiLoading,
  apiLoading,
  workoutsList,
  mapIcuDocToSteps,
  calculateTotals,
  workoutMode,
  handleSelectWorkoutToEdit,
  formatTime,
  formatDistance,
  RenderWorkoutChart,
  dynamicPresets,
}) {
  if (!isOpen) return null;

  const handleFolderChange = async (e) => {
    const folderId = e.target.value;
    setSelectedEditFolderId(folderId);
    setApiLoading(true);
    try {
      const targetFolder = folders.find((f) => String(f.id) === String(folderId));
      if (targetFolder && Array.isArray(targetFolder.children)) {
        setWorkoutsList(targetFolder.children);
      } else {
        const wList = await fetchWorkoutsApi(folderId);
        setWorkoutsList(wList);
      }
    } catch (err) {
      setStatusMessage(`Failed to fetch workouts: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={{ ...modalContentStyle, width: '720px', maxWidth: '90vw' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Select Workout to Edit</h3>

        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>
          1. Select Folder:
        </label>
        <select
          value={selectedEditFolderId}
          onChange={handleFolderChange}
          style={{ width: '100%', padding: '8px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>
          2. Select Workout:
        </label>
        <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '16px' }}>
          {apiLoading ? (
            <p style={{ padding: '16px', color: '#888', margin: 0, textAlign: 'center' }}>Loading workouts...</p>
          ) : workoutsList.length === 0 ? (
            <p style={{ padding: '16px', color: '#888', margin: 0, textAlign: 'center' }}>No workouts found in this folder.</p>
          ) : (
            workoutsList.map((w) => {
              const workoutSteps = mapIcuDocToSteps(w);
              const wTotals = calculateTotals(workoutSteps, workoutMode);

              return (
                <div key={w.id} onClick={() => handleSelectWorkoutToEdit(w)} className="workout-select-item">
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="workout-select-title">{w.name || 'Untitled Workout'}</div>
                  </div>

                  <div className="workout-select-meta">
                    <span>⏱️ {formatTime(w.moving_time || wTotals.totalSec)}</span>
                    <span>📏 {formatDistance(w.distance ? w.distance / 1609.344 : wTotals.totalMiles)}</span>
                  </div>

                  <div style={{ width: '120px', flexShrink: 0, height: '40px', display: 'flex', alignItems: 'flex-end' }}>
                    <RenderWorkoutChart steps={workoutSteps} height={40} workoutMode={workoutMode} presets={dynamicPresets} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}