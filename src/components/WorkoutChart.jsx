import React, { useEffect, useRef } from 'react';

export default function WorkoutChart({ steps, sportType = 'Run', sportSettings = [], containerId }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!steps || !Array.isArray(steps) || !window.Highcharts) return;

    // Resolve sport settings for current activity type
    const sportConfig = (Array.isArray(sportSettings) ? sportSettings : []).find((s) => 
      s.id?.toLowerCase() === sportType?.toLowerCase() || 
      s.types?.includes(sportType)
    ) || {};

    const thresholdPaceMps = sportConfig.threshold_pace || null; // m/s
    const ftp = sportConfig.ftp || null; // Watts
    const lthr = sportConfig.lthr || null; // BPM

    // Recursively flatten steps
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
    const tooltipLabels = [];

    flatSteps.forEach((step, idx) => {
      const label = step.name || (step.type ? step.type : `Step ${idx + 1}`);
      categories.push(label);

      let chartDisplayValue = 0;
      let displayString = '';

      const isSwim = ['swim', 'openwaterswim'].includes(sportType?.toLowerCase());
      const isBike = ['ride', 'virtualride', 'eride'].includes(sportType?.toLowerCase());

      // 1. PACE TARGETS
      if (step.pace) {
        const pct = typeof step.pace === 'object' ? (step.pace.value || step.pace.start || 0) : step.pace;
        chartDisplayValue = pct;

        if (thresholdPaceMps && pct > 0) {
          const stepSpeedMps = thresholdPaceMps * (pct / 100);

          if (isSwim) {
            // Swim: sec / 100 yards
            const secPer100Yd = 91.44 / stepSpeedMps;
            const min = Math.floor(secPer100Yd / 60);
            const sec = Math.round(secPer100Yd % 60);
            displayString = `${min}:${String(sec).padStart(2, '0')} /100yd (${pct}%)`;
          } else if (isBike) {
            // Bike Speed: mph
            const mph = (stepSpeedMps * 2.23694).toFixed(1);
            displayString = `${mph} mph (${pct}%)`;
          } else {
            // Run Pace: sec / mile
            const secPerMile = 1609.344 / stepSpeedMps;
            const min = Math.floor(secPerMile / 60);
            const sec = Math.round(secPerMile % 60);
            displayString = `${min}:${String(sec).padStart(2, '0')} /mi (${pct}%)`;
          }
        } else {
          displayString = `${pct}% Pace`;
        }
      } 
      // 2. POWER TARGETS (Watts / FTP %)
      else if (step.power) {
        const pct = typeof step.power === 'object' ? (step.power.value || step.power.start || 0) : step.power;
        chartDisplayValue = pct;

        if (ftp && pct > 0) {
          const watts = Math.round(ftp * (pct / 100));
          displayString = `${watts} W (${pct}% FTP)`;
        } else {
          displayString = `${pct}% FTP`;
        }
      } 
      // 3. HEART RATE TARGETS (BPM / LTHR %)
      else if (step.hr) {
        const pct = typeof step.hr === 'object' ? (step.hr.value || step.hr.start || 0) : step.hr;
        chartDisplayValue = pct;

        if (lthr && pct > 0) {
          const bpm = Math.round(lthr * (pct / 100));
          displayString = `${bpm} bpm (${pct}% LTHR)`;
        } else {
          displayString = `${pct}% LTHR`;
        }
      } 
      // 4. FALLBACK / GENERIC VALUE
      else {
        const val = step.value || step.target || 0;
        chartDisplayValue = val;
        displayString = `${val}%`;
      }

      seriesData.push(Math.round(chartDisplayValue));
      tooltipLabels.push(displayString);
    });

    if (!chartRef.current) return;

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
          const formattedTarget = tooltipLabels[this.point.index];
          return `<b>${this.x}</b><br/>Target: <b>${formattedTarget}</b>`;
        }
      },
      series: [{
        name: 'Target Intensity',
        data: seriesData,
        color: '#007bff'
      }]
    });
  }, [steps, sportType, sportSettings]);

  return <div ref={chartRef} id={containerId} style={{ width: '100%', height: '160px', marginTop: '10px' }} />;
}