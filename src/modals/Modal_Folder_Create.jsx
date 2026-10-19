// Modal_Folder_Create.jsx
import React, { useEffect, useState } from 'react';
import { modalOverlayStyle, modalContentStyle } from './modalStyles';

export default function Modal_Folder_Create({ onClose, onCreate }) {
  const [folderName, setFolderName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !submitting) onClose?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, submitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setSubmitting(true);
    await onCreate(folderName.trim());
    setSubmitting(false);
  };

  return (
    <div style={modalOverlayStyle} onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose?.(); }}>
      <div style={modalContentStyle}>
        <h3>Create New Folder</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Folder Name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button
              type="submit"
              disabled={submitting || !folderName.trim()}
              style={{ backgroundColor: '#007bff', color: '#fff' }}
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}