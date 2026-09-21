//
// Modal_Workout_Edit.jsx
//
import React, { useState, useEffect, useMemo } from 'react';

export default function Modal_Workout_Edit({
  title = '',
  description = '',
  folderId = '',
  folders = [],
  savedWorkouts = [],
  onSelectWorkout,
  onSave,
  onClose,
  onOpenFolderModal,
}) {
  const [activeTab, setActiveTab] = useState('select');
  const [editTitle, setEditTitle] = useState(title || '');
  const [editDescription, setEditDescription] = useState(description || '');
  const [selectedFolder, setSelectedFolder] = useState(folderId || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state when props change
  useEffect(() => {
    setEditTitle(title || '');
    setEditDescription(description || '');
    setSelectedFolder(folderId || '');
  }, [title, description, folderId]);

  useEffect(() => {
    if (folderId) {
      setSelectedFolder(folderId);
    }
  }, [folders, folderId]);

  // Group workouts by folder ID
  const groupedWorkouts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = savedWorkouts.filter((w) => {
      const workoutName = w.name || w.title || 'Untitled Workout';
      return workoutName.toLowerCase().includes(query);
    });

    // Map folders by ID
    const folderMap = {};
    folders.forEach((f) => {
      const fId = f.id || f._id;
      folderMap[fId] = {
        name: f.name || f.title || f.folderName || 'Untitled Folder',
        workouts: [],
      };
    });

    const rootWorkouts = [];

    filtered.forEach((w) => {
      const wFolderId = w.folderId || w.folder || w.category;
      if (wFolderId && folderMap[wFolderId]) {
        folderMap[wFolderId].workouts.push(w);
      } else {
        rootWorkouts.push(w);
      }
    });

    return { folderMap, rootWorkouts };
  }, [savedWorkouts, folders, searchQuery]);

  const handleSelect = (workout) => {
    const wId = workout.id || workout._id;
    if (onSelectWorkout && wId) {
      onSelectWorkout(wId);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      onSave(editTitle, editDescription, selectedFolder);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Open Workout:</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab Bar */}
        <div style={styles.tabBar}>
          <button
            type="button"
            style={activeTab === 'select' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('select')}
          >
            📂 Open Existing ({savedWorkouts.length})
          </button>
          <button
            type="button"
            style={activeTab === 'edit' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('edit')}
          >
            ✏️ Edit Details
          </button>
        </div>

        {/* Tab 1: Grouped Workouts List */}
        {activeTab === 'select' && (
          <div style={styles.tabContent}>
            <input
              type="text"
              placeholder="🔍 Search workouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />

            <div style={styles.workoutList}>
              {savedWorkouts.length === 0 ? (
                <p style={styles.emptyText}>No saved workouts found.</p>
              ) : (
                <>
                  {/* Render Folders & Workouts inside them */}
                  {Object.entries(groupedWorkouts.folderMap).map(([fId, folderObj]) => (
                    <div key={fId} style={styles.folderGroup}>
                      <div style={styles.folderHeader}>
                        📁 {folderObj.name} ({folderObj.workouts.length})
                      </div>
                      <div style={styles.folderWorkouts}>
                        {folderObj.workouts.length === 0 ? (
                          <div style={styles.emptyFolderText}>No workouts in this folder</div>
                        ) : (
                          folderObj.workouts.map((workout, idx) => {
                            const wId = workout.id || workout._id || idx;
                            const wTitle = workout.name || workout.title || 'Untitled Workout';
                            return (
                              <div
                                key={wId}
                                style={styles.workoutCard}
                                onClick={() => handleSelect(workout)}
                              >
                                <div style={styles.workoutTitle}>{wTitle}</div>
                                {workout.description && (
                                  <div style={styles.workoutDesc}>{workout.description}</div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Render Workouts with No Folder */}
                  {groupedWorkouts.rootWorkouts.length > 0 && (
                    <div style={styles.folderGroup}>
                      <div style={styles.folderHeader}>
                        📋 Uncategorized Workouts ({groupedWorkouts.rootWorkouts.length})
                      </div>
                      <div style={styles.folderWorkouts}>
                        {groupedWorkouts.rootWorkouts.map((workout, idx) => {
                          const wId = workout.id || workout._id || idx;
                          const wTitle = workout.name || workout.title || 'Untitled Workout';
                          return (
                            <div
                              key={wId}
                              style={styles.workoutCard}
                              onClick={() => handleSelect(workout)}
                            >
                              <div style={styles.workoutTitle}>{wTitle}</div>
                              {workout.description && (
                                <div style={styles.workoutDesc}>{workout.description}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Edit Metadata */}
        {activeTab === 'edit' && (
          <form onSubmit={handleFormSubmit} style={styles.tabContent}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Workout Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={styles.input}
                placeholder="Enter workout title..."
                required
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={styles.textarea}
                rows={3}
                placeholder="Optional description or notes..."
              />
            </div>

            <div style={styles.fieldGroup}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Folder</label>
                {onOpenFolderModal && (
                  <button
                    type="button"
                    style={styles.linkBtn}
                    onClick={onOpenFolderModal}
                  >
                    + New Folder
                  </button>
                )}
              </div>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                style={styles.select}
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
            </div>

            <div style={styles.actions}>
              <button type="button" style={styles.btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" style={styles.btnPrimary}>
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    width: '460px',
    maxWidth: '90%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #eee',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#888',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  tab: {
    flex: 1,
    padding: '10px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#6c757d',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    flex: 1,
    padding: '10px',
    border: 'none',
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: '#007bff',
    borderBottom: '2px solid #007bff',
  },
  tabContent: {
    padding: '20px',
    overflowY: 'auto',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    marginBottom: '12px',
    fontSize: '13px',
    boxSizing: 'border-box',
  },
  workoutList: {
    maxHeight: '300px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  folderGroup: {
    border: '1px solid #e9ecef',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  folderHeader: {
    backgroundColor: '#f1f3f5',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#495057',
    borderBottom: '1px solid #e9ecef',
  },
  folderWorkouts: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  workoutCard: {
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid #dee2e6',
    backgroundColor: '#f8f9fa',
    cursor: 'pointer',
  },
  workoutTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#212529',
  },
  workoutDesc: {
    fontSize: '11px',
    color: '#6c757d',
    marginTop: '2px',
  },
  emptyFolderText: {
    fontSize: '12px',
    color: '#adb5bd',
    fontStyle: 'italic',
    padding: '4px',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: '13px',
    margin: '20px 0',
  },
  fieldGroup: {
    marginBottom: '14px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#333',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '13px',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '13px',
    boxSizing: 'border-box',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px',
  },
  btnPrimary: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  btnSecondary: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
};