import React from 'react';

    export default function OptionsMenu({
        isOpen,
        onToggleOpen,
        mode,
        menuButtonStyle,
        onStartCreateNew,
        onOpenEditModal,
        onOpenCreateFolderModal,
        onOpenSaveModal,
        onDuplicateWorkout,
        onCopyWorkoutText,
        onDownloadIcu,
        onDownloadZwo,
        onCancelEdits,
        onCloseWorkout,
    }) {
        const isEditingOrCreating = mode === 'CREATING' || mode === 'EDITING';

        return (
        <div style={{ position: 'relative' }}>
        <button onClick={onToggleOpen} className="options-menu-btn">
        ⚙️ Options ▾
        </button>

        {isOpen && (
        <div className="options-menu-dropdown">
            <button style={menuButtonStyle} onClick={onStartCreateNew}>
            ➕ Create New Workout
            </button>
            <button style={menuButtonStyle} onClick={onOpenEditModal}>
            ✏️ Edit Existing Workout
            </button>
            <button style={menuButtonStyle} onClick={onOpenCreateFolderModal}>
            📁 Create New Folder
            </button>

            {isEditingOrCreating && <div className="menu-divider" />}

            {isEditingOrCreating && (
            <button style={menuButtonStyle} onClick={() => onOpenSaveModal(false)}>
                💾 Save Workout
            </button>
            )}
            {mode === 'EDITING' && (
            <button style={menuButtonStyle} onClick={() => onOpenSaveModal(true)}>
                📋 Save As New Workout
            </button>
            )}
            {isEditingOrCreating && (
            <button style={menuButtonStyle} onClick={onDuplicateWorkout}>
                📄 Duplicate Workout
            </button>
            )}

            {isEditingOrCreating && <div className="menu-divider" />}

            {isEditingOrCreating && (
            <>
                <button style={menuButtonStyle} onClick={onCopyWorkoutText}>
                📋 Copy Workout Text
                </button>
                <button style={menuButtonStyle} onClick={onDownloadIcu}>
                ⬇️ Download .icu File
                </button>
                <button style={menuButtonStyle} onClick={onDownloadZwo}>
                ⚡ Download .zwo File
                </button>
            </>
            )}

            {isEditingOrCreating && <div className="menu-divider" />}

            {mode === 'EDITING' && (
            <button
                style={{ ...menuButtonStyle, color: '#dc3545' }}
                onClick={onCancelEdits}
            >
                ↩️ Cancel Edits
            </button>
            )}
            {isEditingOrCreating && (
            <button
                style={{ ...menuButtonStyle, color: '#6c757d' }}
                onClick={onCloseWorkout}
            >
                ✖️ Close Workout
            </button>
            )}
        </div>
        )}
        </div>
        );
    }

    export function ControlBar({workoutMode, setWorkoutMode, thresholdPaceSec, paceMethod, setPaceMethod}) {
        return (
            <div className="builder-controls-bar">
                <div className="mode-toggle-group">
                    <span className="control-label">Build By:</span>
                    <button
                        type="button"
                        className={`toggle-btn ${workoutMode === 'time' ? 'active' : ''}`}
                        onClick={() => setWorkoutMode('time')}
                    >
                        ⏱️ Time
                    </button>
                    <button
                        type="button"
                        className={`toggle-btn ${workoutMode === 'distance' ? 'active' : ''}`}
                        onClick={() => setWorkoutMode('distance')}
                    >
                        📏 Distance
                    </button>

                    <span style={{ marginLeft: '12px', fontSize: '13px', fontWeight: '600', color: '#495057' }}>
                        Threshold Pace: <span style={{ color: '#007bff' }}>{formatMMSS(thresholdPaceSec)}</span> /mi
                    </span>
                </div>
                <div className="pace-method-group">
                    <span className="control-label">Pace Method:</span>
                    <select
                    value={paceMethod}
                    onChange={(e) => setPaceMethod(e.target.value)}
                    className="pace-method-select"
                    >
                    <option value="Pace">Pace</option>
                    <option value="Pace Range">Pace Range</option>
                    <option value="Zone">Zone</option>
                    <option value="Zone Range">Zone Range</option>
                    <option value="Threshold %">Threshold %</option>
                    <option value="Theshold % Range">Threshold % Range</option>
                    </select>
                </div>
            </div>

        );
    }