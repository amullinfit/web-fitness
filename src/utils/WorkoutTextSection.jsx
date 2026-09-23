//
// WorkoutTextSection.jsx
//
import React, { useState } from 'react';
import './WorkoutTextSection.css';

const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (num) => String(num).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  return `${mins}:${String(secs).padStart(2, '0')} /mi`;
};

const formatIntensityTitleCase = (val) => {
  if (!val) return "N/A";
  const str = String(val);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const formatPaceString = (s, thresholdPaceMps) => {
  let paceRangeStr = "N/A";
  let calcPaceMps = null;

  if (s.pace) {
    const startPct = s.pace.start || 0;
    const endPct = s.pace.end || 0;
    paceRangeStr = `${startPct}-${endPct}% pace`;

    if (thresholdPaceMps) {
      const avgPct = (startPct + endPct) / 2;
      calcPaceMps = thresholdPaceMps * (avgPct / 100);
    }
  }

  const calculatedPaceStr = calcPaceMps ? metersPerSecondToPaceStr(calcPaceMps) : null;
  return calculatedPaceStr ? `${calculatedPaceStr} (${paceRangeStr})` : paceRangeStr;
};

const parseSingleStep = (s, idx, thresholdPaceMps) => {
  const rawIntensity = s.intensity || (s.warmup ? "warmup" : s.cooldown ? "cooldown" : "active");
  return {
    id: idx,
    isRepeat: false,
    durationSec: s.duration || 0,
    intensity: formatIntensityTitleCase(rawIntensity),
    paceStr: formatPaceString(s, thresholdPaceMps),
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

export default function WorkoutTextSection({ workout, thresholdPace = null }) {
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

  // Resolve numeric threshold pace value directly (handles raw numbers or simple pace objects)
  // thresholdPace passes as sec/mi
  const thresholdPaceMps = typeof thresholdPace === 'number'
    ? thresholdPace
    : thresholdPace?.threshold_pace || thresholdPace?.run_pace_sec || null;

  const debugSteps = parseWorkoutSteps(rawSteps, thresholdPaceMps);

  // Calculate Total Overall Workout Duration
  const totalWorkoutDurationSec = debugSteps.reduce((sum, step) => sum + step.durationSec, 0);

  return (
    <div className="workout-section-container">
      <div className="workout-section-header-box">
        <div 
          onClick={() => setIsOpen((prev) => !prev)}
          className="workout-section-toggle"
        >
          <span className="workout-section-title">
            {isOpen ? '▼' : '►'} Workout Details ({debugSteps.length} block{debugSteps.length === 1 ? '' : 's'})
          </span>
          <span className="workout-section-badge">
            Total Time: {formatDuration(totalWorkoutDurationSec)}
          </span>
        </div>

        {isOpen && (
          <div className="workout-section-content">
            {debugSteps.length === 0 ? (
              <div className="workout-section-empty">No parsed step data available in workout_doc.</div>
            ) : (
              <div className="workout-steps-list">
                {debugSteps.map((step, sIdx) => (
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