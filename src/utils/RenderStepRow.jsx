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

// Helper to reliably locate a zone in zoneList regardless of structure (z.zone, z.id, z.zone_name, z.name)
const findZoneItem = (zoneList, zoneIdentifier) => {
  if (zoneIdentifier === undefined || zoneIdentifier === null || !Array.isArray(zoneList)) return null;
  const targetStr = String(zoneIdentifier).trim().toLowerCase();

  return zoneList.find((z) => {
    const rawZone = z.zone !== undefined ? String(z.zone) : '';
    const rawId = z.id !== undefined ? String(z.id) : '';
    const rawPresetId = z.preset_colors?.id !== undefined ? String(z.preset_colors.id) : '';
    const zoneName = (z.zone_name || z.name || z.label || z.preset_colors?.zone_name || '').toLowerCase();

    return (
      rawZone.toLowerCase() === targetStr ||
      rawId.toLowerCase() === targetStr ||
      rawPresetId.toLowerCase() === targetStr ||
      zoneName === targetStr
    );
  });
};

// Helper to resolve pace in seconds from a zone match
const getZoneTargetPaceSec = (matchedZone) => {
  if (!matchedZone) return 0;
  return (
    matchedZone.pace_val_sec ??
    matchedZone.targetPaceSec ??
    matchedZone.minSec ??
    matchedZone.preset_colors?.pace_val_sec ??
    0
  );
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
    if (stepItem.pace.units === '%pace' && thresholdSecPerMile > 0) {
      const pct = stepItem.pace.value ?? stepItem.pace.start ?? 100;
      targetPaceSec = Math.round(thresholdSecPerMile / (pct / 100));
    } else if (stepItem.pace.units === 'pace_zone' && Array.isArray(zoneList)) {
      const zoneName = stepItem.pace.value ?? stepItem.pace.start;
      const matchedZone = findZoneItem(zoneList, zoneName);
      targetPaceSec = getZoneTargetPaceSec(matchedZone);
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

  // Save threshold pace as sec/mile (e.g. 495)
  const thresholdSecPerMile = paceDetails?.run_pace_sec;

  // Derive active paceMethod dynamically from step.pace payload first
  const paceMethod = detectPaceMethod(step.pace) || step.paceMethod || 'Pace';
  const stepMode = step.stepMode || 'time';

  const zoneList = paceDetails?.preset_colors || [];

  // Zones and colors for presets
  const dynamicPresets = useMemo(
    () => calculateDynamicPresets(paceDetails, paceDetails?.threshold_pace || 360, paceMethod),
    [paceDetails, paceMethod]
  );

  const setStepMode = (newMode) => {
    onUpdate(step.id, 'stepMode', newMode);
  };

  // Convert step values appropriately when pace method changes
  const setPaceMethod = (newPaceMethod) => {
    const oldPaceMethod = paceMethod;

    let oldValue = 0;
    if (typeof step.pace === 'object' && step.pace !== null) {
      const start = step.pace.start ?? 0;
      const end = step.pace.end ?? 0;
      oldValue = step.pace.value ?? (Math.max(start, end) || 0);
    } else if (typeof step.pace === 'number') {
      oldValue = step.pace;
    }

    const newValue = calculateNewPaceValue(oldPaceMethod, oldValue, newPaceMethod, thresholdSecPerMile, zoneList);

    let newPaceObj = {};
    const defaultZoneVal = zoneList[0]?.pace_value_sec ? String(zoneList[0].pace_value_sec) : 720;

    switch (newPaceMethod) {
      case 'Pace':
        newPaceObj = { units: 'secs', value: newValue || 480 };
        break;
      case 'Pace Range':
        newPaceObj = { units: 'secs', start: newValue || 480, end: newValue || 480 };
        break;

      case 'Threshold %':
        newPaceObj = { units: '%pace', value: newValue || 100 };
        break;
      case 'Threshold % Range':
        newPaceObj = { units: '%pace', start: newValue || 100, end: newValue || 100 };
        break;

      case 'Zone':
        newPaceObj = { units: 'pace_zone', value: newValue || defaultZoneVal };
        break;
      case 'Zone Range':
        newPaceObj = { units: 'pace_zone', start: newValue || defaultZoneVal, end: defaultZoneVal };
        break;
      default:
        newPaceObj = { units: 'secs', value: newValue || 480 };
    }

    onUpdate(step.id, 'paceMethod', newPaceMethod);
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
              backgroundColor: 'transparent',
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
    if (step.pace.units === '%pace' && thresholdSecPerMile > 0) {
      const pct = step.pace.value ?? step.pace.start ?? 100;
      targetPaceSec = Math.round(thresholdSecPerMile / (pct / 100));
    } else if (step.pace.units === 'pace_zone' && Array.isArray(zoneList)) {
      const zoneName = step.pace.value ?? step.pace.start;
      const matchedZone = findZoneItem(zoneList, zoneName);
      targetPaceSec = getZoneTargetPaceSec(matchedZone);
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

    // 1. Pace or Pace Range
    if (paceMethod === 'Pace' || paceMethod === 'Pace Range') {
      if (!isRange) {
        const valSec = typeof step.pace === 'object' ? (step.pace.value ?? 0) : targetPaceSec;
        return (
          <label className="input-label">
            Pace:{' '}
            <MMSSInput 
              valueSec={valSec} 
              onChange={(newSec) => onUpdate(step.id, 'pace', { units: 'secs', value: newSec })} 
            />
          </label>
        );
      }

      // Fast pace = FEWER seconds/mi; Slow pace = MORE seconds/mi
      const rawStart = typeof step.pace === 'object' ? (step.pace.start ?? 480) : targetPaceSec;
      const rawEnd = typeof step.pace === 'object' ? (step.pace.end ?? 495) : targetPaceSec + 15;

      const fastSec = Math.min(rawStart, rawEnd);
      const slowSec = Math.max(rawStart, rawEnd);

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label className="input-label">
            Fast:{' '}
            <MMSSInput 
              valueSec={fastSec} 
              onChange={(newSec) => onUpdate(step.id, 'pace', { ...step.pace, units: 'secs', start: newSec, end: slowSec })} 
            />
          </label>
          <label className="input-label">
            Slow:{' '}
            <MMSSInput 
              valueSec={slowSec} 
              onChange={(newSec) => onUpdate(step.id, 'pace', { ...step.pace, units: 'secs', start: fastSec, end: newSec })} 
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
                onChange={(e) => onUpdate(step.id, 'pace', { units: '%pace', value: parseFloat(e.target.value) || 0 })}
                className="time-pace-input"
                style={{ width: '50px', padding: '2px 4px' }}
              />
              %
            </label>
            <span style={{ fontSize: '12px', color: '#6c757d' }}>({calcPace} /mi)</span>
          </div>
        );
      }

      const rawStartPct = typeof step.pace === 'object' ? (step.pace.start ?? 105) : 105;
      const rawEndPct = typeof step.pace === 'object' ? (step.pace.end ?? 95) : 95;

      // Higher % = FASTER pace (fewer sec/mi); Lower % = SLOWER pace (more sec/mi)
      const fastPct = Math.max(rawStartPct, rawEndPct);
      const slowPct = Math.min(rawStartPct, rawEndPct);

      const calcFastPace = thresholdSecPerMile > 0 ? formatMMSS(Math.round(thresholdSecPerMile / (fastPct / 100))) : '--:--';
      const calcSlowPace = thresholdSecPerMile > 0 ? formatMMSS(Math.round(thresholdSecPerMile / (slowPct / 100))) : '--:--';

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="input-label">
            Fast %:{' '}
            <input
              type="number"
              min="50"
              max="200"
              value={fastPct}
              onChange={(e) => onUpdate(step.id, 'pace', { ...step.pace, units: '%pace', start: parseFloat(e.target.value) || 0, end: slowPct })}
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
              value={slowPct}
              onChange={(e) => onUpdate(step.id, 'pace', { ...step.pace, units: '%pace', start: fastPct, end: parseFloat(e.target.value) || 0 })}
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
        // Resolve primary key and display values from schema
        const zoneKey = String(z.zone ?? z.id ?? z.preset_colors?.id ?? z.zone_name ?? z.name ?? '');
        const zoneName = z.zone_name ?? z.name ?? z.preset_colors?.zone_name ?? z.label ?? `Zone ${zoneKey}`;
        const zoneColor = z.color ?? z.preset_colors?.color ?? '#fff';

        const zoneSec = getZoneTargetPaceSec(z);
        const displayPace = z.displayPace || (zoneSec > 0 ? formatMMSS(zoneSec) : '');
        const labelText = `${zoneName}${displayPace ? ` (${displayPace})` : ''}`;

        return (
          <option key={zoneKey} value={zoneKey} style={{ backgroundColor: zoneColor }}>
            {labelText}
          </option>
        );
      };

      if (!isRange) {
        const rawZoneVal = typeof step.pace === 'object' ? (step.pace.value ?? step.pace.start) : step.pace;
        const matchedZone = findZoneItem(zoneList, rawZoneVal);

        const defaultZoneVal = String(zoneList[0]?.zone ?? zoneList[0]?.id ?? '1');
        const currentZoneKey = String(matchedZone?.zone ?? matchedZone?.id ?? rawZoneVal ?? defaultZoneVal);

        const zonePaceSec = getZoneTargetPaceSec(matchedZone);
        const displayPaceStr = zonePaceSec > 0 ? formatMMSS(zonePaceSec) : '--:--';

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="input-label">
              Zone:{' '}
              <select
                value={currentZoneKey}
                onChange={(e) => {
                  const selectedVal = e.target.value;
                  onUpdate(step.id, 'pace', { units: 'pace_zone', value: selectedVal });
                }}
                className="pace-method-select"
              >
                {zoneList.map(renderZoneOption)}
              </select>
            </label>
            <span style={{ fontSize: '12px', color: '#6c757d' }}>({displayPaceStr} /mi)</span>
          </div>
        );
      }

      // Zone Range (Fast & Slow)
      const rawStartVal = typeof step.pace === 'object' ? step.pace.start : undefined;
      const rawEndVal = typeof step.pace === 'object' ? step.pace.end : undefined;

      const matchedStart = findZoneItem(zoneList, rawStartVal);
      const matchedEnd = findZoneItem(zoneList, rawEndVal);

      const defaultFastVal = String(zoneList[1]?.zone ?? zoneList[1]?.id ?? '2');
      const defaultSlowVal = String(zoneList[0]?.zone ?? zoneList[0]?.id ?? '1');

      const startZoneKey = String(matchedStart?.zone ?? matchedStart?.id ?? rawStartVal ?? defaultFastVal);
      const endZoneKey = String(matchedEnd?.zone ?? matchedEnd?.id ?? rawEndVal ?? defaultSlowVal);

      const fastZonePaceSec = getZoneTargetPaceSec(matchedStart);
      const slowZonePaceSec = getZoneTargetPaceSec(matchedEnd);

      const calcFastZonePace = fastZonePaceSec > 0 ? formatMMSS(fastZonePaceSec) : '--:--';
      const calcSlowZonePace = slowZonePaceSec > 0 ? formatMMSS(slowZonePaceSec) : '--:--';

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="input-label">
            Fast Zone:{' '}
            <select
              value={startZoneKey}
              onChange={(e) => {
                const selectedVal = e.target.value;
                onUpdate(step.id, 'pace', { ...step.pace, units: 'pace_zone', start: selectedVal });
              }}
              className="pace-method-select"
            >
              {zoneList.map(renderZoneOption)}
            </select>
          </label>
          <label className="input-label">
            Slow Zone:{' '}
            <select
              value={endZoneKey}
              onChange={(e) => {
                const selectedVal = e.target.value;
                onUpdate(step.id, 'pace', { ...step.pace, units: 'pace_zone', end: selectedVal });
              }}
              className="pace-method-select"
            >
              {zoneList.map(renderZoneOption)}
            </select>
          </label>
          <span style={{ fontSize: '12px', color: '#6c757d' }}>({calcFastZonePace} - {calcSlowZonePace} /mi)</span>
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
      const isRange = method.includes('range');

      if (method.includes('pace')) {
        if (isRange) {
          onUpdate(step.id, 'pace', { units: 'secs', start: newSec, end: newSec + 15 });
        } else {
          onUpdate(step.id, 'pace', { units: 'secs', value: newSec });
        }
      } else if (method.includes('threshold')) {
        const pct = thresholdSecPerMile > 0 ? Math.round((thresholdSecPerMile / newSec) * 100) : 100;
        if (isRange) {
          onUpdate(step.id, 'pace', { units: '%pace', start: pct, end: pct });
        } else {
          onUpdate(step.id, 'pace', { units: '%pace', value: pct });
        }
      } else if (method.includes('zone')) {
        const matchedZone = zoneList.find((z) => Math.abs((z.pace_val_sec || z.targetPaceSec || 0) - newSec) < 15);
        const zoneVal = matchedZone
          ? String(matchedZone.zone ?? matchedZone.id ?? matchedZone.zone_name ?? '1')
          : '1';
        
        if (isRange) {
          onUpdate(step.id, 'pace', { units: 'pace_zone', start: zoneVal, end: zoneVal });
        } else {
          onUpdate(step.id, 'pace', { units: 'pace_zone', value: zoneVal });
        }
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