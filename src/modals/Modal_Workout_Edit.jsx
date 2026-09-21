//
// Modal_Workout_Edit
//
import React, { useState, useEffect, useMemo } from 'react';

export default function Modal_Workout_Edit({
  // Accept the new combined API response payload or fallback props
  workoutData = null, // { folders: [...], workouts: [...] }
  savedWorkouts: fallbackSavedWorkouts = [],
  folders: fallbackFolders = [],
  
  // Active workout edit details
  title = '',
  description = '',
  folderId = '',
  
  // Action Handlers
  onSelectWorkout,
  onSave,
  onClose,
  onOpenFolderModal,
}) {
  const [activeTab, setActiveTab] = useState('select');
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description);
  const [selectedFolder, setSelectedFolder] = useState(folderId);
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize incoming folders & workouts array from either workoutData object or individual props
  const folders = workoutData?.folders || fallbackFolders;
  
  // Extract workouts: use workoutData.workouts if pre-flattened, 
  // or dynamically flatten folder.children from workoutData.folders
  const savedWorkouts = useMemo(() => {
    if (workoutData?.workouts && Array.isArray(workoutData.workouts)) {
      return workoutData.workouts;
    }
    if (workoutData?.folders && Array.isArray(workoutData.folders)) {
      return workoutData.folders.flatMap((folder) =>
        Array.isArray(folder.children)
          ? folder.children.map((w) => ({
              ...w,
              folderId: w.folder_id || w.folderId || folder.id,
            }))
          : []
      );
    }
    return fallbackSavedWorkouts;
  }, [workoutData, fallbackSavedWorkouts]);

  // Synchronize internal form state when props change
  useEffect(() => {
    setEditTitle(title || '');
    setEditDescription(description || '');
    setSelectedFolder(folderId ? String(folderId) : '');
  }, [title, description, folderId]);

  // Group and filter workouts by folder
  const { folderMap, rootWorkouts, totalFiltered } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // Filter workouts by name or description
    const filtered = savedWorkouts.filter((w) => {
      const name = w.name || w.title || 'Untitled Workout';
      return name.toLowerCase().includes(query);
    });

    const folderMap = {};

    // 1. Build folder lookup map (keyed by string ID)
    folders.forEach((f) => {
      const rawFolderId = f.id ?? f._id;
      if (rawFolderId !== undefined && rawFolderId !== null) {
        const fId = String(rawFolderId);
        folderMap[fId] = {
          name: f.name || f.title || f.folderName || 'Untitled Folder',
          workouts: [],
        };
      }
    });

    const rootWorkouts = [];

    // 2. Assign workouts to their corresponding folder
    filtered.forEach((w) => {
      const rawFolderId =
        w.folder_id ??
        w.folderId ??
        (typeof w.folder === 'object' ? (w.folder?.id ?? w.folder?._id) : w.folder);

      const wFolderId =
        rawFolderId !== undefined && rawFolderId !== null ? String(rawFolderId) : null;

      if (wFolderId && folderMap[wFolderId]) {
        folderMap[wFolderId].workouts.push(w);
      } else {
        rootWorkouts.push(w);
      }
    });

    return { folderMap, rootWorkouts, totalFiltered: filtered.length };
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
          <h2 style={styles.headerTitle}>Workout Options</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
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
            📂 Open Existing ({totalFiltered})
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
              ) : totalFiltered === 0 ? (
                <p style={styles.emptyText}>No workouts match "{searchQuery}"</p>
              ) : (
                <>
                  {/* Folders & Workouts */}
                  {Object.entries(folderMap).map(([fId, folderObj]) => (
                    <div key={fId} style={styles.folderGroup}>
                      <div style={styles.folderHeader}>
                        📁 {folderObj.name} ({folderObj.workouts.length})
                      </div>
                      <div style={styles.folderWorkouts}>
                        {folderObj.workouts.length === 0 ? (
                          <div style={styles.emptyFolderText}>No workouts in this folder</div>
                        ) : (
                          folderObj.workouts.map((workout, idx) => {
                            const wId = workout.id || workout._id || `w-folder-${fId}-${idx}`;
                            const wTitle = workout.name || workout.title || 'Untitled Workout';
                            return (
                              <div
                                key={wId}
                                style={styles.workoutCard}
                                onClick={() => handleSelect(workout)}
                              >
                                <div style={styles.workoutTitleRow}>
                                  <span style={styles.workoutTitle}>{wTitle}</span>
                                  {workout.type && (
                                    <span style={styles.typeBadge}>{workout.type}</span>
                                  )}
                                </div>
                                {workout.description && (
                                  <div style={styles.workoutDesc}>
                                    {workout.description.trim().substring(0, 90)}
                                    {workout.description.length > 90 ? '...' : ''}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Root / Uncategorized Workouts */}
                  {rootWorkouts.length > 0 && (
                    <div style={styles.folderGroup}>
                      <div style={styles.folderHeader}>
                        📋 Uncategorized Workouts ({rootWorkouts.length})
                      </div>
                      <div style={styles.folderWorkouts}>
                        {rootWorkouts.map((workout, idx) => {
                          const wId = workout.id || workout._id || `w-root-${idx}`;
                          const wTitle = workout.name || workout.title || 'Untitled Workout';
                          return (
                            <div
                              key={wId}
                              style={styles.workoutCard}
                              onClick={() => handleSelect(workout)}
                            >
                              <div style={styles.workoutTitleRow}>
                                <span style={styles.workoutTitle}>{wTitle}</span>
                                {workout.type && (
                                  <span style={styles.typeBadge}>{workout.type}</span>
                                )}
                              </div>
                              {workout.description && (
                                <div style={styles.workoutDesc}>
                                  {workout.description.trim().substring(0, 90)}
                                  {workout.description.length > 90 ? '...' : ''}
                                </div>
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

        {/* Tab 2: Edit Details */}
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
                rows={4}
                placeholder="Optional description or workout steps..."
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
                    const fId = String(f.id ?? f._id ?? idx);
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
    width: '480px',
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
  headerTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#212529',
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
    maxHeight: '320px',
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
    transition: 'background-color 0.15s ease',
  },
  workoutTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  workoutTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#212529',
  },
  typeBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    backgroundColor: '#e7f5ff',
    color: '#1c7ed6',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  workoutDesc: {
    fontSize: '11px',
    color: '#6c757d',
    marginTop: '4px',
    whiteSpace: 'pre-line',
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