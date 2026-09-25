//
// WorkoutTextSection.jsx
//
import React, { useState } from 'react';
import './WorkoutTextSection.css';

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
const formatPaceString = (s, thresholdPaceMps, zoneList) => {
  if (!s?.pace) return "N/A";

  const { pace } = s;
  const units = (pace.units || '').toLowerCase().replace(/\s+|range/g, '');

  // Determine if single value vs range
  const isSingle = pace.value != null;
  const val = isSingle ? pace.value : null;
  const start = pace.start ?? 0;
  const end = pace.end ?? 0;

  let paceRangeStr = "N/A";
  let calcPaceMps = null;

  switch (units) {
    // -------------------------------------------------------------------
    // 1. SECONDS PER MILE (Direct Seconds)
    // -------------------------------------------------------------------
    case 'secs':{
      if (isSingle) {
        paceRangeStr = secondsToPaceStr(val);
      } else {
        paceRangeStr = `${secondsToPaceStr(start)} - ${secondsToPaceStr(end)}`;
      }
      break;
    }

    // -------------------------------------------------------------------
    // 2. PERCENTAGE OF THRESHOLD (%pace)
    // -------------------------------------------------------------------
    case '%pace': {
      if (isSingle) {
        paceRangeStr = `${val}% pace`;
        if (thresholdPaceMps) calcPaceMps = thresholdPaceMps * (val / 100);
      } else {
        paceRangeStr = `${start}-${end}% pace`;
        if (thresholdPaceMps) {
          const avgPct = (start + end) / 2;
          calcPaceMps = thresholdPaceMps * (avgPct / 100);
        }
      }
      break;
    }

    // -------------------------------------------------------------------
    // 3. PACE ZONE (Numeric Zone IDs)
    // -------------------------------------------------------------------
    case 'pace_zone': {
      if (isSingle) {
        const zoneMatch = zoneList?.preset_colors?.find((z) => z.zone === Number(val));
        paceRangeStr = zoneMatch?.zone_name || `Zone ${val}`;
        
        if (zoneMatch) {
          calcPaceMps = zoneMatch.pace_value_num;
        }
      } else {
        const startZone = zoneList?.preset_colors?.find((z) => z.zone === Number(start));
        const endZone = zoneList?.preset_colors?.find((z) => z.zone === Number(end));

        if (startZone && endZone) {
          // Pulls "10:19/mi - 9:00/mi (Zone 2 - Zone 4)" directly from preset values
          const slowPace = startZone.pace_slow || '';
          const fastPace = endZone.pace_fast || '';
          const zoneLabel = `Zone ${start} - Zone ${end}`;

          return `${slowPace} - ${fastPace} (${zoneLabel})`;
        }

        // Fallback if zones aren't found in list
        paceRangeStr = `Zone ${start} - Zone ${end}`;
      }
      break;
    }

    default:
      paceRangeStr = "N/A";
  }

  // Append calculated speed string "8:15/mi" if available (for %pace or zone modes)
  if (calcPaceMps && unit !== 'secs' && unit !== 'sec') {
    const calculatedPaceStr = metersPerSecondToPaceStr(calcPaceMps);
    return `${calculatedPaceStr} (${paceRangeStr})`;
  }

  return paceRangeStr;
};

const parseSingleStep = (s, idx, thresholdPaceMps, zoneList) => {
  const rawIntensity = s.intensity || (s.warmup ? "warmup" : s.cooldown ? "cooldown" : "active");
  return {
    id: idx,
    isRepeat: false,
    durationSec: s.duration || 0,
    intensity: formatIntensityTitleCase(rawIntensity),
    paceStr: formatPaceString(s, thresholdPaceMps, zoneList),
    text: s.text || "No step text"
  };
};

const parseWorkoutSteps = (stepList, thresholdPaceMps) => {
  if (!Array.isArray(stepList)) return [];

  return stepList.map((s, idx) => {
    // Handle Repeat Blocks
    if (Array.isArray(s.steps) && s.steps.length > 0) {
      const reps = s.reps && Number.isInteger(s.reps) && s.reps > 0 ? s.reps : 1;
      const innerSteps = parseWorkoutSteps(s.steps, thresholdPaceMps);
      
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
    return parseSingleStep(s, idx, thresholdPaceMps);
  });
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
  export default function WorkoutTextSection({ workout, thresholdPace = null, paces }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workout) return null;

  console.log('[App Debug] paces: ', paces)

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
  const thresholdPaceMps = thresholdPace

  const zoneList = paceDetails?.preset_colors;

  const parsedSteps = parseWorkoutSteps(rawSteps, thresholdPaceMps, zoneList);

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
          <span className="workout-section-badge">
            Total Time: {formatDuration(totalWorkoutDurationSec)}
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