import React, { useEffect, useRef } from 'react';

// Convert speed in m/s to pace string in mm:ss /mi (rounded to nearest 5 seconds)
const metersPerSecondToPaceStr = (mps) => {
  if (!mps || mps <= 0) return null;
  const secPerMile = 1609.34 / mps;
  const roundedSecPerMile = Math.round(secPerMile / 5) * 5;
  const mins = Math.floor(roundedSecPerMile / 60);
  const secs = roundedSecPerMile % 60;
  const padSecs = String(secs).padStart(2, '0');
  return `${mins}:${padSecs} /mi`;
};

// Extract numeric value from step intensity objects/ranges (averages min/max if a range is given)
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

export default function WorkoutChart({ steps, containerId, thresholdPace }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!steps || !Array.isArray(steps) || !window.Highcharts) return;

    // Helper to recursively flatten steps (handles repetition loops/groups)
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

    const categories = [];
    const seriesData = [];

    flatSteps.forEach((step, idx) => {
      const label = step.name || (step.type ? step.type : `Step ${idx + 1}`);
      categories.push(label);

      // Extract target intensity percentage
      let targetVal = 0;
      let calculatedPaceStr = null;

      if (step.pace) {
        targetVal = extractTargetValue(step.pace);
      } else if (step.power) {
        targetVal = extractTargetValue(step.power);
      } else if (step.hr) {
        targetVal = extractTargetValue(step.hr);
      } else if (step.target) {
        targetVal = extractTargetValue(step.target);
      } else if (step.value) {
        targetVal = Number(step.value) || 0;
      }

      // Calculate pace from direct speed/pace or threshold pace
      if (step.speed) {
        const mps = extractTargetValue(step.speed);
        calculatedPaceStr = metersPerSecondToPaceStr(mps);
      } else if (typeof step.pace === 'object' && step.pace?.value > 15) {
        calculatedPaceStr = metersPerSecondToPaceStr(step.pace.value);
      } else if (thresholdPace && targetVal > 0) {
        const stepMps = thresholdPace * (targetVal / 100);
        calculatedPaceStr = metersPerSecondToPaceStr(stepMps);
      }

      seriesData.push({
        y: Math.round(targetVal),
        paceStr: calculatedPaceStr
      });
    });

    // Ensure DOM container exists
    if (!chartRef.current) return;

    // Render Highcharts Column Chart
    window.Highcharts.chart(chartRef.current, {
      chart: {
        type: 'column',
        height: 160,
        backgroundColor: 'transparent',
        spacing: [5, 5, 5, 5]
      },
      title: { text: null },
      xAxis: {
        categories: categories,
        labels: { style: { fontSize: '9px' } }
      },
      yAxis: {
        title: { text: null },
        labels: { style: { fontSize: '9px' } }
      },
      legend: { enabled: false },
      credits: { enabled: false },
      tooltip: {
        formatter: function() {
          const paceInfo = this.point.paceStr ? `<br/>Pace: <b>${this.point.paceStr}</b>` : '';
          return `<b>${this.x}</b><br/>Target: <b>${this.y}%</b>${paceInfo}`;
        }
      },
      series: [{
        name: 'Target Intensity',
        data: seriesData,
        color: '#007bff'
      }]
    });
  }, [steps, thresholdPace]);

  return <div ref={chartRef} id={containerId} style={{ width: '100%', height: '160px', marginTop: '10px' }} />;
}