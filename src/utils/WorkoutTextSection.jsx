//
// WorkoutTextSection.jsx
//
import React, { useState } from 'react';
import './WorkoutTextSection.css';
import { formatPaceRange, parsePaceStrToSec } from './WorkoutChartHelpers.js';

import {
  detectPaceMethod,
  calculatePaceFromPct,
  calculatePctFromPace,
  calculateZoneFromPace,
  calculatePaceFromZone,
  calculateNewPaceValue,
  metersPerSecondToPaceStr,
  secondsToPaceStr
} from '../utils/WorkoutConverter.js';

// 125 -> 2:05
const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (num) => String(num).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

const formatIntensityTitleCase = (val) => {
  if (!val) return "N/A";
  const str = String(val);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Return the formatted text describing the pace(s) for the step
const formatPaceString = (s, thresholdPaceMps, zoneList, paceDetails) => {
  if (!s?.pace) return "N/A";

  const { pace } = s;
  const units = (pace.units || '').toLowerCase().replace(/\s+|range/g, '');

  // Determine if single value vs range
  const isSingle = pace.value != null;
  const val = isSingle ? pace.value : null;

  const start = Math.max(pace.start ?? 0, pace.end ?? 0);
  const end = Math.min(pace.start ?? 0, pace.end ?? 0);

  let paceStr = 'N/A';
  let paceMethodStr = null;

  switch (units) {
    // -------------------------------------------------------------------
    // 1. SECONDS PER MILE (Direct Seconds)
    // -------------------------------------------------------------------
    case 'secs':{
      if (isSingle) {
        paceStr = secondsToPaceStr(val);
      } else {
        paceStr = `${secondsToPaceStr(end)} - ${secondsToPaceStr(start)}`;
      }
      break;
    }

    // -------------------------------------------------------------------
    // 2. PERCENTAGE OF THRESHOLD (%pace)
    // -------------------------------------------------------------------
    case '%pace': {
      const thresholdSec = Number(paceDetails?.run_pace_sec || paceDetails?.threshold_pace_sec);
      const calc = (pct) => thresholdSec > 0 && Number(pct) > 0 ? thresholdSec / (Number(pct) / 100) : NaN;
      const first = isSingle ? val : pace.start;
      const last = isSingle ? val : pace.end;
      const fast = Math.min(calc(first), calc(last));
      const slow = Math.max(calc(first), calc(last));
      paceStr = Number.isFinite(fast) && Number.isFinite(slow) ? (fast === slow ? secondsToPaceStr(fast) : `${secondsToPaceStr(fast)} - ${secondsToPaceStr(slow)}`) : 'N/A';
      paceMethodStr = isSingle ? `(${val}% threshold)` : `(${Math.min(first, last)}-${Math.max(first, last)}% threshold)`;
      break;
    }

    // -------------------------------------------------------------------
    // 3. PACE ZONE (Numeric Zone IDs)
    // -------------------------------------------------------------------
    case 'pace_zone': {
      const selectedIds = isSingle ? [Number(val)] : [Number(pace.start), Number(pace.end)];
      const selectedZones = (zoneList || []).filter((z) => selectedIds.every(Number.isFinite) && Number(z.zone) >= Math.min(...selectedIds) && Number(z.zone) <= Math.max(...selectedIds));
      const parseBoundary = (value) => {
        if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
        const match = String(value || '').match(/(\d+):(\d{2})/);
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
      };
      const fastCandidates = selectedZones.map((z) => parseBoundary(z.pace_fast) || parseBoundary(z.pace_val_sec)).filter((v) => v > 0);
      const slowCandidates = selectedZones.map((z) => parseBoundary(z.pace_slow) || ((parseBoundary(z.pace_fast) || parseBoundary(z.pace_val_sec) || 0) + 120)).filter((v) => v > 0);
      if (fastCandidates.length && slowCandidates.length) {
        const fast = Math.min(...fastCandidates);
        const slow = Math.max(...slowCandidates);
        paceStr = fast === slow ? secondsToPaceStr(fast) : `${secondsToPaceStr(fast)} - ${secondsToPaceStr(slow)}`;
      } else {
        paceStr = 'N/A';
      }
      paceMethodStr = isSingle ? `(Zone ${val})` : `(Zones ${Math.min(...selectedIds)}-${Math.max(...selectedIds)})`;
      break;
    }
  }

  return paceStr + (paceMethodStr ? ` ${paceMethodStr}` : '');
};

const parseSingleStep = (s, idx, thresholdPaceMps, zoneList, paceDetails) => {
  const rawIntensity = s.intensity || (s.warmup ? "warmup" : s.cooldown ? "cooldown" : "active");
  return {
    id: idx,
    isRepeat: false,
    durationSec: s.duration || 0,
    intensity: formatIntensityTitleCase(rawIntensity),
    paceStr: formatPaceString(s, thresholdPaceMps, zoneList, paceDetails),
    text: s.text || "No step text"
  };
};

const parseWorkoutSteps = (stepList, thresholdPaceMps, zonelist, paceDetails) => {
  if (!Array.isArray(stepList)) return [];

  return stepList.map((s, idx) => {
    // Handle Repeat Blocks
    if (Array.isArray(s.steps) && s.steps.length > 0) {
      const reps = s.reps && Number.isInteger(s.reps) && s.reps > 0 ? s.reps : 1;
      const innerSteps = parseWorkoutSteps(s.steps, thresholdPaceMps, zonelist, paceDetails);
      
      const singleCycleDuration = innerSteps.reduce((sum, inner) => sum + inner.durationSec, 0);
      const totalRepeatDuration = singleCycleDuration * reps;

      return {
        id: idx,
        isRepeat: true,
        reps,
        durationSec: totalRepeatDuration,
        innerSteps,
        text: s.text || null
      };
    }

    // Handle Standard Steps
    return parseSingleStep(s, idx, thresholdPaceMps, zonelist, paceDetails);
  });
};

const estimateStepMiles = (step) => {
  if (step.isRepeat) return step.reps * step.innerSteps.reduce((sum, inner) => sum + estimateStepMiles(inner), 0);
  const matches = [...(step.paceStr || '').matchAll(/(\d{1,2}):(\d{2})(?!\d)/g)];
  const paceSeconds = matches.map((match) => Number(match[1]) * 60 + Number(match[2])).filter((seconds) => seconds > 0);
  if (!paceSeconds.length || !step.durationSec) return 0;
  return step.durationSec / (paceSeconds.reduce((sum, seconds) => sum + seconds, 0) / paceSeconds.length);
};

const RenderStepCard = ({ step }) => {
  if (step.isRepeat) {
    return (
      <div className="workout-step-card workout-repeat-block">
        <div className="workout-repeat-header">
          <span className="workout-repeat-title">
            Repeat {step.reps}x
          </span>
          {step.text && (
            <span className="workout-repeat-note-inline">
              "{step.text}"
            </span>
          )}
          <span className="workout-section-badge">
            Repeat Time: {formatDuration(step.durationSec)}
          </span>
          <span className="workout-section-badge">Est. Distance: {estimateStepMiles(step).toFixed(2)} mi</span>
        </div>

        <div className="workout-repeat-inner-list">
          {step.innerSteps.map((innerStep, iIdx) => (
            <RenderStepCard key={iIdx} step={innerStep} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="workout-step-card">
      {/* Line 1: Details */}
      <div className="workout-step-row">
        <span className="workout-step-label">Details:</span>
        <span className="workout-step-details-inline">
          <span className="workout-step-value">{step.intensity}</span>
          <span className="workout-step-connector">for</span>
          <span className="workout-step-value">{formatDuration(step.durationSec)}</span>
          <span className="workout-step-connector">at</span>
          <span className="workout-step-value">{step.paceStr}</span>
          <span className="workout-step-connector">· est.</span>
          <span className="workout-step-value">{estimateStepMiles(step).toFixed(2)} mi</span>
        </span>
      </div>

      {/* Line 2: Text */}
      <div className="workout-step-row">
        <span className="workout-step-label">Text:</span>
        <span className="workout-step-text">"{step.text}"</span>
      </div>
    </div>
  );
};

  // 
  //
  // --------------------------------------------------------------------- //
  // MAIN FUNCTION SECTION
  // --------------------------------------------------------------------- //
  //
  //
  export default function WorkoutTextSection({ workout, thresholdPace = null, paceDetails }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workout) return null;

  let rawSteps = [];
  if (workout.workout_doc) {
    try {
      const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
      rawSteps = doc?.steps || [];
    } catch (e) {
      console.error("Failed to parse workout_doc", e);
    }
  }

  // thresholdPace passes as sec/mi (3.2512 for 8:15/mi pace)
  const thresholdPaceMps = thresholdPace;

  const zoneList = paceDetails?.preset_colors;

  const parsedSteps = parseWorkoutSteps(rawSteps, thresholdPaceMps, zoneList, paceDetails);

  const estimatedDistanceMiles = parsedSteps.reduce((sum, step) => sum + estimateStepMiles(step), 0);

  // Calculate Total Overall Workout Duration
  const totalWorkoutDurationSec = parsedSteps.reduce((sum, step) => sum + step.durationSec, 0);

  // 
  //
  // --------------------------------------------------------------------- //
  // Return the text for the WORKOUT details
  // --------------------------------------------------------------------- //
  //
  //
  return (
    <div className="workout-section-container">
      <div className="workout-section-header-box">
        <div 
          onClick={() => setIsOpen((prev) => !prev)}
          className="workout-section-toggle"
        >
          <span className="workout-section-title">
            {isOpen ? '▼' : '►'} Workout Details ({parsedSteps.length} block{parsedSteps.length === 1 ? '' : 's'})
          </span>
          <span className="workout-section-summary">
            <span className="workout-section-badge">Total Time: {formatDuration(totalWorkoutDurationSec)}</span>
            <span className="workout-section-badge">Est. Distance: {estimatedDistanceMiles.toFixed(2)} mi</span>
          </span>
        </div>

        {isOpen && (
          <div className="workout-section-content">
            {parsedSteps.length === 0 ? (
              <div className="workout-section-empty">No parsed step data available in workout_doc.</div>
            ) : (
              <div className="workout-steps-list">
                {parsedSteps.map((step, sIdx) => (
                  <RenderStepCard key={sIdx} step={step} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
