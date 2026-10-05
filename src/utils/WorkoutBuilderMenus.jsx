//
// WorkoutBuilderMenus.jsx
//

import React, { useState } from 'react';
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
  const [isOpen, setIsOpen] =
    useState(false);

  const isEditingOrCreating =
    mode === 'CREATING' ||
    mode === 'EDITING' ||
    mode === 'BUILDING' ||
    mode === 'SAVED';

  const handleAction = (
    actionName,
    actionFn
  ) => {
    console.log(
      '[Save Flow] OptionsMenu action selected:',
      actionName
    );

    if (typeof actionFn === 'function') {
      actionFn();
    } else {
      console.warn(
        '[App Debug WorkoutBuilderMenus] No handler supplied for:',
        actionName
      );
    }

    setIsOpen(false);
  };

  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={() => {
          console.log(
            '[App Debug WorkoutBuilderMenus] Options menu toggled'
          );

          setIsOpen(
            (prev) => !prev
          );
        }}
        className="options-menu-btn"
      >
        ⚙️ Options ▾
      </button>

      {isOpen && (
        <div className="options-menu-dropdown">

          <button
            type="button"
            className="options-menu-item"
            style={menuButtonStyle}
            onClick={() =>
              handleAction(
                'Create New Workout',
                onStartCreateNew
              )
            }
          >
            ➕ Create New Workout
          </button>

          <button
            type="button"
            className="options-menu-item"
            style={menuButtonStyle}
            onClick={() =>
              handleAction(
                'Open Existing Workout',
                onOpenSelectModal
              )
            }
          >
            📂 Open Existing Workout
          </button>

          <button
            type="button"
            className="options-menu-item"
            style={menuButtonStyle}
            onClick={() =>
              handleAction(
                'Create New Folder',
                onOpenCreateFolderModal
              )
            }
          >
            📁 Create New Folder
          </button>

          {isEditingOrCreating && (
            <div className="menu-divider" />
          )}

          {isEditingOrCreating && (
            <button
              type="button"
              className="options-menu-item"
              style={menuButtonStyle}
              onClick={() =>
                handleAction(
                  'Save Workout',
                  () =>
                    onOpenSaveModal?.(
                      false
                    )
                )
              }
            >
              💾 Save Workout
            </button>
          )}

          {isEditingOrCreating && (
            <button
              type="button"
              className="options-menu-item"
              style={menuButtonStyle}
              onClick={() =>
                handleAction(
                  'Save As New Workout',
                  () =>
                    onOpenSaveModal?.(
                      true
                    )
                )
              }
            >
              📋 Save As New Workout
            </button>
          )}

          {isEditingOrCreating && (
            <button
              type="button"
              className="options-menu-item"
              style={menuButtonStyle}
              onClick={() =>
                handleAction(
                  'Duplicate Workout',
                  onDuplicateWorkout
                )
              }
            >
              📄 Duplicate Workout
            </button>
          )}

          {isEditingOrCreating && (
            <div className="menu-divider" />
          )}

          {isEditingOrCreating && (
            <>
              <button
                type="button"
                className="options-menu-item"
                style={menuButtonStyle}
                onClick={() =>
                  handleAction(
                    'Copy Workout Text',
                    onCopyWorkoutText
                  )
                }
              >
                📋 Copy Workout Text
              </button>

              <button
                type="button"
                className="options-menu-item"
                style={menuButtonStyle}
                onClick={() =>
                  handleAction(
                    'Download ICU',
                    onDownloadIcu
                  )
                }
              >
                ⬇️ Download .icu File
              </button>

              <button
                type="button"
                className="options-menu-item"
                style={menuButtonStyle}
                onClick={() =>
                  handleAction(
                    'Download ZWO',
                    onDownloadZwo
                  )
                }
              >
                ⚡ Download .zwo File
              </button>
            </>
          )}

          {isEditingOrCreating && (
            <div className="menu-divider" />
          )}

          {isEditingOrCreating && (
            <button
              type="button"
              className="options-menu-item"
              style={{
                ...menuButtonStyle,
                color: '#dc3545',
              }}
              onClick={() =>
                handleAction(
                  'Cancel Edits',
                  onCancelEdits
                )
              }
            >
              ↩️ Cancel Edits
            </button>
          )}

          {isEditingOrCreating && (
            <button
              type="button"
              className="options-menu-item"
              style={{
                ...menuButtonStyle,
                color: '#6c757d',
              }}
              onClick={() =>
                handleAction(
                  'Close Workout',
                  onCloseWorkout
                )
              }
            >
              ✖️ Close Workout
            </button>
          )}
        </div>
      )}
    </div>
  );
}