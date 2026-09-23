//
// WorkoutBuilderMenus.jsx
//
import React, { useState } from 'react';
import { formatMMSS } from '../utils/WorkoutBuilderHelpers.js';
import '../CSS/WorkoutBuilder.css';

export function OptionsMenu({
  mode,
  menuButtonStyle,
  onStartCreateNew,
  onOpenSelectModal,
  onOpenCreateFolderModal,
  onOpenSaveModal,
  onDuplicateWorkout,
  onCopyWorkoutText,
  onDownloadIcu,
  onDownloadZwo,
  onCancelEdits,
  onCloseWorkout,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isEditingOrCreating = mode === 'CREATING' || mode === 'EDITING' || mode === 'BUILDING' || mode === 'SAVED';

  const handleAction = (actionFn) => {
    if (actionFn) actionFn();
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setIsOpen(!isOpen)} className="options-menu-btn">
        ⚙️ Options ▾
      </button>

      {isOpen && (
        <div className="options-menu-dropdown">
          <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(onStartCreateNew)}>
            ➕ Create New Workout
          </button>
          <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(onOpenSelectModal)}>
            📂 Open Existing Workout
          </button>
          <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(onOpenCreateFolderModal)}>
            📁 Create New Folder
          </button>

          {isEditingOrCreating && <div className="menu-divider" />}

          {isEditingOrCreating && (
            <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(() => onOpenSaveModal(false))}>
              💾 Save Workout
            </button>
          )}
          {isEditingOrCreating && (
            <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(() => onOpenSaveModal(true))}>
              📋 Save As New Workout
            </button>
          )}
          {isEditingOrCreating && (
            <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(onDuplicateWorkout)}>
              📄 Duplicate Workout
            </button>
          )}

          {isEditingOrCreating && <div className="menu-divider" />}

          {isEditingOrCreating && (
            <>
              <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(onCopyWorkoutText)}>
                📋 Copy Workout Text
              </button>
              <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(onDownloadIcu)}>
                ⬇️ Download .icu File
              </button>
              <button className="options-menu-item" style={menuButtonStyle} onClick={() => handleAction(onDownloadZwo)}>
                ⚡ Download .zwo File
              </button>
            </>
          )}

          {isEditingOrCreating && <div className="menu-divider" />}

          {isEditingOrCreating && (
            <button
              className="options-menu-item"
              style={{ ...menuButtonStyle, color: '#dc3545' }}
              onClick={() => handleAction(onCancelEdits)}
            >
              ↩️ Cancel Edits
            </button>
          )}
          {isEditingOrCreating && (
            <button
              className="options-menu-item"
              style={{ ...menuButtonStyle, color: '#6c757d' }}
              onClick={() => handleAction(onCloseWorkout)}
            >
              ✖️ Close Workout
            </button>
          )}
        </div>
      )}
    </div>
  );
}

