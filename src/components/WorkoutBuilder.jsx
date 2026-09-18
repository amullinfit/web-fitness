import React, { useState, useMemo, useEffect } from 'react';
import './WorkoutBuilder.css';

const VAL_WORKOUTBUILDER_URL = '/api/val-workoutbuilder';
const VAL_MY_PACES_URL = '/api/val-my-paces';

const DEFAULT_THRESHOLD = 480; // 8:00/mi default fallback

// Color mapping for preset buttons and charts based on pace/zone
const PRESET_COLORS = [
  '#6c757d', // Grey / Warmup / Z1
  '#28a745', // Green / Z2
  '#ffc107', // Yellow / Z3
  '#fd7e14', // Orange / Z4
  '#dc3545', // Red / Z5
  '#007bff', // Blue / Extra
  '#17a2b8', // Cyan / Extra
];

// --- API Functions ---
async function fetchFoldersApi() {
  const res = await fetch(`${VAL_WORKOUTBUILDER_URL}?action=get_folders`, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch folders');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.folders || []);
}

async function fetchWorkoutsApi(folderId = null) {
  const url = folderId 
    ? `${VAL_WORKOUTBUILDER_URL}?action=get_workouts&folder_id=${folderId}` 
    : `${VAL_WORKOUTBUILDER_URL}?action=get_workouts`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch workouts');
  const data = await res.json();
  if (data && Array.isArray(data.children)) return data.children;
  return Array.isArray(data) ? data : (data.workouts || []);
}

async function createFolderApi(folderName) {
  const res = await fetch(VAL_WORKOUTBUILDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_folder', name: folderName, type: 'FOLDER' }),
  });
  if (!res.ok) {
    let errorDetails = '';
    try {
      const errJson = await res.json();
      errorDetails = JSON.stringify(errJson.details || errJson, null, 2);
    } catch {
      errorDetails = await res.text();
    }
    throw new Error(`Server returned status ${res.status}:\n${errorDetails}`);
  }
  return await res.json();
}

async function saveWorkoutApi(action, workoutId, workoutData) {
  const method = action === 'update_workout' ? 'PUT' : 'POST';
  const res = await fetch(VAL_WORKOUTBUILDER_URL, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, workoutId, workoutData }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to ${action === 'update_workout' ? 'update' : 'create'} workout: ${errorText}`);
  }
  return await res.json();
}

async function fetchMyPacesApi() {
  const res = await fetch(VAL_MY_PACES_URL, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch paces from Intervals.icu');
  return await res.json();
}

// --- Helpers ---
const formatTime = (totalSeconds) => {
  const sec = Math.max(0, Math.round(totalSeconds || 0));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatMMSS = (totalSeconds) => {
  const sec = Math.max(0, Math.round(totalSeconds || 0));
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const parseMMSS = (str) => {
  if (!str) return 0;
  const cleanStr = String(str).trim();
  if (cleanStr.includes(':')) {
    const parts = cleanStr.split(':');
    if (parts.length === 3) {
      return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseInt(parts[2], 10) || 0);
    }
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  const num = parseInt(cleanStr, 10);
  if (isNaN(num)) return 0;
  if (num < 100) return num * 60;
  const mins = Math.floor(num / 100);
  const secs = num % 100;
  return mins * 60 + Math.min(secs, 59);
};

const formatDistance = (miles) => (miles || 0).toFixed(2) + ' mi';

const createStep = (type, mode = 'time') => {
  const id = `step-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const durationSec = mode === 'time' ? 600 : 0;
  const distanceMiles = mode === 'distance' ? 1.0 : 0;

  switch (type) {
    case 'warmup': return { id, type: 'warmup', durationSec, distanceMiles, targetPaceSec: 540 };
    case 'run': return { id, type: 'run', durationSec, distanceMiles, targetPaceSec: 480 };
    case 'recovery': return { id, type: 'recovery', durationSec: mode === 'time' ? 120 : 0, distanceMiles: mode === 'distance' ? 0.25 : 0, targetPaceSec: 660 };
    case 'cooldown': return { id, type: 'cooldown', durationSec, distanceMiles, targetPaceSec: 540 };
    case 'repeat':
      return {
        id,
        type: 'repeat',
        iterations: 3,
        steps: [
          { id: `${id}-1`, type: 'run', durationSec, distanceMiles, targetPaceSec: 480 },
          { id: `${id}-2`, type: 'recovery', durationSec: mode === 'time' ? 120 : 0, distanceMiles: mode === 'distance' ? 0.25 : 0, targetPaceSec: 660 }
        ],
      };
    default: return { id, type: 'run', durationSec, distanceMiles, targetPaceSec: 480 };
  }
};

const createDefaultSteps = (mode = 'time') => [
  createStep('warmup', mode),
  createStep('repeat', mode),
  createStep('cooldown', mode),
];

const mapIcuDocToSteps = (workout) => {
  const stepsSource = workout?.workout_doc?.steps || workout?.steps;
  if (!Array.isArray(stepsSource) || stepsSource.length === 0) {
    return createDefaultSteps('time');
  }

  const mapStep = (s, idx) => {
    const id = `step-loaded-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
    if (s.reps && Array.isArray(s.steps)) {
      return {
        id,
        type: 'repeat',
        iterations: s.reps,
        steps: s.steps.map(mapStep),
      };
    }

    let type = 'run';
    if (s.warmup || s.intensity === 'warmup') type = 'warmup';
    else if (s.cooldown || s.intensity === 'cooldown') type = 'cooldown';
    else if (s.intensity === 'rest') type = 'recovery';

    let targetPaceSec = 480;
    if (s.pace?.value) targetPaceSec = s.pace.value;
    else if (s.pace?.start) targetPaceSec = s.pace.start;

    const durationSec = s.duration || 300;
    const distanceMiles = s.distance ? s.distance / 1609.344 : (durationSec / targetPaceSec);

    return {
      id,
      type,
      durationSec,
      distanceMiles,
      targetPaceSec,
    };
  };

  return stepsSource.map(mapStep);
};

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function WorkoutBuilder() {
  const [mode, setMode] = useState('EMPTY');
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  const [workoutId, setWorkoutId] = useState(null);
  const [workoutTitle, setWorkoutTitle] = useState('New Workout');
  const [workoutDescription, setWorkoutDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [steps, setSteps] = useState([]);

  // New Workout settings state
  const [workoutMode, setWorkoutMode] = useState('time'); // 'time' | 'distance'
  const [paceMethod, setPaceMethod] = useState('Pace'); 

  // Intervals.icu data
  const [icuPacesData, setIcuPacesData] = useState(null);
  const [thresholdPaceSec, setThresholdPaceSec] = useState(DEFAULT_THRESHOLD);

  const [originalWorkoutSnapshot, setOriginalWorkoutSnapshot] = useState(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);

  const [folders, setFolders] = useState([]);
  const [workoutsList, setWorkoutsList] = useState([]);
  const [selectedEditFolderId, setSelectedEditFolderId] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
  const [saveFolderId, setSaveFolderId] = useState('');
  const [inlineFolderInput, setInlineFolderInput] = useState('');
  const [showInlineFolderInput, setShowInlineFolderInput] = useState(false);

  const [apiLoading, setApiLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Fetch Intervals.icu paces on initial mount
  useEffect(() => {
    async function loadPaces() {
      try {
        const data = await fetchMyPacesApi();
        setIcuPacesData(data);
        if (data.threshold_pace || data.thresholdPace) {
          setThresholdPaceSec(data.threshold_pace || data.thresholdPace);
        }
      } catch (err) {
        console.warn('Could not fetch Intervals.icu paces, using defaults:', err.message);
      }
    }
    loadPaces();
  }, []);

  // Compute preset list dynamically based on paceMethod and icuPacesData
  const dynamicPresets = useMemo(() => {
    const rawPaces = icuPacesData?.paces || icuPacesData?.zones || [];

    if (rawPaces.length > 0) {
      return rawPaces.map((p, idx) => {
        const color = PRESET_COLORS[idx % PRESET_COLORS.length];
        const paceVal = p.paceSec || p.value || DEFAULT_THRESHOLD;
        const lowPace = p.lowPace || p.startPace || Math.round(paceVal * 0.95);
        const highPace = p.highPace || p.endPace || Math.round(paceVal * 1.05);
        const pctVal = Math.round((DEFAULT_THRESHOLD / paceVal) * 100);
        const pctLow = Math.round((DEFAULT_THRESHOLD / highPace) * 100);
        const pctHigh = Math.round((DEFAULT_THRESHOLD / lowPace) * 100);

        let label = p.name || p.label || `Zone ${idx + 1}`;
        let displayPace = formatMMSS(paceVal);

        switch (paceMethod) {
          case 'Pace Range':
            displayPace = `${formatMMSS(lowPace)}-${formatMMSS(highPace)}`;
            break;
          case 'Zone':
            label = p.zoneName || `Z${idx + 1}`;
            displayPace = formatMMSS(paceVal);
            break;
          case 'Zone Range':
            label = p.zoneName || `Z${idx + 1}`;
            displayPace = `${formatMMSS(lowPace)}-${formatMMSS(highPace)}`;
            break;
          case 'Threshold %':
            displayPace = `${pctVal}%`;
            break;
          case 'Theshold % Range':
          case 'Threshold % Range':
            displayPace = `${pctLow}%-${pctHigh}%`;
            break;
          case 'Pace':
          default:
            displayPace = formatMMSS(paceVal);
            break;
        }

        return {
          label,
          displayPace,
          targetPaceSec: paceVal,
          color,
        };
      });
    }

    // Default Fallback presets if API call failed
    const defaultPaces = [
      { label: 'Easy', mult: 1.20, color: PRESET_COLORS[0] },
      { label: 'Marathon', mult: 1.08, color: PRESET_COLORS[1] },
      { label: 'Tempo', mult: 1.05, color: PRESET_COLORS[2] },
      { label: 'Threshold', mult: 1.00, color: PRESET_COLORS[3] },
      { label: 'Half', mult: 0.97, color: PRESET_COLORS[4] },
      { label: '10K', mult: 0.94, color: PRESET_COLORS[5] },
      { label: '5K', mult: 0.90, color: PRESET_COLORS[6] },
    ];

    return defaultPaces.map((p) => {
      const paceVal = Math.round(thresholdPaceSec * p.mult);
      let displayPace = formatMMSS(paceVal);

      if (paceMethod.includes('Range')) {
        displayPace = `${formatMMSS(Math.round(paceVal * 0.97))}-${formatMMSS(Math.round(paceVal * 1.03))}`;
      } else if (paceMethod.includes('Threshold %')) {
        const pct = Math.round((thresholdPaceSec / paceVal) * 100);
        displayPace = `${pct}%`;
      }

      return {
        label: p.label,
        displayPace,
        targetPaceSec: paceVal,
        color: p.color,
      };
    });
  }, [icuPacesData, thresholdPaceSec, paceMethod]);

  const loadFolders = async () => {
    try {
      const list = await fetchFoldersApi();
      setFolders(list);
      return list;
    } catch (err) {
      setStatusMessage(`Error loading folders: ${err.message}`);
      return [];
    }
  };

  const handleStartCreateNew = () => {
    setWorkoutId(null);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setSelectedFolderId('');
    setSteps(createDefaultSteps(workoutMode));
    setOriginalWorkoutSnapshot(null);
    setMode('CREATING');
    setIsOptionsMenuOpen(false);
  };

  const handleOpenEditModal = async () => {
    setIsOptionsMenuOpen(false);
    setApiLoading(true);
    try {
      const folderList = await loadFolders();
      if (folderList.length > 0) {
        const initialFolder = folderList[0];
        setSelectedEditFolderId(initialFolder.id);

        if (Array.isArray(initialFolder.children)) {
          setWorkoutsList(initialFolder.children);
        } else {
          const wList = await fetchWorkoutsApi(initialFolder.id);
          setWorkoutsList(wList);
        }
      }
      setIsEditModalOpen(true);
    } catch (err) {
      setStatusMessage(`Error opening edit dialog: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSelectWorkoutToEdit = (workout) => {
    try {
      const loadedSteps = mapIcuDocToSteps(workout);
      setWorkoutId(workout.id);
      setWorkoutTitle(workout.name || 'Untitled Workout');
      setWorkoutDescription(workout.workout_doc?.description || workout.description || '');
      setSelectedFolderId(workout.folder_id || '');
      setSteps(loadedSteps);

      setOriginalWorkoutSnapshot({
        id: workout.id,
        name: workout.name || 'Untitled Workout',
        workoutDescription: workout.workout_doc?.description || workout.description || '',
        folder_id: workout.folder_id || '',
        steps: JSON.parse(JSON.stringify(loadedSteps)),
      });

      setMode('EDITING');
      setIsEditModalOpen(false);
    } catch (err) {
      setStatusMessage(`Failed to load selected workout: ${err.message}`);
    }
  };

  const hasUnsavedChanges = () => {
    if (mode === 'CREATING') {
      return steps.length > 0 || workoutTitle !== 'New Workout' || workoutDescription !== '';
    }
    if (mode === 'EDITING' && originalWorkoutSnapshot) {
      const currentSnapshot = {
        id: workoutId,
        name: workoutTitle,
        workoutDescription,
        folder_id: selectedFolderId,
        steps,
      };
      return JSON.stringify(currentSnapshot) !== JSON.stringify(originalWorkoutSnapshot);
    }
    return false;
  };

  const handleDuplicateWorkout = () => {
    setIsOptionsMenuOpen(false);
    const newTitle = workoutTitle ? `${workoutTitle} (Copy)` : 'New Workout (Copy)';
    setMode('CREATING');
    setWorkoutId(null);
    setWorkoutTitle(newTitle);
    setSteps(JSON.parse(JSON.stringify(steps)));
    setOriginalWorkoutSnapshot(null);
    setStatusMessage(`Duplicated workout as "${newTitle}". Save when ready.`);
  };

  const handleCloseWorkout = () => {
    setIsOptionsMenuOpen(false);
    if (hasUnsavedChanges()) {
      const confirmClose = window.confirm(
        'You have unsaved changes in this workout. Are you sure you want to close it and lose your changes?'
      );
      if (!confirmClose) return;
    }
    setMode('EMPTY');
    setWorkoutId(null);
    setWorkoutTitle('New Workout');
    setWorkoutDescription('');
    setSelectedFolderId('');
    setSteps([]);
    setOriginalWorkoutSnapshot(null);
    setStatusMessage('Closed current workout.');
  };

  const handleCancelEdits = () => {
    setIsOptionsMenuOpen(false);
    if (!originalWorkoutSnapshot) {
      setMode('EMPTY');
      setSteps([]);
      return;
    }
    setWorkoutId(originalWorkoutSnapshot.id);
    setWorkoutTitle(originalWorkoutSnapshot.name);
    setWorkoutDescription(originalWorkoutSnapshot.workoutDescription);
    setSelectedFolderId(originalWorkoutSnapshot.folder_id);
    setSteps(JSON.parse(JSON.stringify(originalWorkoutSnapshot.steps)));
    setStatusMessage('Reverted edits to original state.');
  };

  const handleOpenCreateFolderModal = () => {
    setIsOptionsMenuOpen(false);
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  const handleCreateFolderSubmit = async () => {
    if (!newFolderName.trim()) return;
    setApiLoading(true);
    try {
      const createdFolder = await createFolderApi(newFolderName);
      setFolders((prev) => [...prev, createdFolder]);
      setStatusMessage(`Created folder "${createdFolder.name || newFolderName}" successfully.`);
      setIsFolderModalOpen(false);
      setNewFolderName('');
    } catch (err) {
      setStatusMessage(`Error creating folder: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const handleOpenSaveModal = async (asNew = false) => {
    setIsOptionsMenuOpen(false);
    setSaveAsNew(asNew);
    setSaveTitle(asNew ? `${workoutTitle} (Copy)` : workoutTitle);

    setApiLoading(true);
    const loadedFolders = await loadFolders();
    setSaveFolderId(selectedFolderId || (loadedFolders.length > 0 ? loadedFolders[0].id : ''));
    setShowInlineFolderInput(false);
    setApiLoading(false);

    setIsSaveModalOpen(true);
  };

  const handleCreateInlineFolder = async () => {
    if (!inlineFolderInput.trim()) return;
    setApiLoading(true);
    try {
      const createdFolder = await createFolderApi(inlineFolderInput);
      setFolders((prev) => [...prev, createdFolder]);
      setSaveFolderId(createdFolder.id);
      setInlineFolderInput('');
      setShowInlineFolderInput(false);
    } catch (err) {
      setStatusMessage(`Error creating folder: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  // Calculates time/distance totals respecting workoutMode
  const calculateTotals = (stepList, currentMode = workoutMode) => {
    let totalSec = 0;
    let totalMiles = 0;

    if (!Array.isArray(stepList)) return { totalSec, totalMiles };

    stepList.forEach((step) => {
      if (step.type === 'repeat') {
        const nested = calculateTotals(step.steps || [], currentMode);
        totalSec += nested.totalSec * (step.iterations || 1);
        totalMiles += nested.totalMiles * (step.iterations || 1);
      } else {
        const pace = step.targetPaceSec || 1;
        if (currentMode === 'distance') {
          const miles = step.distanceMiles || 0;
          totalMiles += miles;
          totalSec += miles * pace;
        } else {
          const sec = step.durationSec || 0;
          totalSec += sec;
          totalMiles += sec / pace;
        }
      }
    });

    return { totalSec, totalMiles };
  };

  const totals = useMemo(() => calculateTotals(steps, workoutMode), [steps, workoutMode]);

  const generateIcuText = (stepList) => {
    if (!Array.isArray(stepList)) return '';
    const lines = [];

    const processSteps = (list) => {
      list.forEach((s) => {
        if (s.type === 'repeat') {
          lines.push(`\n${s.iterations}x`);
          processSteps(s.steps || []);
          lines.push('');
        } else {
          const durStr = workoutMode === 'distance' 
            ? `${(s.distanceMiles || 0).toFixed(2)}mi` 
            : formatTime(s.durationSec);
          lines.push(`- ${durStr} @ ${formatMMSS(s.targetPaceSec)} Pace (${s.type})`);
        }
      });
    };

    processSteps(stepList);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const generateZwoXml = () => {
    const zwoSteps = steps.map((step) => {
      const durSec = workoutMode === 'time'
        ? (step.durationSec || 0)
        : Math.round((step.distanceMiles || 0) * (step.targetPaceSec || DEFAULT_THRESHOLD));

      const targetPace = step.targetPaceSec || thresholdPaceSec;
      const powerFraction = (thresholdPaceSec / targetPace).toFixed(2);

      if (step.type === 'warmup') {
        return `    <Warmup Duration="${durSec}" PowerLow="0.50" PowerHigh="${powerFraction}"/>`;
      } else if (step.type === 'cooldown') {
        return `    <Cooldown Duration="${durSec}" PowerLow="${powerFraction}" PowerHigh="0.50"/>`;
      } else {
        return `    <SteadyState Duration="${durSec}" Power="${powerFraction}"/>`;
      }
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>Workout Builder</author>
  <name>${workoutTitle || 'Workout'}</name>
  <description>${workoutDescription || ''}</description>
  <sportType>run</sportType>
  <workout>
${zwoSteps}
  </workout>
</workout_file>`;
  };

  const handleCopyWorkoutText = () => {
    setIsOptionsMenuOpen(false);
    const text = generateIcuText(steps);
    navigator.clipboard.writeText(text);
    setStatusMessage('Workout text copied to clipboard!');
  };

  const handleDownloadIcu = () => {
    setIsOptionsMenuOpen(false);
    const text = generateIcuText(steps);
    const filename = `${(workoutTitle || 'workout').toLowerCase().replace(/\s+/g, '_')}.icu`;
    downloadFile(text, filename, 'text/plain;charset=utf-8');
    setStatusMessage(`Downloaded ${filename}`);
  };

  const handleDownloadZwo = () => {
    setIsOptionsMenuOpen(false);
    const xml = generateZwoXml();
    const filename = `${(workoutTitle || 'workout').toLowerCase().replace(/\s+/g, '_')}.zwo`;
    downloadFile(xml, filename, 'application/xml;charset=utf-8');
    setStatusMessage(`Downloaded ${filename}`);
  };

  const workoutPayloadObject = useMemo(() => {
    const METERS_PER_MILE = 1609.344;

    const buildIcuStep = (step) => {
      if (step.type === 'repeat') {
        const childIcuSteps = (step.steps || []).map(buildIcuStep);
        let repeatSecs = 0;
        let repeatMiles = 0;

        (step.steps || []).forEach((child) => {
          const p = child.targetPaceSec || 1;
          if (workoutMode === 'distance') {
            const m = child.distanceMiles || 0;
            repeatMiles += m;
            repeatSecs += m * p;
          } else {
            const s = child.durationSec || 0;
            repeatSecs += s;
            repeatMiles += s / p;
          }
        });

        return {
          reps: step.iterations || 1,
          text: `Repeats ${step.iterations || 1}x`,
          steps: childIcuSteps,
          distance: repeatMiles * (step.iterations || 1) * METERS_PER_MILE,
          duration: repeatSecs * (step.iterations || 1),
        };
      }

      const stepSecs = workoutMode === 'distance' 
        ? (step.distanceMiles || 0) * (step.targetPaceSec || 1) 
        : (step.durationSec || 0);

      const baseStep = {
        duration: stepSecs,
        pace: { units: 'secs', value: step.targetPaceSec || 0 },
      };

      if (step.type === 'warmup') {
        baseStep.warmup = true;
        baseStep.intensity = 'warmup';
      } else if (step.type === 'cooldown') {
        baseStep.cooldown = true;
        baseStep.intensity = 'cooldown';
      } else if (step.type === 'recovery') {
        baseStep.intensity = 'rest';
      }

      return baseStep;
    };

    const icuSteps = (steps || []).map(buildIcuStep);
    const totalMeters = totals.totalMiles * METERS_PER_MILE;

    return {
      id: workoutId || 1,
      icu_training_load: Math.round(totals.totalSec / 60),
      name: workoutTitle,
      description: generateIcuText(steps),
      type: 'Run',
      indoor: false,
      color: null,
      moving_time: totals.totalSec,
      updated: new Date().toISOString(),
      joules: 0,
      joules_above_ftp: 0,
      workout_doc: {
        steps: icuSteps,
        locales: [],
        options: {},
        distance: totalMeters,
        duration: totals.totalSec,
        description: workoutDescription,
      },
      folder_id: saveFolderId ? Number(saveFolderId) : (selectedFolderId ? Number(selectedFolderId) : null),
      distance: Number(totalMeters.toFixed(3)),
    };
  }, [steps, workoutTitle, workoutDescription, totals, selectedFolderId, saveFolderId, workoutId, workoutMode]);

  const handleConfirmSaveWorkout = async () => {
    if (!saveTitle.trim()) {
      alert('Please enter a workout name.');
      return;
    }
    setApiLoading(true);
    setStatusMessage('Saving workout...');

    const targetWorkoutId = saveAsNew ? null : workoutId;
    const action = targetWorkoutId ? 'update_workout' : 'create_workout';

    try {
      const payload = { 
        ...workoutPayloadObject, 
        name: saveTitle, 
        folder_id: saveFolderId ? Number(saveFolderId) : null 
      };

      const result = await saveWorkoutApi(action, targetWorkoutId, payload);
      const finalId = result.id || targetWorkoutId;

      setWorkoutId(finalId);
      setWorkoutTitle(saveTitle);
      setSelectedFolderId(saveFolderId);

      setOriginalWorkoutSnapshot({
        id: finalId,
        name: saveTitle,
        workoutDescription,
        folder_id: saveFolderId,
        steps: JSON.parse(JSON.stringify(steps)),
      });

      setMode('EDITING');
      setIsSaveModalOpen(false);
      setStatusMessage(`Successfully saved workout "${saveTitle}"!`);
    } catch (err) {
      setStatusMessage(`Error saving workout: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  const addStep = (type, parentRepeatId = null) => {
    const newStep = createStep(type, workoutMode);
    if (!parentRepeatId) {
      setSteps([...steps, newStep]);
    } else {
      const addRecursive = (list) =>
        list.map((s) => {
          if (s.id === parentRepeatId && s.type === 'repeat') {
            return { ...s, steps: [...(s.steps || []), newStep] };
          }
          if (s.type === 'repeat') {
            return { ...s, steps: addRecursive(s.steps || []) };
          }
          return s;
        });
      setSteps(addRecursive(steps));
    }
  };

  const removeStep = (id) => {
    const filterRecursive = (list) =>
      list.filter((s) => s.id !== id).map((s) => (s.type === 'repeat' ? { ...s, steps: filterRecursive(s.steps || []) } : s));
    setSteps(filterRecursive(steps));
  };

  const updateStepField = (id, field, value) => {
    const updateRecursive = (list) =>
      list.map((s) => {
        if (s.id === id) return { ...s, [field]: value };
        if (s.type === 'repeat') return { ...s, steps: updateRecursive(s.steps || []) };
        return s;
      });
    setSteps(updateRecursive(steps));
  };

  const handleDragStart = (e, step, parentId) => {
    e.stopPropagation();
    setDraggedItem({ step, parentId });
  };

  const handleDrop = (e, targetParentId, targetIndex) => {
    e.stopPropagation();
    e.preventDefault();
    if (!draggedItem) return;

    const { step: itemToMove, parentId: sourceParentId } = draggedItem;

    const removeFromTree = (list, parentId, stepId) => {
      if (!parentId) return list.filter((s) => s.id !== stepId);
      return list.map((s) => {
        if (s.id === parentId && s.type === 'repeat') {
          return { ...s, steps: (s.steps || []).filter((child) => child.id !== stepId) };
        }
        if (s.type === 'repeat') {
          return { ...s, steps: removeFromTree(s.steps || [], parentId, stepId) };
        }
        return s;
      });
    };

    const insertIntoTree = (list, parentId, index, item) => {
      if (!parentId) {
        const copy = [...list];
        copy.splice(index, 0, item);
        return copy;
      }
      return list.map((s) => {
        if (s.id === parentId && s.type === 'repeat') {
          const nextSteps = [...(s.steps || [])];
          nextSteps.splice(index, 0, item);
          return { ...s, steps: nextSteps };
        }
        if (s.type === 'repeat') {
          return { ...s, steps: insertIntoTree(s.steps || [], parentId, index, item) };
        }
        return s;
      });
    };

    const treeWithoutItem = removeFromTree(steps, sourceParentId, itemToMove.id);
    setSteps(insertIntoTree(treeWithoutItem, targetParentId, targetIndex, itemToMove));
    setDraggedItem(null);
  };

  return (
    <div className="workout-builder-container">
      {/* Header Bar */}
      <div className="builder-header-bar">
        <h1 className="builder-header-title">Workout Builder</h1>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            className="options-menu-btn"
          >
            ⚙️ Options ▾
          </button>

          {isOptionsMenuOpen && (
            <div className="options-menu-dropdown">
              <button style={menuButtonStyle} onClick={handleStartCreateNew}>
                ➕ Create New Workout
              </button>
              <button style={menuButtonStyle} onClick={handleOpenEditModal}>
                ✏️ Edit Existing Workout
              </button>
              <button style={menuButtonStyle} onClick={handleOpenCreateFolderModal}>
                📁 Create New Folder
              </button>

              {(mode === 'CREATING' || mode === 'EDITING') && <div className="menu-divider" />}

              {(mode === 'CREATING' || mode === 'EDITING') && (
                <button style={menuButtonStyle} onClick={() => handleOpenSaveModal(false)}>
                  💾 Save Workout
                </button>
              )}
              {mode === 'EDITING' && (
                <button style={menuButtonStyle} onClick={() => handleOpenSaveModal(true)}>
                  📋 Save As New Workout
                </button>
              )}
              {(mode === 'CREATING' || mode === 'EDITING') && (
                <button style={menuButtonStyle} onClick={handleDuplicateWorkout}>
                  📄 Duplicate Workout
                </button>
              )}

              {(mode === 'CREATING' || mode === 'EDITING') && <div className="menu-divider" />}

              {(mode === 'CREATING' || mode === 'EDITING') && (
                <>
                  <button style={menuButtonStyle} onClick={handleCopyWorkoutText}>
                    📋 Copy Workout Text
                  </button>
                  <button style={menuButtonStyle} onClick={handleDownloadIcu}>
                    ⬇️ Download .icu File
                  </button>
                  <button style={menuButtonStyle} onClick={handleDownloadZwo}>
                    ⚡ Download .zwo File
                  </button>
                </>
              )}

              {(mode === 'CREATING' || mode === 'EDITING') && <div className="menu-divider" />}

              {mode === 'EDITING' && (
                <button style={{ ...menuButtonStyle, color: '#dc3545' }} onClick={handleCancelEdits}>
                  ↩️ Cancel Edits
                </button>
              )}
              {(mode === 'CREATING' || mode === 'EDITING') && (
                <button style={{ ...menuButtonStyle, color: '#6c757d' }} onClick={handleCloseWorkout}>
                  ✖️ Close Workout
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="status-message-banner">
          {statusMessage}
        </div>
      )}

      {mode === 'EMPTY' && (
        <div className="empty-state-card">
          <h3>No Workout Selected</h3>
          <p>Click the <strong>Options</strong> button above to create a new workout or edit an existing one.</p>
        </div>
      )}

      {(mode === 'CREATING' || mode === 'EDITING') && (
        <div>
          {/* Controls Bar: Time/Distance Toggle & Pace Method Dropdown */}
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

          <div className="builder-header">
            <input
              type="text"
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              className="builder-title-input"
              placeholder="Workout Title"
            />
            <div className="builder-totals">
              Total Time: <strong className="total-time-val">{formatTime(totals.totalSec)}</strong> | Total Dist: <strong className="total-dist-val">{formatDistance(totals.totalMiles)}</strong>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="description-label">
              Workout Description
            </label>
            <textarea
              value={workoutDescription}
              onChange={(e) => setWorkoutDescription(e.target.value)}
              placeholder="Add an optional description or notes for this workout..."
              rows={2}
              className="description-textarea"
            />
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Workout Profile Chart</span>
              <button className="btn-zoom" onClick={() => setIsZoomOpen(true)}>🔍 Zoom Chart</button>
            </div>
            <RenderWorkoutChart steps={steps} height={120} workoutMode={workoutMode} />
          </div>

          <div className="action-bar">
            <button className="btn-add-step" onClick={() => addStep('warmup')}>+ Warmup</button>
            <button className="btn-add-step" onClick={() => addStep('run')}>+ Run</button>
            <button className="btn-add-step" onClick={() => addStep('recovery')}>+ Recovery</button>
            <button className="btn-add-step" onClick={() => addStep('cooldown')}>+ Cooldown</button>
            <button className="btn-add-step btn-add-repeat" onClick={() => addStep('repeat')}>+ Repeat Block</button>
          </div>

          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, null, steps.length)} style={{ minHeight: '120px', marginBottom: '24px' }}>
            {steps.map((step, index) => (
              <RenderStepRow
                key={step.id}
                step={step}
                index={index}
                parentId={null}
                workoutMode={workoutMode}
                presets={dynamicPresets}
                onRemove={removeStep}
                onUpdate={updateStepField}
                onAddChild={addStep}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
              />
            ))}
          </div>

          <div className="json-preview-container">
            <label className="json-preview-label">
              Intervals.icu JSON Representation (Read-Only)
            </label>
            <textarea
              readOnly
              value={JSON.stringify([workoutPayloadObject], null, 2)}
              rows={14}
              className="json-preview-textarea"
            />
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {isFolderModalOpen && (
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
              <button onClick={() => setIsFolderModalOpen(false)}>Cancel</button>
              <button onClick={handleCreateFolderSubmit} disabled={apiLoading} style={{ backgroundColor: '#007bff', color: '#fff' }}>
                {apiLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, width: '720px', maxWidth: '90vw' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Select Workout to Edit</h3>
            
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>
              1. Select Folder:
            </label>
            <select
              value={selectedEditFolderId}
              onChange={async (e) => {
                const folderId = e.target.value;
                setSelectedEditFolderId(folderId);
                setApiLoading(true);
                try {
                  const targetFolder = folders.find((f) => String(f.id) === String(folderId));
                  if (targetFolder && Array.isArray(targetFolder.children)) {
                    setWorkoutsList(targetFolder.children);
                  } else {
                    const wList = await fetchWorkoutsApi(folderId);
                    setWorkoutsList(wList);
                  }
                } catch (err) {
                  setStatusMessage(`Failed to fetch workouts: ${err.message}`);
                } finally {
                  setApiLoading(false);
                }
              }}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>
              2. Select Workout:
            </label>
            <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '16px' }}>
              {apiLoading ? (
                <p style={{ padding: '16px', color: '#888', margin: 0, textAlign: 'center' }}>Loading workouts...</p>
              ) : workoutsList.length === 0 ? (
                <p style={{ padding: '16px', color: '#888', margin: 0, textAlign: 'center' }}>No workouts found in this folder.</p>
              ) : (
                workoutsList.map((w) => {
                  const workoutSteps = mapIcuDocToSteps(w);
                  const wTotals = calculateTotals(workoutSteps, workoutMode);

                  return (
                    <div
                      key={w.id}
                      onClick={() => handleSelectWorkoutToEdit(w)}
                      className="workout-select-item"
                    >
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div className="workout-select-title">
                          {w.name || 'Untitled Workout'}
                        </div>
                      </div>

                      <div className="workout-select-meta">
                        <span>⏱️ {formatTime(w.moving_time || wTotals.totalSec)}</span>
                        <span>📏 {formatDistance(w.distance ? w.distance / 1609.344 : wTotals.totalMiles)}</span>
                      </div>

                      <div style={{ width: '120px', flexShrink: 0, height: '40px', display: 'flex', alignItems: 'flex-end' }}>
                        <RenderWorkoutChart steps={workoutSteps} height={40} workoutMode={workoutMode} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isSaveModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{saveAsNew ? 'Save As New Workout' : 'Save Workout'}</h3>

            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>Workout Name:</label>
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>Select Folder:</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <select
                value={saveFolderId}
                onChange={(e) => setSaveFolderId(e.target.value)}
                style={{ flex: 1, padding: '8px' }}
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
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
                <button onClick={handleCreateInlineFolder} disabled={apiLoading}>Create</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsSaveModalOpen(false)}>Cancel</button>
              <button onClick={handleConfirmSaveWorkout} disabled={apiLoading} style={{ backgroundColor: '#007bff', color: '#fff' }}>
                {apiLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isZoomOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsZoomOpen(false)}>
          <div style={{ ...modalContentStyle, width: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>{workoutTitle} - Profile View</h2>
              <button onClick={() => setIsZoomOpen(false)}>✕</button>
            </div>
            <RenderWorkoutChart steps={steps} height={280} workoutMode={workoutMode} />
          </div>
        </div>
      )}
    </div>
  );
}

const menuButtonStyle = {
  width: '100%',
  padding: '10px 14px',
  textAlign: 'left',
  border: 'none',
  backgroundColor: 'transparent',
  fontSize: '13px',
  cursor: 'pointer',
  borderBottom: '1px solid #f0f0f0',
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: '#ffffff',
  padding: '20px',
  borderRadius: '8px',
  width: '400px',
  boxShadow: '0px 10px 25px rgba(0,0,0,0.2)',
};

function MMSSInput({ valueSec, onChange }) {
  const [text, setText] = useState(formatMMSS(valueSec));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setText(formatMMSS(valueSec));
  }, [valueSec, isFocused]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    const parsedSec = parseMMSS(val);
    if (parsedSec >= 0) onChange(parsedSec);
  };

  return (
    <input
      type="text"
      value={text}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        const parsedSec = parseMMSS(text);
        setText(formatMMSS(parsedSec));
        onChange(parsedSec);
      }}
      className="time-pace-input"
    />
  );
}

function RenderStepRow({ step, index, parentId, workoutMode, presets, onRemove, onUpdate, onAddChild, onDragStart, onDrop }) {
  if (!step) return null;

  if (step.type === 'repeat') {
    const childSteps = step.steps || [];
    return (
      <div
        className="repeat-block-container"
        draggable
        onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop && onDrop(e, parentId, index)}
      >
        <div className="repeat-header">
          <span className="drag-handle">⣿</span>
          <strong className="repeat-type-title">Repeat Block</strong>
          <label style={{ fontSize: '12px' }}>
            Repeats:
            <input
              type="number"
              min="1"
              max="99"
              value={step.iterations || 1}
              onChange={(e) => onUpdate(step.id, 'iterations', parseInt(e.target.value, 10) || 1)}
              style={{ width: '44px', marginLeft: '4px' }}
            />
          </label>
          <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
        </div>

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop && onDrop(e, step.id, childSteps.length)}>
          {childSteps.map((childStep, childIdx) => (
            <RenderStepRow
              key={childStep.id || childIdx}
              step={childStep}
              index={childIdx}
              parentId={step.id}
              workoutMode={workoutMode}
              presets={presets}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => onAddChild('run', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>+ Add Run</button>
          <button onClick={() => onAddChild('recovery', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>+ Add Recovery</button>
        </div>
      </div>
    );
  }

  // Calculated counterpart display
  const calculatedMiles = (step.durationSec || 0) / (step.targetPaceSec || 1);
  const calculatedTimeSec = (step.distanceMiles || 0) * (step.targetPaceSec || 1);

  return (
    <div
      className="step-row-container"
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop && onDrop(e, parentId, index)}
    >
      {/* Top Row: Inputs */}
      <div className="step-row-inputs">
        <span className="drag-handle">⣿</span>
        <span className="step-type-label">{step.type || 'step'}</span>

        {workoutMode === 'time' ? (
          <label className="input-label">
            Time: <MMSSInput valueSec={step.durationSec} onChange={(newSec) => onUpdate(step.id, 'durationSec', newSec)} />
          </label>
        ) : (
          <label className="input-label">
            Dist:
            <input
              type="number"
              step="0.01"
              min="0"
              value={step.distanceMiles || 0}
              onChange={(e) => onUpdate(step.id, 'distanceMiles', parseFloat(e.target.value) || 0)}
              className="time-pace-input"
              style={{ width: '60px' }}
            />
            mi
          </label>
        )}

        <label className="input-label">
          Pace: <MMSSInput valueSec={step.targetPaceSec} onChange={(newSec) => onUpdate(step.id, 'targetPaceSec', newSec)} />
        </label>

        <span className="dist-display">
          {workoutMode === 'time'
            ? `Dist: ${formatDistance(calculatedMiles)}`
            : `Time: ${formatTime(calculatedTimeSec)}`}
        </span>

        <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
      </div>

      {/* Bottom Row: Dynamic Presets */}
      <div className="step-presets-row">
        <span style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold' }}>Presets:</span>
        {(presets || []).map((preset) => {
          const isSelected = Math.abs((step.targetPaceSec || 0) - preset.targetPaceSec) < 3;

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onUpdate(step.id, 'targetPaceSec', preset.targetPaceSec)}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '12px',
                border: `1px solid ${preset.color}`,
                backgroundColor: isSelected ? preset.color : '#ffffff',
                color: isSelected ? '#ffffff' : preset.color,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {preset.label} ({preset.displayPace})
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RenderWorkoutChart({ steps, height, workoutMode }) {
  const flattenSteps = (list) => {
    let result = [];
    if (!Array.isArray(list)) return result;

    list.forEach((s) => {
      if (s.type === 'repeat') {
        const reps = s.iterations || 1;
        for (let i = 0; i < reps; i++) {
          result = result.concat(flattenSteps(s.steps || []));
        }
      } else {
        result.push(s);
      }
    });
    return result;
  };

  const flatSteps = flattenSteps(steps);
  const totalWeight = flatSteps.reduce((acc, curr) => {
    const val = workoutMode === 'distance' 
      ? (curr.distanceMiles || 0) 
      : (curr.durationSec || 0);
    return acc + val;
  }, 0) || 1;

  const velocities = flatSteps.map((s) => (s.targetPaceSec > 0 ? 1 / s.targetPaceSec : 0));
  const maxVel = Math.max(...velocities, 0.0001);
  const minVel = Math.min(...velocities, maxVel);
 
  const getBarColor = (paceSec) => {
    if (!paceSec || paceSec <= 0 || paceSec > 570) return '#6c757d';
    if (paceSec > 510) return '#28a745';
    if (paceSec > 465) return '#ffc107';
    if (paceSec > 420) return '#fd7e14';
    return '#dc3545';
  };

  return (
    <div style={{ width: '100%', height: `${height}px`, display: 'flex', alignItems: 'flex-end', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
      {flatSteps.map((step, idx) => {
        const stepWeight = workoutMode === 'distance' 
          ? (step.distanceMiles || 0) 
          : (step.durationSec || 0);
        const widthPct = (stepWeight / totalWeight) * 100;
        const currentVel = step.targetPaceSec > 0 ? 1 / step.targetPaceSec : 0;
        const barHeightPct = maxVel === minVel ? 60 : 25 + ((currentVel - minVel) / (maxVel - minVel)) * 70;
        const barColor = getBarColor(step.targetPaceSec);

        const durLabel = workoutMode === 'distance' 
          ? formatDistance(step.distanceMiles) 
          : formatTime(step.durationSec);

        return (
          <div
            key={idx}
            style={{
              width: `${widthPct}%`,
              height: `${barHeightPct}%`,
              backgroundColor: barColor,
              borderRight: '1px solid rgba(255,255,255,0.4)',
            }}
            title={`${(step.type || 'run').toUpperCase()}: ${durLabel} @ ${formatMMSS(step.targetPaceSec)}/mi`}
          />
        );
      })}
    </div>
  );
}