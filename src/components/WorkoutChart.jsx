import React, { useEffect, useRef } from 'react';

// Format seconds into MM:SS or H:MM:SS string
const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return "0s";
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}m ${secs}s`;
};

// Convert speed in m/s to pace string (mm:ss /mi) rounded to nearest 5s
const mpsToPaceStr = (mps) => {
  if (!mps || mps <= 0) return "N/A";
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  const padSecs = String(secs).padStart(2, '0');
  return `${mins}:${padSecs}`;
};

// Helper to extract numeric value from intensity object/range
const extractTargetValue = (targetObj) => {
  if (typeof targetObj === 'number') return targetObj;
  if (!targetObj || typeof targetObj !== 'object') return 0;

  const start = targetObj.start ?? targetObj.min ?? targetObj.value;
  const end = targetObj.end ?? targetObj.max;

  if (start !== undefined && end !== undefined && start !== end) {
    return (Number(start) + Number(end)) / 2;
  }
  return start !== undefined ? Number(start) : 0;
};

// Determine training zone name and color based on target percentage
const getZoneDetails = (targetPct, stepType = '') => {
  const typeLower = String(stepType).toLowerCase();

  if (typeLower.includes('warm') || typeLower.includes('cool') || typeLower.includes('rest') || targetPct < 75) {
    return { name: 'Warmup / Recovery (Z1)', color: '#6c757d' }; // Gray
  }
  if (targetPct < 88) {
    return { name: 'Endurance (Z2)', color: '#28a745' }; // Green
  }
  if (targetPct < 96) {
    return { name: 'Tempo (Z3)', color: '#ffc107' }; // Amber
  }
  if (targetPct <= 105) {
    return { name: 'Threshold (Z4)', color: '#fd7e14' }; // Orange
  }
  return { name: 'Anaerobic / VO2 Max (Z5+)', color: '#dc3545' }; // Red
};

export default function WorkoutChart({ steps, containerId, thresholdPace }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!steps || !Array.isArray(steps) || !window.Highcharts) return;

    // Helper to recursively flatten step lists (handles repeat blocks)
    const flattenSteps = (stepList) => {
      let result = [];
      stepList.forEach((s) => {
        if (!s) return;
        if (Array.isArray(s.steps)) {
          const repeatCount = s.repetition || 1;
          for (let i = 0; i < repeatCount; i++) {
            result = result.concat(flattenSteps(s.steps));
          }
        } else {
          result.push(s);
        }
      });
      return result;
    };

    const flatSteps = flattenSteps(steps);
    if (flatSteps.length === 0) return;

    const seriesData = [];
    let currentX = 0;
    let maxMps = 0;

    flatSteps.forEach((step, idx) => {
      const stepName = step.name || step.type || `Step ${idx + 1}`;
      const durationSec = Number(step.duration || step.moving_time || 60);

      // 1. Calculate Intensity Percentage
      let targetPct = 0;
      if (step.pace) targetPct = extractTargetValue(step.pace);
      else if (step.power) targetPct = extractTargetValue(step.power);
      else if (step.hr) targetPct = extractTargetValue(step.hr);
      else if (step.target) targetPct = extractTargetValue(step.target);
      else if (step.value) targetPct = Number(step.value) || 0;

      // 2. Resolve speed in m/s (higher speed = taller bar)
      let stepMps = 0;
      if (step.speed) {
        stepMps = extractTargetValue(step.speed);
      } else if (typeof step.pace === 'object' && step.pace?.value > 15) {
        stepMps = extractTargetValue(step.pace);
      } else if (thresholdPace && targetPct > 0) {
        stepMps = thresholdPace * (targetPct / 100);
      }

      if (stepMps > maxMps) {
        maxMps = stepMps;
      }

      // 3. Resolve Zone Name and Color
      const roundedPct = Math.round(targetPct);
      const zone = getZoneDetails(roundedPct, stepName);

      // Variwide data point format:
      // x = start timestamp/time offset
      // y = height (speed)
      // z = width (duration in seconds)
      seriesData.push({
        x: currentX,
        y: stepMps,
        z: durationSec,
        durationSec: durationSec,
        stepName: stepName,
        targetPct: roundedPct,
        paceStr: mpsToPaceStr(stepMps),
        color: zone.color,
        zoneName: zone.name
      });

      currentX += durationSec;
    });

    if (!chartRef.current) return;

    // Buffer above fastest speed interval
    const yAxisBufferMax = maxMps > 0 ? maxMps * 1.15 : 5;

    // Load variwide module dynamically if not present
    const isVariwideAvailable = typeof window.Highcharts.seriesTypes.variwide !== 'undefined';

    window.Highcharts.chart(chartRef.current, {
      chart: {
        type: isVariwideAvailable ? 'variwide' : 'column',
        height: 180,
        backgroundColor: 'transparent',
        spacing: [10, 10, 10, 10]
      },
      title: { text: null },
      xAxis: {
        type: 'linear',
        min: 0,
        max: currentX,
        title: { text: null },
        labels: {
          formatter: function() {
            return formatDuration(this.value);
          },
          style: { fontSize: '9px' }
        }
      },
      yAxis: {
        min: 0,
        max: yAxisBufferMax,
        title: { text: 'Pace', style: { fontSize: '10px' } },
        labels: {
          formatter: function() {
            return this.value > 0 ? mpsToPaceStr(this.value) : '';
          },
          style: { fontSize: '9px' }
        }
      },
      legend: { enabled: false },
      credits: { enabled: false },
      plotOptions: {
        variwide: {
          groupPadding: 0,
          pointPadding: 0,
          borderWidth: 1,
          borderColor: '#ffffff',
          crisp: false
        },
        column: {
          groupPadding: 0,
          pointPadding: 0,
          borderWidth: 1,
          borderColor: '#ffffff',
          crisp: false
        }
      },
      tooltip: {
        formatter: function() {
          const pt = this.point;
          const paceDisplay = pt.paceStr !== "N/A" ? `${pt.paceStr} /mi` : 'N/A';
          return `
            <b>${pt.stepName}</b><br/>
            Zone: <span style="color:${pt.color}; font-weight:bold;">${pt.zoneName}</span><br/>
            Duration: <b>${formatDuration(pt.durationSec)}</b><br/>
            Pace: <b>${paceDisplay}</b> (${pt.targetPct}% threshold)
          `;
        }
      },
      series: [{
        name: 'Target Pace',
        data: seriesData
      }]
    });
  }, [steps, thresholdPace]);

  return <div ref={chartRef} id={containerId} style={{ width: '100%', height: '180px', marginTop: '10px' }} />;
}