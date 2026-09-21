import React from 'react';
import { modalOverlayStyle, modalContentStyle } from './modalStyles';

export default function Modal_Workout_Save({
  isOpen,
  onClose,
  saveAsNew,
  saveTitle,
  setSaveTitle,
  saveFolderId,
  setSaveFolderId,
  folders,
  showInlineFolderInput,
  setShowInlineFolderInput,
  inlineFolderInput,
  setInlineFolderInput,
  handleCreateInlineFolder,
  handleConfirmSaveWorkout,
  apiLoading,
}) {
  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>{saveAsNew ? 'Save As New Workout' : 'Save Workout'}</h3>

        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>
          Workout Name:
        </label>
        <input
          type="text"
          value={saveTitle}
          onChange={(e) => setSaveTitle(e.target.value)}
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
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setShowInlineFolderInput(!showInlineFolderInput)}>
            + New Folder
          </button>
        </div>

        {showInlineFolderInput && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '8px', backgroundColor: '#f8f9fa' }}>
            <input
              type="text"
              placeholder="New Folder Name"
              value={inlineFolderInput}
              onChange={(e) => setInlineFolderInput(e.target.value)}
              style={{ flex: 1, padding: '6px' }}
            />
            <button onClick={handleCreateInlineFolder} disabled={apiLoading}>
              Create
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleConfirmSaveWorkout}
            disabled={apiLoading}
            style={{ backgroundColor: '#007bff', color: '#fff' }}
          >
            {apiLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}