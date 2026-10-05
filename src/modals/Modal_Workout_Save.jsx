//
// Modal_Workout_Save.jsx
//

import React from 'react';
import {
  modalOverlayStyle,
  modalContentStyle,
} from './modalStyles';

export default function Modal_Workout_Save({
  isOpen,
  onClose,

  saveAsNew = false,

  saveTitle = '',
  setSaveTitle,

  saveFolderId = '',
  setSaveFolderId,

  folders = [],

  onConfirmSave,

  apiLoading = false,

  errorMessage = '',
  successMessage = '',
}) {
  console.log(
    '[App Debug Modal_Save] Render State:',
    {
      isOpen,
      saveAsNew,
      saveTitle,
      saveFolderId,
      isTitleValid:
        Boolean(saveTitle?.trim()),
      apiLoading,
      hasConfirmHandler:
        typeof onConfirmSave === 'function',
    }
  );

  if (!isOpen) {
    return null;
  }

  const handleSaveClick = () => {
    console.log(
      '[Save Flow] Step 3a: Save button clicked in Modal_Workout_Save',
      {
        saveTitle,
        saveFolderId,
        saveAsNew,
        apiLoading,
        hasConfirmHandler:
          typeof onConfirmSave === 'function',
      }
    );

    if (apiLoading) {
      console.warn(
        '[Save Flow] Save click ignored because a save is already in progress.'
      );
      return;
    }

    if (!saveTitle?.trim()) {
      console.warn(
        '[Save Flow] Save blocked because workout title is empty.'
      );
      return;
    }

    if (
      typeof onConfirmSave !==
      'function'
    ) {
      console.error(
        '[Save Flow] CRITICAL: onConfirmSave handler was not supplied to Modal_Workout_Save.'
      );
      return;
    }

    console.log(
      '[Save Flow] Step 3b: Calling parent onConfirmSave'
    );

    onConfirmSave(
      saveTitle.trim(),
      saveFolderId
    );
  };

  return (
    <div
      style={modalOverlayStyle}
      onClick={() => {
        if (!apiLoading) {
          onClose?.();
        }
      }}
    >
      <div
        style={modalContentStyle}
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: '16px',
          }}
        >
          {saveAsNew
            ? 'Save As New Workout'
            : 'Save Workout'}
        </h3>

        {/* ERROR */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
              border:
                '1px solid #f5c6cb',
            }}
          >
            <strong>
              Error:
            </strong>{' '}
            {errorMessage}
          </div>
        )}

        {/* SUCCESS */}
        {successMessage && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#d4edda',
              color: '#155724',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
              border:
                '1px solid #c3e6cb',
            }}
          >
            {successMessage}
          </div>
        )}

        {/* WORKOUT NAME */}
        <label
          style={{
            display: 'block',
            marginBottom: '4px',
            fontWeight: 'bold',
            fontSize: '13px',
          }}
        >
          Workout Name:
        </label>

        <input
          type="text"
          value={saveTitle}
          onChange={(e) => {
            console.log(
              '[App Debug Modal_Save] Save title changed:',
              e.target.value
            );

            setSaveTitle(
              e.target.value
            );
          }}
          placeholder="Enter workout name..."
          disabled={apiLoading}
          autoFocus
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        />

        {/* FOLDER */}
        <label
          style={{
            display: 'block',
            marginBottom: '4px',
            fontWeight: 'bold',
            fontSize: '13px',
          }}
        >
          Select Folder:
        </label>

        <select
          value={saveFolderId ?? ''}
          onChange={(e) => {
            console.log(
              '[App Debug Modal_Save] Folder changed:',
              e.target.value
            );

            setSaveFolderId(
              e.target.value
            );
          }}
          disabled={apiLoading}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '20px',
          }}
        >
          <option value="">
            (No Folder / Root)
          </option>

          {Array.isArray(folders) &&
            folders.map(
              (folder, idx) => {
                const folderId =
                  folder.id !==
                  undefined
                    ? folder.id
                    : folder._id !==
                      undefined
                    ? folder._id
                    : idx;

                const folderName =
                  folder.name ||
                  folder.title ||
                  folder.folderName ||
                  'Untitled Folder';

                return (
                  <option
                    key={folderId}
                    value={folderId}
                  >
                    📁 {folderName}
                  </option>
                );
              }
            )}
        </select>

        {/* BUTTONS */}
        <div
          style={{
            display: 'flex',
            justifyContent:
              'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              console.log(
                '[Save Flow] Save modal Cancel clicked'
              );

              onClose?.();
            }}
            disabled={apiLoading}
            style={{
              padding:
                '8px 16px',
              cursor: apiLoading
                ? 'default'
                : 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={
              apiLoading ||
              !saveTitle?.trim()
            }
            style={{
              backgroundColor:
                apiLoading ||
                !saveTitle?.trim()
                  ? '#999'
                  : '#007bff',
              color: '#fff',
              border: 'none',
              padding:
                '8px 16px',
              borderRadius: '4px',
              cursor:
                apiLoading ||
                !saveTitle?.trim()
                  ? 'default'
                  : 'pointer',
            }}
          >
            {apiLoading
              ? 'Saving...'
              : saveAsNew
              ? 'Save As New'
              : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
