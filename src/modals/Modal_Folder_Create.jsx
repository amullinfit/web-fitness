import React from 'react';
import { modalOverlayStyle, modalContentStyle } from './modalStyles';

export default function Modal_Folder_Create({
  isOpen,
  onClose,
  newFolderName,
  setNewFolderName,
  handleCreateFolderSubmit,
  apiLoading,
}) {
  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>Create New Folder</h3>
        <input
          type="text"
          placeholder="Folder Name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleCreateFolderSubmit}
            disabled={apiLoading}
            style={{ backgroundColor: '#007bff', color: '#fff' }}
          >
            {apiLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}