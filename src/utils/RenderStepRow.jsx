//
// RenderStepRow.jsx
//
import React, { useMemo } from 'react';
import MMSSInput from './MMSSInput';
import { formatTime, formatMMSS, calculateDynamicPresets } from './WorkoutBuilderHelpers.js';

import {
  detectPaceMethod,
  calculatePaceFromPct,
  calculatePctFromPace,
  calculateZoneFromPace,
  calculatePaceFromZone,
  calculateNewPaceValue
} from '../utils/WorkoutConverter.js';

const METERS_PER_MILE = 1609.344;

// Helper function to guarantee strictly 2 decimal places (#.00)
const formatDistanceFixed = (miles) => {
  const val = Number(miles) || 0;
  return `${val.toFixed(2)} mi`;
};

// Helper to recursively calculate total duration (seconds) and distance (miles) for any step or block
const calculateStepTotals = (stepItem, thresholdSecPerMile = 0, zoneList = []) => {
  if (!stepItem) return { totalSec: 0, totalMiles: 0 };

  const isRepeatBlock = stepItem.type === 'repeat' || Boolean(stepItem.reps) || Array.isArray(stepItem.steps);

  if (isRepeatBlock) {
    const reps = Number(stepItem.reps ?? stepItem.iterations ?? 1) || 1;
    const childSteps = stepItem.steps || [];

    const innerTotals = childSteps.reduce(
      (acc, child) => {
        const childTotals = calculateStepTotals(child, thresholdSecPerMile, zoneList);
        return {
          totalSec: acc.totalSec + childTotals.totalSec,
          totalMiles: acc.totalMiles + childTotals.totalMiles,
        };
      },
      { totalSec: 0, totalMiles: 0 }
    );

    return {
      totalSec: innerTotals.totalSec * reps,
      totalMiles: innerTotals.totalMiles * reps,
    };
  }

  // Single Leaf Step Calculation
  const stepMode = stepItem.stepMode || 'time';
  const durationSec = Number(stepItem.duration ?? stepItem.durationSec ?? 0) || 0;

  // Resolve target pace in sec/mile
  let targetPaceSec = 0;
  if (typeof stepItem.pace === 'object' && stepItem.pace !== null) {
    if (stepItem.pace.unit === '%pace' && thresholdSecPerMile > 0) {
      const pct = stepItem.pace.value ?? stepItem.pace.start ?? 100;
      targetPaceSec = Math.round(thresholdSecPerMile / (pct / 100));
    } else if (stepItem.pace.unit === 'pace_zone' && Array.isArray(zoneList)) {
      const zoneName = stepItem.pace.value ?? stepItem.pace.start;
      const matchedZone = zoneList.find(
        (z) => z.name === zoneName || z.label === zoneName || z.id === zoneName
      );
      targetPaceSec = matchedZone?.targetPaceSec ?? matchedZone?.minSec ?? 0;
    } else {
      targetPaceSec = stepItem.pace.value ?? stepItem.pace.start ?? 0;
    }
  } else {
    targetPaceSec = stepItem.targetPaceSec ?? (typeof stepItem.pace === 'number' ? stepItem.pace : 0);
  }

  let distanceMiles = 0;
  let calculatedSec = durationSec;

  if (stepMode === 'time') {
    distanceMiles = targetPaceSec > 0 ? durationSec / targetPaceSec : 0;
  } else {
    distanceMiles = Number(stepItem.distanceMiles ?? 0) || 0;
    calculatedSec = distanceMiles * targetPaceSec;
  }

  return {
    totalSec: calculatedSec,
    totalMiles: distanceMiles,
  };
};

export default function RenderStepRow({
  step,
  index,
  parentId,
  paceDetails,
  onRemove,
  onUpdate,
  onAddChild,
  onDragStart,
  onDrop
}) {
  if (!step) return null;

  // Save thresholdpace as sec/mile (495)
  const thresholdSecPerMile = paceDetails?.run_pace_sec;

  // Default to 'time' and 'Pace' if unspecified
  const stepMode = step.stepMode || 'time';
  const paceMethod = step.paceMethod || detectPaceMethod(step.pace, 'Pace');

  const zoneList = paceDetails?.preset_colors;

  // Zones and colors
  const dynamicPresets = useMemo(
    () => calculateDynamicPresets(paceDetails, paceDetails?.threshold_pace || 360, paceMethod),
    [paceDetails, paceMethod]
  );

  const setStepMode = (newMode) => {
    onUpdate(step.id, 'stepMode', newMode);
  };

  // Convert step values appropriately when pace method changes
  const setPaceMethod = (newPaceMethod) => {

    onUpdate(step.id, 'paceMethod', newPaceMethod);
    
    const oldPaceMethod = detectPaceMethod(step.pace, 'Pace');

    let oldValue = 0;
    if (typeof step.pace === 'object' && step.pace !== null) {
      const start = step.pace.start ?? 0;
      const end = step.pace.end ?? 0;
    
      // Use explicit value if available; otherwise take max of start/end, falling back to 0
      oldValue = step.pace.value ?? (Math.max(start, end) || 0);
    } 

    let newValue = 0;
    newValue = calculateNewPaceValue(oldPaceMethod, oldValue, newPaceMethod, thresholdSecPerMile, zoneList);

    let newPaceObj = {};
    switch (newPaceMethod) {
      case 'Pace':
        newPaceObj = { unit: 'secs', value: newValue || 480 };
        break;
      case 'Pace Range':
        newPaceObj = { unit: 'secs', start: newValue || 480, end: (newValue || 480) + 15 };
        break;

      case 'Threshold %': {
        newPaceObj = { unit: '%pace', value: newValue };
        break;
      }
      case 'Threshold % Range': {
        newPaceObj = { unit: '%pace', start: newValue, end: newValue };
        break;
      }

      case 'Zone':
        newPaceObj = { unit: 'pace_zone', value: newValue };
        break;
      case 'Zone Range':
        newPaceObj = { unit: 'pace_zone', start: newValue, end: newValue };
        break;
      default:
        newPaceObj = { unit: 'secs', value: newValue };
    }

    onUpdate(step.id, 'pace', newPaceObj);
  };

  const isRepeat = step.type === 'repeat' || Boolean(step.reps) || Array.isArray(step.steps);

  if (isRepeat) {
    const childSteps = step.steps || [];
    const iterations = step.reps ?? step.iterations ?? 1;

    // Dynamically recalculate aggregate totals for all child iterations
    const repeatTotals = calculateStepTotals(step, thresholdSecPerMile, zoneList);

    return (
      <div
        className="repeat-block-container"
        draggable
        onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop && onDrop(e, parentId, index)}
      >
        <div className="repeat-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="drag-handle">⣿</span>
          <strong className="repeat-type-title">Repeat Block</strong>
          <label style={{ fontSize: '12px', marginLeft: '8px' }}>
            Repeats:
            <input
              type="number"
              min="1"
              max="99"
              value={iterations}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                onUpdate(step.id, 'reps', val);
                onUpdate(step.id, 'iterations', val);
              }}
              style={{ width: '48px', marginLeft: '4px' }}
            />
          </label>

          {/* Repeat Total Summary Badge */}
          <div
            className="repeat-summary-badge"
            style={{
              marginLeft: 'auto',
              marginRight: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#495057',
              backgroundColor: '#e9ecef',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            Total: {formatTime(repeatTotals.totalSec)} ({formatDistanceFixed(repeatTotals.totalMiles)})
          </div>

          <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
        </div>

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop && onDrop(e, step.id, childSteps.length)}>
          {childSteps.map((childStep, childIdx) => (
            <RenderStepRow
              key={childStep.id || `child-${childIdx}`}
              step={childStep}
              index={childIdx}
              parentId={step.id}
              paceDetails={paceDetails}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => onAddChild('run', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>
            + Add Run
          </button>
          <button onClick={() => onAddChild('recovery', step.id)} className="btn-add-step" style={{ fontSize: '12px' }}>
            + Add Recovery
          </button>
        </div>
      </div>
    );
  }

  // Leaf Step values
  const durationSec = step.duration ?? step.durationSec ?? 0;

  // Extract primary seconds calculation for distance/time estimation (in sec/mile)
  let targetPaceSec = 0;
  if (typeof step.pace === 'object' && step.pace !== null) {
    if (step.pace.unit === '%pace' && thresholdSecPerMile > 0) {
      const pct = step.pace.value ?? step.pace.start ?? 100;
      targetPaceSec = Math.round(thresholdSecPerMile / (pct / 100));
    } else {
      targetPaceSec = step.pace.value ?? step.pace.start ?? 0;
    }
  } else {
    targetPaceSec = step.targetPaceSec ?? (typeof step.pace === 'number' ? step.pace : 0);
  }

  const distanceMiles = step.distanceMiles ?? (targetPaceSec > 0 ? durationSec / targetPaceSec : 0);

  const handleDurationChange = (newSec) => {
    onUpdate(step.id, 'duration', newSec);
    onUpdate(step.id, 'durationSec', newSec);
  };

  const calculatedMiles = targetPaceSec > 0 ? durationSec / targetPaceSec : 0;
  const calculatedTimeSec = distanceMiles * targetPaceSec;

  // Render pace controls based on Method
  const renderPaceInputControls = () => {
    const isRange = paceMethod.includes('Range');

    // 1. Pace or Pace Range (MMSSInput free-form)
    if (paceMethod === 'Pace' || paceMethod === 'Pace Range') {
      if (!isRange) {
        const valSec = typeof step.pace === 'object' ? (step.pace.value ?? 0) : targetPaceSec;
        return (
          <label className="input-label">
            Pace:{' '}
            <MMSSInput 
              valueSec={valSec} 
              onChange={(newSec) => onUpdate(step.id, 'pace', { unit: 'secs', value: newSec })} 
            />
          </label>
        );
      }
      const startSec = typeof step.pace === 'object' ? (step.pace.start ?? 0) : targetPaceSec;
      const endSec = typeof step.pace === 'object' ? (step.pace.end ?? 0) : targetPaceSec + 15;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label className="input-label">
            Fast:{' '}
            <MMSSInput 
              valueSec={startSec} 
              onChange={(newSec) => onUpdate(step.id, 'pace', { ...step.pace, unit: 'secs', start: newSec })} 
            />
          </label>
          <label className="input-label">
            Slow:{' '}
            <MMSSInput 
              valueSec={endSec} 
              onChange={(newSec) => onUpdate(step.id, 'pace', { ...step.pace, unit: 'secs', end: newSec })} 
            />
          </label>
        </div>
      );
    }

    // 2. Threshold % or Threshold % Range
    if (paceMethod === 'Threshold %' || paceMethod === 'Threshold % Range') {
      if (!isRange) {
        const valPct = typeof step.pace === 'object' ? (step.pace.value ?? 100) : 100;
        const calcPace = thresholdSecPerMile > 0 ? formatMMSS(Math.round(thresholdSecPerMile / (valPct / 100))) : '--:--';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="input-label">
              Pace %:{' '}
              <input
                type="number"
                min="50"
                max="200"
                value={valPct}
                onChange={(e) => onUpdate(step.id, 'pace', { unit: '%pace', value: parseFloat(e.target.value) || 0 })}
                className="time-pace-input"
                style={{ width: '50px', padding: '2px 4px' }}
              />
              %
            </label>
            <span style={{ fontSize: '12px', color: '#6c757d' }}>({calcPace} /mi)</span>
          </div>
        );
      }

      const startPct = typeof step.pace === 'object' ? (step.pace.start ?? 95) : 95;
      const endPct = typeof step.pace === 'object' ? (step.pace.end ?? 105) : 105;
      const calcFastPace = thresholdSecPerMile > 0 ? formatMMSS(Math.round(thresholdSecPerMile / (startPct / 100))) : '--:--';
      const calcSlowPace = thresholdSecPerMile > 0 ? formatMMSS(Math.round(thresholdSecPerMile / (endPct / 100))) : '--:--';

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="input-label">
            Fast %:{' '}
            <input
              type="number"
              min="50"
              max="200"
              value={startPct}
              onChange={(e) => onUpdate(step.id, 'pace', { ...step.pace, unit: '%pace', start: parseFloat(e.target.value) || 0 })}
              className="time-pace-input"
              style={{ width: '48px', padding: '2px 4px' }}
            />
            %
          </label>
          <label className="input-label">
            Slow %:{' '}
            <input
              type="number"
              min="50"
              max="200"
              value={endPct}
              onChange={(e) => onUpdate(step.id, 'pace', { ...step.pace, unit: '%pace', end: parseFloat(e.target.value) || 0 })}
              className="time-pace-input"
              style={{ width: '48px', padding: '2px 4px' }}
            />
            %
          </label>
          <span style={{ fontSize: '12px', color: '#6c757d' }}>({calcFastPace} - {calcSlowPace} /mi)</span>
        </div>
      );
    }

    // 3. Zone or Zone Range 
    if (paceMethod === 'Zone' || paceMethod === 'Zone Range') {
      const renderZoneOption = (z) => {
        const displayPace = z.displayPace || (z.targetPaceSec ? formatMMSS(z.targetPaceSec) : '');
        const labelText = `${z.name || z.label}${displayPace ? ` (${displayPace})` : ''}`;
        return (
          <option key={z.id || z.name || z.label} value={z.name || z.label} style={{ backgroundColor: z.color || '#fff' }}>
            {labelText}
          </option>
        );
      };

      if (!isRange) {
        const currentZone = typeof step.pace === 'object' ? (step.pace.value || 'Z1') : 'Z1';
        return (
          <label className="input-label">
            Zone:{' '}
            <select
              value={currentZone}
              onChange={(e) => onUpdate(step.id, 'pace', { unit: 'pace_zone', value: e.target.value })}
              className="pace-method-select"
            >
              {zoneList.map(renderZoneOption)}
            </select>
          </label>
        );
      }

      const startZone = typeof step.pace === 'object' ? (step.pace.start || 'Z1') : 'Z1';
      const endZone = typeof step.pace === 'object' ? (step.pace.end || 'Z2') : 'Z2';

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label className="input-label">
            Fast Zone:{' '}
            <select
              value={startZone}
              onChange={(e) => onUpdate(step.id, 'pace', { ...step.pace, unit: 'pace_zone', start: e.target.value })}
              className="pace-method-select"
            >
              {zoneList.map(renderZoneOption)}
            </select>
          </label>
          <label className="input-label">
            Slow Zone:{' '}
            <select
              value={endZone}
              onChange={(e) => onUpdate(step.id, 'pace', { ...step.pace, unit: 'pace_zone', end: e.target.value })}
              className="pace-method-select"
            >
              {zoneList.map(renderZoneOption)}
            </select>
          </label>
        </div>
      );
    }

    return null;
  };

  // Inline helper: Step inputs row
  const renderStepInputs = () => {
    return (
      <div className="step-row-inputs" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span className="drag-handle">⣿</span>
        <span className="step-type-label">{step.intensity || step.type || 'step'}</span>

        {stepMode === 'time' ? (
          <label className="input-label">
            Time:{' '}
            <MMSSInput valueSec={durationSec} onChange={handleDurationChange} />
          </label>
        ) : (
          <label className="input-label">
            Dist:{' '}
            <input
              type="number"
              step="0.01"
              min="0"
              value={Number(distanceMiles).toFixed(2)}
              onChange={(e) => onUpdate(step.id, 'distanceMiles', parseFloat(e.target.value) || 0)}
              className="time-pace-input"
              style={{ width: '68px', padding: '2px 4px' }}
            />
            mi
          </label>
        )}

        {/* Dynamic Pace Input Controls based on Pace Method */}
        {renderPaceInputControls()}

        <span className="dist-display" style={{ marginLeft: 'auto' }}>
          {stepMode === 'time'
            ? `Dist: ${formatDistanceFixed(calculatedMiles)}`
            : `Time: ${formatTime(calculatedTimeSec)}`}
        </span>

        <button onClick={() => onRemove(step.id)} className="btn-remove">✕</button>
      </div>
    );
  };

  // Inline helper: Step preset buttons
  const renderStepPresets = () => {
    const presetList = dynamicPresets || [];
    if (presetList.length === 0) return null;

    const handleSelectPace = (newSec) => {
      const method = (paceMethod || '').toLowerCase();

      if (method.includes('pace')) {
        onUpdate(step.id, 'pace', { units: 'secs', value: newSec });
      } 
      else if (method.includes('threshold')) {
        const pct = thresholdSecPerMile > 0 ? Math.round((thresholdSecPerMile / newSec) * 100) : 100;
        onUpdate(step.id, 'pace', { unit: '%pace', value: pct });
      } 
      else if (method.includes('zone')) {
        const matchedZoneKey = Object.keys(zones || {}).find((key) => {
          const z = zones[key];
          if (z?.minSec && z?.maxSec) {
            return newSec <= z.minSec && newSec >= z.maxSec;
          }
          return false;
        }) || 'Z2';
        onUpdate(step.id, 'pace', {
          unit: 'zone',
          value: matchedZoneKey
        });
      }
    };

    const row1 = presetList.slice(0, 4);
    const row2 = presetList.slice(4);

    const renderButton = (preset) => {
      const isSelected = Math.abs(targetPaceSec - preset.targetPaceSec) < 3;
      return (
        <button
          key={preset.label}
          type="button"
          onClick={() => handleSelectPace(preset.targetPaceSec)}
          style={{
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '12px',
            border: `1px solid ${preset.color || '#ced4da'}`,
            backgroundColor: isSelected ? preset.color : '#ffffff',
            color: isSelected ? '#ffffff' : (preset.color || '#333'),
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            width: '100%'
          }}
        >
          {preset.label} ({preset.displayPace || formatMMSS(preset.targetPaceSec)})
        </button>
      );
    };

    return (
      <div className="step-presets-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
        <label className="input-label" style={{ paddingTop: '2px' }}>
          Presets:
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {row1.map(renderButton)}
          </div>
          {row2.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {row2.map(renderButton)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Inline helper: Mode and Pace Method selector bar
  const renderControlBar = () => {
    return (
      <div className="step-controls-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
        <div className="mode-toggle-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label className="input-label">
            Step Mode:
          </label>
          <select
            value={stepMode}
            onChange={(e) => setStepMode(e.target.value)}
            className="pace-method-select"
          >
            <option value="time">⏱️ Time</option>
            <option value="distance">📏 Distance</option>
          </select>
        </div>

        <div className="pace-method-group" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label className="input-label">
            Pace Method:
          </label>
          <select
            value={paceMethod}
            onChange={(e) => setPaceMethod(e.target.value)}
            className="pace-method-select"
          >
            <option value="Pace">⏱️ Pace</option>
            <option value="Pace Range">⏱️ Pace Range</option>
            <option value="Zone">📶 Zone</option>
            <option value="Zone Range">📶 Zone Range</option>
            <option value="Threshold %">🎯 Threshold %</option>
            <option value="Threshold % Range">🎯 Threshold % Range</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <div
      className="step-row-container"
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, step, parentId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop && onDrop(e, parentId, index)}
      style={{ marginBottom: '12px', border: '1px solid #e0e0e0', padding: '10px', borderRadius: '8px' }}
    >
      {/* Step Inputs */}
      {renderStepInputs()}

      {/* Dynamic Presets */}
      {renderStepPresets()}

      {/* Mode & Pace Method Controls */}
      {renderControlBar()}
    </div>
  );
}