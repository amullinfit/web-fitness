//
// Modal_Workout_Save.jsx
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
  errorMessage = '', // Optional: pass down error string from parent state
  successMessage = '', // Optional: pass down success string from parent state
}) {

  console.log('[App Debug Modal_Save] Render State:', {
    isOpen,
    saveTitle,
    isTitleValid: Boolean(saveTitle?.trim()),
    apiLoading,
    isHandlerFunction: typeof handleConfirmSaveWorkout === 'function'
  });
  
  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
          {saveAsNew ? 'Save As New Workout / Duplicate' : 'Save Workout'}
        </h3>

        {/* --- Error Display --- */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #f5c6cb',
            }}
          >
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {/* --- Success Display --- */}
        {successMessage && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#d4edda',
              color: '#155724',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #c3e6cb',
            }}
          >
            {successMessage}
          </div>
        )}

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
            value={saveFolderId ?? ''}
            onChange={(e) => setSaveFolderId(e.target.value)}
            style={{ flex: 1, padding: '8px' }}
          >
            <option value="">(No Folder / Root)</option>
            {Array.isArray(folders) &&
              folders.map((f, idx) => {
                const fId = f.id !== undefined ? f.id : (f._id !== undefined ? f._id : idx);
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
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            {showInlineFolderInput ? 'Cancel' : '+ New Folder'}
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
              style={{ padding: '6px 12px', cursor: 'pointer' }}
            >
              Create
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} disabled={apiLoading} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSaveWorkout}
            disabled={apiLoading || !saveTitle.trim()}
            style={{ backgroundColor: '#007bff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            {apiLoading ? 'Saving...' : saveAsNew ? 'Save As New' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}