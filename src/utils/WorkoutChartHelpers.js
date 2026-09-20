// --- CHART CONFIGURATION CONSTANTS ---
const WAVES_PER_MINUTE = 3;     // Number of wave cycles per minute across the top
const WAVE_AMPLITUDE = 1.5;     // Amplitude in SVG viewBox units (0-100 scale)
const VERTICAL_WAVE_CYCLES = 4; // Number of vertical wave cycles along the left & right sides

    // -- Helper to make titles look nice
    export const formatIntensityTitleCase = (val) => {
        if (!val) return "Active";
        const str = String(val);
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    // -- Helper to strictly parse boolean values from props
    export const parseBoolProp = (val, defaultValue = true) => {
        if (val === undefined) return defaultValue;
        if (typeof val === 'string') return val.toLowerCase() === 'true';
        return Boolean(val);
    };

    // -- Convert m/s to pace (example: 3.25120 m/s => 495)
    export const speedToPaceSeconds = (speedMps) => {
        if (typeof speedMps !== 'number' || speedMps <= 0 || isNaN(speedMps)) return null;
        return 1609.344 / speedMps;
      };
        
    // - Convert s/mi to pace (example: 495 s/mi => "8:15 mi")
    export const formatSecPerMileToStr = (secPerMile) => {
        if (!secPerMile || secPerMile <= 0 || isNaN(secPerMile)) return "N/A";
        const totalSecs = Math.round(secPerMile);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}:${String(secs).padStart(2, '0')} /mi`;
    };
      
    // -- Helper to generate the wavy bars for executed plans
    export const generateWavyBarPath = (durationMinutes = 1) => {

        const topCycles = Math.max(2, Math.round(durationMinutes * WAVES_PER_MINUTE));
        const amp = WAVE_AMPLITUDE;
        const verticalCycles = VERTICAL_WAVE_CYCLES;

        const topStep = 100 / topCycles;
        let d = `M 0 ${amp}`;
        for (let i = 0; i < topCycles; i++) {
            const startX = i * topStep;
            const endX = startX + topStep;
            const cp1Y = i % 2 === 0 ? -amp : amp * 2;
            const cp2Y = i % 2 === 0 ? amp * 2 : -amp;
            const endY = i % 2 === 0 ? amp : 0;

            d += ` C ${startX + topStep * 0.25} ${cp1Y}, ${startX + topStep * 0.75} ${cp2Y}, ${endX} ${endY}`;
        }

        const sideStep = (100 - amp) / verticalCycles;
        for (let i = 0; i < verticalCycles; i++) {
            const startY = amp + (i * sideStep);
            const endY = startY + sideStep;
            const cp1X = i % 2 === 0 ? 100 + amp : 100 - amp;
            const cp2X = i % 2 === 0 ? 100 - amp : 100 + amp;

            d += ` C ${cp1X} ${startY + sideStep * 0.25}, ${cp2X} ${startY + sideStep * 0.75}, 100 ${endY}`;
        }

        d += ` L 0 100`;

        for (let i = verticalCycles - 1; i >= 0; i--) {
            const startY = amp + ((i + 1) * sideStep);
            const endY = amp + (i * sideStep);
            const cp1X = i % 2 === 0 ? -amp : amp;
            const cp2X = i % 2 === 0 ? amp : -amp;

            d += ` C ${cp1X} ${startY - sideStep * 0.25}, ${cp2X} ${startY - sideStep * 0.75}, 0 ${endY}`;
        }

        d += ` Z`;
        return d;
    };
  
    // -- Helper to convert repeats into a flat list of intervals
    export const flattenSteps = (stepsList) => {
        if (!Array.isArray(stepsList)) return [];

        return stepsList.reduce((acc, step) => {
            if (Array.isArray(step.steps) && step.steps.length > 0) {
            const reps = step.reps && Number.isInteger(step.reps) && step.reps > 0 ? step.reps : 1;
            const innerFlattened = flattenSteps(step.steps);

            for (let i = 0; i < reps; i++) {
                acc.push(...innerFlattened.map((s) => {
                const { steps, reps, duration, distance, ...cleanStep } = s;
                return {
                    ...cleanStep,
                    duration: s.duration || 60
                };
                }));
            }
            } else {
            acc.push(step);
            }
            return acc;
        }, []);
    };

    // -- Helper to get the Planned steps (if any) from the input workout
    export const extractPlannedSteps = (workout) => {
        if (!workout?.workout_doc) return [];
        try {
            const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
            const rawSteps = doc?.steps || [];
            const flattened = flattenSteps(rawSteps);
        
            return flattened.map((step) => ({
            ...step,
            duration: step.duration || step.elapsed_time || 60,
            type: step.type || step.text || (step.warmup ? 'Warmup' : step.cooldown ? 'Cooldown' : 'Active')
            }));
        } catch (e) {
            console.error('Error parsing workout_doc:', e);
            return [];
        }
    };
        
    // -- Helper to get the Executed steps (if any) from the input workout
    export const extractExecutedSteps = (workout) => {
        if (!workout || !Array.isArray(workout.intervals) || workout.intervals.length === 0) return [];

        return workout.intervals.map((interval) => {
            const rawSpeed = parseFloat(interval.average_speed ?? interval.speed);
            const speed = !isNaN(rawSpeed) && rawSpeed > 0 ? rawSpeed : null;

            return {
            ...interval,
            duration: interval.elapsed_time || interval.duration || 60,
            pace: speedToPaceSeconds(speed),
            speed: speed,
            type: interval.type || 'Interval'
            };
        });
    };

    const extractPaceRangePct = (step) => {
        if (!step) return { start: 100, end: 100, mid: 100 };
      
        if (step.pace && typeof step.pace === 'object') {
          const start = step.pace.start ?? step.pace.value ?? 100;
          const end = step.pace.end ?? start;
          return {
            start: Math.min(start, end),
            end: Math.max(start, end),
            mid: (start + end) / 2
          };
        }
      
        const val = step.target ?? step.intensityPct ?? step.intensity;
        if (typeof val === 'number' && val > 0) {
          return { start: val, end: val, mid: val };
        }
      
        if (typeof val === 'object' && val !== null) {
          const start = val.start ?? val.value ?? 100;
          const end = val.end ?? start;
          return {
            start: Math.min(start, end),
            end: Math.max(start, end),
            mid: (start + end) / 2
          };
        }
      
        return { start: 100, end: 100, mid: 100 };
      };
      
      export const extractPaceRangeInSeconds = (step, thresholdSecPerMile) => {
        if (!step) return null;
      
        const rawSpeed = parseFloat(step.average_speed ?? step.speed);
        if (!isNaN(rawSpeed) && rawSpeed > 0) {
          const sec = speedToPaceSeconds(rawSpeed);
          return { fastSec: sec, slowSec: sec, midSec: sec, rangePct: { start: 100, end: 100, mid: 100 } };
        }
      
        if (typeof step.pace === 'number' && step.pace > 0) {
          const sec = step.pace < 15 ? speedToPaceSeconds(step.pace) : step.pace;
          return { fastSec: sec, slowSec: sec, midSec: sec, rangePct: { start: 100, end: 100, mid: 100 } };
        }
      
        const rangePct = extractPaceRangePct(step);
        const refThresholdSec = (thresholdSecPerMile && thresholdSecPerMile > 0)
          ? thresholdSecPerMile
          : DEFAULT_FALLBACK_THRESHOLD_SEC;
      
        const fastSec = rangePct.end > 0 ? refThresholdSec / (rangePct.end / 100) : refThresholdSec;
        const slowSec = rangePct.start > 0 ? refThresholdSec / (rangePct.start / 100) : refThresholdSec;
        const midSec = rangePct.mid > 0 ? refThresholdSec / (rangePct.mid / 100) : refThresholdSec;
      
        return { fastSec, slowSec, midSec, rangePct };
      };
      
      