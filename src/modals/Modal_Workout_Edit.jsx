//
// Modal_Workout_Edit
//
import React, { useState, useEffect } from 'react';
import '../CSS/Modal_Workout_Edit.css';

export default function Modal_Workout_Edit({
  isOpen,
  onClose,
  onSave,
  onSelectWorkout,
  onOpenFolderModal,
  currentWorkout = null,
  folders = [],
  workouts = [],
}) {
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');

  useEffect(() => {
    if (currentWorkout) {
      setEditTitle(currentWorkout.name || currentWorkout.title || '');
      setEditDescription(currentWorkout.description || '');
      const rawFolderId = currentWorkout.folder_id ?? currentWorkout.folderId;
      setSelectedFolder(rawFolderId !== null && rawFolderId !== undefined ? String(rawFolderId) : '');
    } else {
      setEditTitle('');
      setEditDescription('');
      setSelectedFolder('');
    }
  }, [currentWorkout]);

  if (!isOpen) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      const parsedFolderId = selectedFolder === '' ? null : Number(selectedFolder);
      onSave(editTitle, editDescription, parsedFolderId);
    }
  };

  const handleWorkoutSelectChange = (e) => {
    const workoutId = e.target.value;
    if (workoutId && onSelectWorkout) {
      onSelectWorkout(workoutId);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">Edit Workout Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {workouts.length > 0 && (
          <div className="form-group">
            <label className="form-label">Switch Workout</label>
            <select
              value={currentWorkout?.id || ''}
              onChange={handleWorkoutSelectChange}
              className="form-select"
            >
              <option value="" disabled>Select a workout to edit...</option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.title || `Workout ${w.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label">Folder</label>
              {onOpenFolderModal && (
                <button
                  type="button"
                  onClick={onOpenFolderModal}
                  className="link-button"
                >
                  + New Folder
                </button>
              )}
            </div>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
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

          <div className="form-group">
            <label className="form-label">Description / Notes</label>
            <textarea
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="form-textarea"
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}