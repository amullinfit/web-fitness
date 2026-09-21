//
// Modal_Workout_Save
//
import React from 'react';
import { modalOverlayStyle, modalContentStyle } from './modalStyles';

export default function Modal_Workout_Save({
  isOpen,
  onClose,
  saveAsNew = false,
  saveTitle = '',
  setSaveTitle,
  saveFolderId = '',
  setSaveFolderId,
  folders = [],
  showInlineFolderInput = false,
  setShowInlineFolderInput,
  inlineFolderInput = '',
  setInlineFolderInput,
  handleCreateInlineFolder,
  handleConfirmSaveWorkout,
  apiLoading = false,
}) {
  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
          {saveAsNew ? 'Save As New Workout' : 'Save Workout'}
        </h3>

        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
          Workout Name:
        </label>
        <input
          type="text"
          value={saveTitle}
          onChange={(e) => setSaveTitle(e.target.value)}
          placeholder="Enter workout name..."
          style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
          Select Folder:
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <select
            value={saveFolderId}
            onChange={(e) => setSaveFolderId(e.target.value)}
            style={{ flex: 1, padding: '8px' }}
          >
            <option value="">(No Folder / Root)</option>
            {Array.isArray(folders) &&
              folders.map((f, idx) => {
                const fId = f.id || f._id || idx;
                const fName = f.name || f.title || f.folderName || 'Untitled Folder';
                return (
                  <option key={fId} value={fId}>
                    📁 {fName}
                  </option>
                );
              })}
          </select>
          <button
            type="button"
            onClick={() => setShowInlineFolderInput(!showInlineFolderInput)}
          >
            + New Folder
          </button>
        </div>

        {showInlineFolderInput && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <input
              type="text"
              placeholder="New Folder Name"
              value={inlineFolderInput}
              onChange={(e) => setInlineFolderInput(e.target.value)}
              style={{ flex: 1, padding: '6px' }}
            />
            <button
              type="button"
              onClick={handleCreateInlineFolder}
              disabled={apiLoading || !inlineFolderInput.trim()}
            >
              Create
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} disabled={apiLoading}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSaveWorkout}
            disabled={apiLoading || !saveTitle.trim()}
            style={{ backgroundColor: '#007bff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            {apiLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}