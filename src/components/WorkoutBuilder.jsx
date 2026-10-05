//
// WorkoutBuilder.jsx
//

import React, { useState, useEffect, useMemo } from 'react';
import { usePaces } from '../utils/PacesContext.jsx';
import '../CSS/WorkoutBuilder.css';

import { useWorkoutSteps } from '../hooks/useWorkoutSteps';

import WorkoutChart from './WorkoutChart';
import WorkoutTextSection from '../utils/WorkoutTextSection';

import RenderStepRow from '../utils/RenderStepRow';

import { OptionsMenu } from '../utils/WorkoutBuilderMenus';

import Modal_Folder_Create from '../modals/Modal_Folder_Create';
import Modal_Workout_Edit from '../modals/Modal_Workout_Edit';
import Modal_Workout_Save from '../modals/Modal_Workout_Save';
import Modal_Workout_Zoom from '../modals/Modal_Workout_Zoom';

import {
  fetchFoldersApi,
  fetchWorkoutsApi,
  createFolderApi,
  saveWorkoutApi,
  calculateDynamicPresets,
  createDefaultSteps,
  addIdsToBaseWorkout,
} from '../utils/WorkoutBuilderHelpers.js';

export default function WorkoutBuilder() {
  const { paces } = usePaces();

  // ------------------------------------------------------------
  // Core State
  // ------------------------------------------------------------

  const [mode, setMode] = useState('EMPTY');

  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  // ------------------------------------------------------------
  // Workout Metadata
  // ------------------------------------------------------------

  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');

  // ------------------------------------------------------------
  // Raw / Working Workout Document
  // ------------------------------------------------------------

  const [unalteredWorkout, setUnalteredWorkout] = useState('');
  const [baseWorkout, setBaseWorkout] = useState(null);

  // ------------------------------------------------------------
  // Workout Options
  // ------------------------------------------------------------

  const [workoutMode, setWorkoutMode] = useState('time');
  const [paceMethod, setPaceMethod] = useState('Pace');

  // ------------------------------------------------------------
  // Save Modal State
  // ------------------------------------------------------------

  const [saveTitle, setSaveTitle] = useState('');
  const [saveFolderId, setSaveFolderId] = useState('');
  const [isSaveAsMode, setIsSaveAsMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ------------------------------------------------------------
  // Status / Toast
  // ------------------------------------------------------------

  const [statusMessage, setStatusMessage] = useState('');

  const showToast = (msg) => {
    console.log(
      '[App Debug WorkoutBuilder] showToast triggered with message:',
      msg
    );

    setStatusMessage(msg);

    setTimeout(() => {
      console.log(
        '[App Debug WorkoutBuilder] showToast timeout clear message'
      );
      setStatusMessage('');
    }, 3000);
  };

  // ------------------------------------------------------------
  // Custom Hook for Workout Steps
  // ------------------------------------------------------------

  const {
    steps,
    setSteps,
    addStep,
    removeStep,
    updateStepField,
    handleDragStart,
    handleDrop,
  } = useWorkoutSteps([], workoutMode);

  // ------------------------------------------------------------
  // Keep baseWorkout.workout_doc.steps synchronized with steps
  // ------------------------------------------------------------

  useEffect(() => {
    if (!baseWorkout?.workout_doc) {
      return;
    }

    console.log(
      '[App Debug WorkoutBuilder] Synchronizing baseWorkout.workout_doc.steps',
      {
        stepCount: steps.length,
      }
    );

    setBaseWorkout((prev) => {
      if (!prev?.workout_doc) {
        return prev;
      }

      return {
        ...prev,
        workout_doc: {
          ...prev.workout_doc,
          steps,
        },
      };
    });
  }, [steps]);

  // ------------------------------------------------------------
  // Keep baseWorkout.name synchronized with workoutTitle
  // ------------------------------------------------------------

  useEffect(() => {
    if (!baseWorkout) {
      return;
    }

    setBaseWorkout((prev) => ({
      ...prev,
      name: workoutTitle,
    }));
  }, [workoutTitle]);

  // ------------------------------------------------------------
  // Folders / Saved Workouts
  // ------------------------------------------------------------

  const [folders, setFolders] = useState([]);
  const [savedWorkouts, setSavedWorkouts] = useState([]);

  // ------------------------------------------------------------
  // Modal Visibility
  // ------------------------------------------------------------

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  // ------------------------------------------------------------
  // Initial Data Load
  // ------------------------------------------------------------

  useEffect(() => {
    console.log(
      '[App Debug WorkoutBuilder] Initial data fetch starting'
    );

    async function initData() {
      try {
        console.log(
          '[App Debug WorkoutBuilder] Fetching folders...'
        );

        const fetchedFolders = await fetchFoldersApi();

        console.log(
          '[App Debug WorkoutBuilder] Folders received:',
          fetchedFolders
        );

        setFolders(fetchedFolders || []);

        console.log(
          '[App Debug WorkoutBuilder] Fetching workouts...'
        );

        const fetchedWorkouts = await fetchWorkoutsApi();

        console.log(
          '[App Debug WorkoutBuilder] Workouts response received:',
          fetchedWorkouts
        );

        const workoutsArray = Array.isArray(fetchedWorkouts)
          ? fetchedWorkouts
          : fetchedWorkouts?.workouts || [];

        setSavedWorkouts(workoutsArray);

        console.log(
          '[App Debug WorkoutBuilder] Initial data load complete'
        );
      } catch (err) {
        console.error(
          '[App Debug WorkoutBuilder] Failed to initialize workout builder:',
          err
        );
      }
    }

    initData();
  }, []);

  // ------------------------------------------------------------
  // Dynamic Presets
  // ------------------------------------------------------------

  const dynamicPresets = useMemo(() => {
    console.log(
      '[App Debug WorkoutBuilder] Calculating dynamicPresets'
    );

    return calculateDynamicPresets(
      paces,
      paces?.threshold_pace || 360,
      paceMethod
    );
  }, [paces, paceMethod]);

  // ============================================================
  // CREATE NEW WORKOUT
  // ============================================================

  const handleNewWorkout = () => {
    console.log(
      '[App Debug WorkoutBuilder] Step 1: handleNewWorkout invoked'
    );

    const initialTitle = 'New Workout';

    const defaultSteps = createDefaultSteps(workoutMode);

    const newBase = {
      name: initialTitle,
      workout_doc: {
        steps: defaultSteps,
      },
    };

    console.log(
      '[App Debug WorkoutBuilder] New baseWorkout created:',
      newBase
    );

    setWorkoutId(null);
    setWorkoutTitle(initialTitle);
    setWorkoutDescription('');
    setUnalteredWorkout('');
    setBaseWorkout(newBase);
    setSteps(defaultSteps);
    setSelectedFolderId('');
    setMode('BUILDING');
  };

  // ============================================================
  // SELECT EXISTING WORKOUT
  // ============================================================

  const handleSelectWorkout = (id) => {
    console.log(
      '[App Debug WorkoutBuilder] handleSelectWorkout invoked with id:',
      id
    );

    const found = savedWorkouts.find(
      (w) => String(w.id) === String(id)
    );

    if (!found) {
      console.warn(
        '[App Debug WorkoutBuilder] No workout found for id:',
        id
      );
      return;
    }

    const title =
      found.name ||
      found.title ||
      'Untitled';

    const folderId =
      found.folder_id ??
      found.folderId ??
      '';

    let parsedObj = found;

    if (typeof found === 'string') {
      console.log(
        '[App Debug WorkoutBuilder] Parsing workout JSON string'
      );

      try {
        parsedObj = JSON.parse(found);
      } catch (err) {
        console.error(
          '[App Debug WorkoutBuilder] Failed to parse workout JSON:',
          err
        );
        return;
      }
    }

    const preparedBase = addIdsToBaseWorkout(parsedObj);

    const baseWithTitle = {
      ...preparedBase,
      name: title,
    };

    console.log(
      '[App Debug WorkoutBuilder] Loaded workout into baseWorkout:',
      baseWithTitle
    );

    setWorkoutId(found.id);
    setWorkoutTitle(title);
    setWorkoutDescription(found.description || '');
    setSelectedFolderId(folderId);
    setSaveTitle(title);
    setSaveFolderId(folderId);

    setUnalteredWorkout(parsedObj);
    setBaseWorkout(baseWithTitle);

    setSteps(
      preparedBase?.workout_doc?.steps || []
    );

    setMode('BUILDING');
    setIsEditModalOpen(false);
  };

  // ============================================================
  // OPEN SAVE MODAL
  // ============================================================

  const handleOpenSaveModal = (isSaveAs = false) => {
    console.log(
      '[Save Flow] Step 1: Save menu option selected',
      {
        isSaveAs,
        workoutId,
        workoutTitle,
        selectedFolderId,
      }
    );

    const initialTitle = isSaveAs
      ? `${workoutTitle} (Copy)`
      : workoutTitle;

    setIsSaveAsMode(isSaveAs);
    setSaveTitle(initialTitle);
    setSaveFolderId(selectedFolderId || '');
    setIsSaveModalOpen(true);

    console.log(
      '[Save Flow] Step 2: Save modal opening',
      {
        saveTitle: initialTitle,
        saveFolderId: selectedFolderId || '',
        isSaveAs,
      }
    );
  };

  // ============================================================
  // SAVE WORKOUT
  // ============================================================

  const handleSaveWorkout = async (
    overrideTitle,
    overrideFolderId
  ) => {
    console.log(
      '[Save Flow] Step 3: Save modal confirmed'
    );

    const finalTitle =
      String(
        overrideTitle ??
        saveTitle ??
        workoutTitle ??
        ''
      ).trim();

    const finalFolderId =
      overrideFolderId !== undefined
        ? overrideFolderId
        : saveFolderId;

    console.log(
      '[Save Flow] Step 4: Save values resolved',
      {
        finalTitle,
        finalFolderId,
        isSaveAsMode,
        workoutId,
      }
    );

    if (!finalTitle) {
      console.error(
        '[Save Flow] STOP: Workout title is empty'
      );

      showToast('Please enter a workout name.');
      return;
    }

    if (!baseWorkout) {
      console.error(
        '[Save Flow] STOP: baseWorkout is null'
      );

      showToast('No workout is currently loaded.');
      return;
    }

    if (!Array.isArray(steps)) {
      console.error(
        '[Save Flow] STOP: steps is not an array:',
        steps
      );

      showToast('Workout steps are invalid.');
      return;
    }

    setIsSaving(true);

    try {
      // --------------------------------------------------------
      // Build the current workout document.
      //
      // IMPORTANT:
      // baseWorkout is the working document and steps is the
      // latest hook state. We explicitly combine them here
      // instead of relying on a previous React render.
      // --------------------------------------------------------

      const currentWorkoutDocument = {
        ...baseWorkout,
        name: finalTitle,
        workout_doc: {
          ...(baseWorkout.workout_doc || {}),
          steps,
        },
      };

      console.log(
        '[Save Flow] Step 5: Current workout document prepared',
        currentWorkoutDocument
      );

      const payload = {
        ...currentWorkoutDocument,
        id: isSaveAsMode ? null : workoutId,
        name: finalTitle,
        description: workoutDescription,
        folder_id: finalFolderId,
      };

      console.log(
        '[Save Flow] Step 6: Payload prepared for saveWorkoutApi',
        payload
      );

      console.log(
        '[Save Flow] Step 7: Calling saveWorkoutApi...'
      );

      const saved = await saveWorkoutApi(
        payload,
        isSaveAsMode
      );

      console.log(
        '[Save Flow] Step 8: saveWorkoutApi returned successfully:',
        saved
      );

      if (!saved) {
        throw new Error(
          'Save API returned no workout data.'
        );
      }

      const newId =
        saved.id ||
        saved.workout_id ||
        saved._id ||
        workoutId;

      console.log(
        '[Save Flow] Step 9: Saved workout ID resolved:',
        newId
      );

      setWorkoutId(newId);
      setWorkoutTitle(finalTitle);
      setSelectedFolderId(finalFolderId);
      setSaveTitle(finalTitle);
      setSaveFolderId(finalFolderId);

      const preparedSavedBase =
        addIdsToBaseWorkout(saved);

      setUnalteredWorkout(saved);

      setBaseWorkout({
        ...preparedSavedBase,
        name: finalTitle,
      });

      // --------------------------------------------------------
      // Refresh saved workouts list
      // --------------------------------------------------------

      console.log(
        '[Save Flow] Step 10: Refreshing workout list...'
      );

      const updatedData =
        await fetchWorkoutsApi();

      const workoutsArray =
        Array.isArray(updatedData)
          ? updatedData
          : updatedData?.workouts || [];

      setSavedWorkouts(workoutsArray);

      console.log(
        '[Save Flow] Step 11: Workout list refreshed',
        {
          workoutCount: workoutsArray.length,
        }
      );

      setIsSaveModalOpen(false);
      setIsSaveAsMode(false);
      setMode('SAVED');

      console.log(
        '[Save Flow] Step 12: SAVE COMPLETE'
      );

      showToast(
        isSaveAsMode
          ? 'Workout saved as new file!'
          : 'Workout saved successfully!'
      );
    } catch (err) {
      console.error(
        '[Save Flow] SAVE FAILED:',
        err
      );

      console.error(
        '[Save Flow] Error details:',
        {
          message: err?.message,
          stack: err?.stack,
        }
      );

      showToast(
        `Failed to save workout: ${
          err?.message || 'Unknown error'
        }`
      );
    } finally {
      setIsSaving(false);

      console.log(
        '[Save Flow] Save operation finished; isSaving reset'
      );
    }
  };

  // ============================================================
  // DUPLICATE WORKOUT
  // ============================================================

  const handleDuplicateWorkout = () => {
    console.log(
      '[App Debug WorkoutBuilder] handleDuplicateWorkout invoked'
    );

    if (!baseWorkout) {
      showToast('No workout is currently loaded.');
      return;
    }

    const duplicateTitle =
      `${workoutTitle || 'Workout'} (Copy)`;

    setSaveTitle(duplicateTitle);
    setSaveFolderId(selectedFolderId || '');
    setWorkoutTitle(duplicateTitle);

    setMode('BUILDING');

    handleOpenSaveModal(true);
  };

  // ============================================================
  // COPY WORKOUT TEXT
  // ============================================================

  const handleCopyWorkoutText = async () => {
    console.log(
      '[App Debug WorkoutBuilder] handleCopyWorkoutText invoked'
    );

    try {
      const { convertWorkoutToTargetFormat } =
        await import('../utils/WorkoutConverter.js');

      const textOutput =
        convertWorkoutToTargetFormat(
          steps,
          workoutMode,
          paceMethod
        );

      const stringified =
        typeof textOutput === 'object'
          ? JSON.stringify(
              textOutput,
              null,
              2
            )
          : textOutput;

      await navigator.clipboard.writeText(
        stringified
      );

      showToast(
        'Workout plain text copied to clipboard!'
      );
    } catch (err) {
      console.error(
        '[App Debug WorkoutBuilder] Copy workout failed:',
        err
      );

      showToast(
        'Failed to copy workout text.'
      );
    }
  };

  // ============================================================
  // FILE DOWNLOAD
  // ============================================================

  const triggerFileDownload = (
    content,
    fileName,
    mimeType
  ) => {
    console.log(
      '[App Debug WorkoutBuilder] triggerFileDownload invoked',
      {
        fileName,
        mimeType,
      }
    );

    const blob = new Blob(
      [content],
      { type: mimeType }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const handleDownloadIcu = async () => {
    console.log(
      '[App Debug WorkoutBuilder] handleDownloadIcu invoked'
    );

    const {
      convertWorkoutToTargetFormat,
    } = await import(
      '../utils/WorkoutConverter.js'
    );

    const textOutput =
      convertWorkoutToTargetFormat(
        steps,
        workoutMode,
        paceMethod
      );

    const content =
      typeof textOutput === 'object'
        ? JSON.stringify(
            textOutput,
            null,
            2
          )
        : textOutput;

    const cleanTitle =
      workoutTitle
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();

    triggerFileDownload(
      content,
      `${cleanTitle}.icu`,
      'text/plain'
    );
  };

  const handleDownloadZwo = async () => {
    console.log(
      '[App Debug WorkoutBuilder] handleDownloadZwo invoked'
    );

    const {
      convertWorkoutToTargetFormat,
    } = await import(
      '../utils/WorkoutConverter.js'
    );

    const zwoContent =
      convertWorkoutToTargetFormat(
        steps,
        workoutMode,
        'ZWO'
      );

    const cleanTitle =
      workoutTitle
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();

    triggerFileDownload(
      zwoContent,
      `${cleanTitle}.zwo`,
      'application/xml'
    );
  };

  // ============================================================
  // CREATE FOLDER
  // ============================================================

  const handleCreateFolder = async (
    folderName
  ) => {
    console.log(
      '[App Debug WorkoutBuilder] handleCreateFolder invoked:',
      folderName
    );

    try {
      const newFolder =
        await createFolderApi(
          folderName
        );

      if (newFolder) {
        const newId =
          newFolder.id ||
          newFolder._id;

        setFolders((prev) => [
          ...prev,
          newFolder,
        ]);

        setSelectedFolderId(newId);
        setSaveFolderId(newId);
        setIsFolderModalOpen(false);

        showToast(
          `Folder "${folderName}" created.`
        );
      }
    } catch (err) {
      console.error(
        '[App Debug WorkoutBuilder] Error creating folder:',
        err
      );
    }
  };

  // ============================================================
  // CANCEL EDITS
  // ============================================================

  const handleCancelEdits = () => {
    console.log(
      '[App Debug WorkoutBuilder] handleCancelEdits invoked'
    );

    if (workoutId) {
      handleSelectWorkout(workoutId);
      showToast(
        'Reverted edits back to saved state.'
      );
    } else {
      handleNewWorkout();
    }
  };

  // ============================================================
  // CLOSE WORKOUT
  // ============================================================

  const handleCloseWorkout = () => {
    console.log(
      '[App Debug WorkoutBuilder] handleCloseWorkout invoked'
    );

    setWorkoutId(null);
    setBaseWorkout(null);
    setSteps([]);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setSelectedFolderId('');
    setMode('EMPTY');
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className="workout-builder-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {statusMessage && (
        <div className="status-message-banner">
          {statusMessage}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* LEFT MAIN PANEL */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* HEADER */}
          <div
            className="builder-fixed-header-section"
            style={{
              backgroundColor: '#fff',
              boxShadow:
                '0px 2px 5px rgba(0,0,0,0.05)',
              paddingBottom: '8px',
              paddingLeft: '16px',
              paddingRight: '16px',
            }}
          >
            <div className="builder-header-bar">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <h1 className="builder-header-title">
                  Workout Builder:
                </h1>

                <input
                  type="text"
                  value={workoutTitle}
                  onChange={(e) => {
                    console.log(
                      '[App Debug WorkoutBuilder] workoutTitle changed:',
                      e.target.value
                    );

                    setWorkoutTitle(
                      e.target.value
                    );

                    setSaveTitle(
                      e.target.value
                    );
                  }}
                  placeholder="Workout Title"
                  className="workout-title-input"
                  style={{
                    fontSize: '18px',
                    padding: '4px 8px',
                    fontWeight: 'bold',
                  }}
                />
              </div>

              <OptionsMenu
                mode={mode}
                onStartCreateNew={
                  handleNewWorkout
                }
                onOpenSelectModal={() => {
                  console.log(
                    '[App Debug WorkoutBuilder] OptionsMenu -> Open Select'
                  );

                  setIsEditModalOpen(true);
                }}
                onOpenCreateFolderModal={() => {
                  console.log(
                    '[App Debug WorkoutBuilder] OptionsMenu -> Create Folder'
                  );

                  setIsFolderModalOpen(true);
                }}
                onOpenSaveModal={
                  handleOpenSaveModal
                }
                onDuplicateWorkout={
                  handleDuplicateWorkout
                }
                onCopyWorkoutText={
                  handleCopyWorkoutText
                }
                onDownloadIcu={
                  handleDownloadIcu
                }
                onDownloadZwo={
                  handleDownloadZwo
                }
                onCancelEdits={
                  handleCancelEdits
                }
                onCloseWorkout={
                  handleCloseWorkout
                }
              />
            </div>

            {mode !== 'EMPTY' && (
              <div
                className="chart-preview-container"
                style={{
                  margin: '8px 0',
                  cursor: 'pointer',
                }}
              >
                <WorkoutChart
                  workout={baseWorkout}
                  thresholdPace={
                    paces?.threshold_pace || 400
                  }
                  chartHeight="140px"
                  showBarPace={false}
                />

                <WorkoutTextSection
                  workout={baseWorkout}
                  threshold={
                    paces?.threshold_pace
                  }
                  paceDetails={paces}
                />
              </div>
            )}
          </div>

          {/* SCROLLABLE STEPS */}
          <div
            className="builder-scrollable-content"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
            }}
          >
            {mode === 'EMPTY' ? (
              <div className="empty-state-card">
                <h3>
                  No Workout Selected
                </h3>

                <p>
                  Select an existing workout
                  from Options or create a
                  new one to get started.
                </p>

                <button
                  className="btn-primary"
                  onClick={
                    handleNewWorkout
                  }
                >
                  + Create New Workout
                </button>
              </div>
            ) : (
              <div>
                <div
                  className="steps-list-container"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    console.log(
                      '[App Debug WorkoutBuilder] Root steps drop'
                    );

                    handleDrop(
                      e,
                      null,
                      baseWorkout?.workout_doc
                        ?.steps?.length || 0
                    );
                  }}
                >
                  {baseWorkout?.workout_doc?.steps?.map(
                    (step, index) => (
                      <RenderStepRow
                        key={
                          step.id ||
                          `step-${index}`
                        }
                        step={step}
                        index={index}
                        parentId={null}
                        paceDetails={paces}
                        onRemove={removeStep}
                        onUpdate={
                          updateStepField
                        }
                        onAddChild={addStep}
                        onDragStart={
                          handleDragStart
                        }
                        onDrop={
                          handleDrop
                        }
                      />
                    )
                  )}
                </div>

                <div
                  className="root-add-actions"
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  <button
                    className="btn-add-step"
                    onClick={() => {
                      console.log(
                        '[App Debug WorkoutBuilder] Add Run'
                      );

                      addStep(
                        'run',
                        null
                      );
                    }}
                  >
                    + Add Run
                  </button>

                  <button
                    className="btn-add-step"
                    onClick={() => {
                      console.log(
                        '[App Debug WorkoutBuilder] Add Recovery'
                      );

                      addStep(
                        'recovery',
                        null
                      );
                    }}
                  >
                    + Add Recovery
                  </button>

                  <button
                    className="btn-add-step"
                    onClick={() => {
                      console.log(
                        '[App Debug WorkoutBuilder] Add Repeat'
                      );

                      addStep(
                        'repeat',
                        null
                      );
                    }}
                  >
                    + Add Repeat Block
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT LIVE BASEWORKOUT PANEL */}
        <div
          className="baseworkout-column-container"
          style={{
            width:
              isRightPanelCollapsed
                ? '40px'
                : '400px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fafafa',
            borderLeft:
              '1px solid #e0e0e0',
            padding:
              isRightPanelCollapsed
                ? '16px 8px'
                : '16px',
            transition:
              'width 0.2s ease-in-out',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              marginBottom:
                isRightPanelCollapsed
                  ? '0px'
                  : '8px',
            }}
          >
            {!isRightPanelCollapsed && (
              <label
                htmlFor="baseworkout-input"
                style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                }}
              >
                Updated Live
              </label>
            )}

            <button
              type="button"
              onClick={() => {
                console.log(
                  '[App Debug WorkoutBuilder] Toggle panel collapse'
                );

                setIsRightPanelCollapsed(
                  (prev) => !prev
                );
              }}
              title={
                isRightPanelCollapsed
                  ? 'Expand Panel'
                  : 'Collapse Panel'
              }
              style={{
                background: 'none',
                border:
                  '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '12px',
                marginLeft:
                  isRightPanelCollapsed
                    ? 'auto'
                    : '0',
                marginRight:
                  isRightPanelCollapsed
                    ? 'auto'
                    : '0',
              }}
            >
              {isRightPanelCollapsed
                ? '◀'
                : '▶'}
            </button>
          </div>

          {!isRightPanelCollapsed && (
            <textarea
              id="baseworkout-input"
              readOnly
              value={JSON.stringify(
                baseWorkout || {},
                null,
                2
              )}
              placeholder="No baseWorkout payload available..."
              style={{
                width: '100%',
                flex: 1,
                fontFamily:
                  'monospace',
                fontSize: '12px',
                padding: '12px',
                backgroundColor:
                  '#f4f4f6',
                border:
                  '1px solid #ccc',
                borderRadius: '4px',
                resize: 'none',
                overflowY: 'auto',
              }}
            />
          )}
        </div>
      </div>

      {/* FOLDER MODAL */}
      {isFolderModalOpen && (
        <Modal_Folder_Create
          onClose={() => {
            setIsFolderModalOpen(false);
          }}
          onCreate={
            handleCreateFolder
          }
        />
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <Modal_Workout_Edit
          isOpen={isEditModalOpen}
          workouts={savedWorkouts}
          folders={folders}
          currentFolderId={
            selectedFolderId
          }
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onSelectWorkout={
            handleSelectWorkout
          }
          onClose={() => {
            setIsEditModalOpen(false);
          }}
        />
      )}

      {/* SAVE MODAL */}
      {isSaveModalOpen && (
        <Modal_Workout_Save
          isOpen={isSaveModalOpen}
          saveAsNew={isSaveAsMode}
          saveTitle={saveTitle}
          setSaveTitle={setSaveTitle}
          saveFolderId={saveFolderId}
          setSaveFolderId={
            setSaveFolderId
          }
          folders={folders}
          apiLoading={isSaving}
          onConfirmSave={
            handleSaveWorkout
          }
          onClose={() => {
            console.log(
              '[Save Flow] Save modal cancelled'
            );

            if (!isSaving) {
              setIsSaveModalOpen(false);
              setIsSaveAsMode(false);
            }
          }}
        />
      )}

      {/* ZOOM MODAL */}
      {isZoomModalOpen && (
        <Modal_Workout_Zoom
          steps={steps}
          workoutMode={workoutMode}
          presets={dynamicPresets}
          onClose={() => {
            setIsZoomModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
