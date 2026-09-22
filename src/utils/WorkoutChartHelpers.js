    //
    // WorkoutChartHelpers.js
    //
    import { usePaces } from '../utils/PacesContext.jsx';

    // --- CHART CONFIGURATION CONSTANTS ---
    const WAVES_PER_MINUTE = 3;     // Number of wave cycles per minute across the top
    const WAVE_AMPLITUDE = 1.5;     // Amplitude in SVG viewBox units (0-100 scale)
    const VERTICAL_WAVE_CYCLES = 4; // Number of vertical wave cycles along the left & right sides
    const DEFAULT_FALLBACK_THRESHOLD_SEC = 480; // default threshold pace

    //
    //
    //-------------------------------------------------------------------------
    //-------------------------------------------------------------------------
    //-------------------------------------------------------------------------
    //
    //
    // - ZONE conversion helpers

    // Fallback zone config if PacesContext is not available
    const DEFAULT_PACE_ZONES       = [80,   92, 94.3, 100, 103.4, 111.5, 150];
    const DEFAULT_PACE_VAL_SEC     = [619, 538,  525, 495,   479,   444, 330];
    const DEFAULT_PACE_ZONE_NAMES  = ["Zone_1", "Zone_2", "Zone_3", "Zone_4", "Zone_5a", "Zone_5b", "Zone_5c"];
    const DEFAULT_PACE_ZONE_COLORS = ["#88d8b0", "#fd7e14", "#fd7e14", "#ff6b6b", "#dc3545", "#6f42c1", "#343a40"];

    /**
     * Dynamically resolves zone details using PacesContext zones, names, and colors.
     */
    export const getZoneDetailsFromPaces = (targetPace, paces) => {

        const zones  = paces?.pace_val_sec     || DEFAULT_PACE_VAL_SEC;
        const names  = paces?.pace_zone_names  || DEFAULT_PACE_ZONE_NAMES;
        const colors = paces?.pace_zone_colors || DEFAULT_PACE_ZONE_COLORS;

        // Iterate through pace zone thresholds
        for (let i = 0; i < zones.length; i++) {
            if (targetPace > zones[i]) {
            return {
                name:  names[i]  || `Zone ${i + 1}`,
                color: colors[i] || '#28a745'
            };
            }
        }

        // Fallback for extreme efforts above highest threshold
        const lastIdx = zones.length - 1;
        return {
            name: names[lastIdx] || `Zone ${zones.length}`,
            color: colors[lastIdx] || '#343a40'
        };
    };

    /**
     * Dynamically resolves zone details using PacesContext zones, names, and colors.
     */
    export const getZoneDetailsFromZoneNumber = (targetZone, paces) => {

        const zones  = paces?.pace_val_sec     || DEFAULT_PACE_VAL_SEC;
        const names  = paces?.pace_zone_names  || DEFAULT_PACE_ZONE_NAMES;
        const colors = paces?.pace_zone_colors || DEFAULT_PACE_ZONE_COLORS;

        if (targetZone > zones.length) {
            const lastIdx = zones.length - 1;
            return {name:  names[lastIdx], 
                    color: colors[lastIdx], 
                    slow:  zones[lastIdx-1]-1,
                    mid:   Math.floor((zones[lastIdx-1]-1+zones[lastIdx])/2),
                    fast:  zones[lastIdx]};
        } else if (targetZone <= 0) {
            return {name:  names[0], 
                    color: colors[0], 
                    slow:  zones[0]+90,
                    mid:   Math.floor((zones[0]+90+zones[0])/2),
                    fast:  zones[0]};
        } else {
            return {name:  names[targetZone], 
                    color: colors[targetZone], 
                    slow:  zones[targetZone-1]-1,
                    mid:   Math.floor((zones[targetZone-1]-1+zones[targetZone])/2),
                    fast:  zones[targetZone]};
        }

    };

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

    const extractPaceRange = (step) => {
        if (!step) return { start: 100, mid: 100, end: 100 };
      
        if (step.pace && typeof step.pace === 'object') {
          const start = step.pace.start ?? step.pace.value ?? 100;
          const end = step.pace.end ?? start;
          return {
            start: Math.min(start, end),
            mid: (start + end) / 2,
            end: Math.max(start, end)
          };
        }
      
        return { start: 100, end: 100, mid: 100 };
      };
      
      //
      // thresholdSecPerMile is the # of seconds to run a mile at threshold (495 for 8:15 pace)
      // output of this is the fast, slow and mid speed (as sec/mi aka 495 for 8:15) and % ranges
      //
      export const extractPaceRangeInSeconds = (step, thresholdSecPerMile) => {
        if (!step) return null;

        // 1. Consume context
        const { paces, loading: pacesLoading } = usePaces();

        // if it is an executed step vs planned and a ride, it will have step.weighted_average_watts
        const rawWatts = parseFloat(step.average_watts ?? step.weighted_average_watts);
        if (!isNaN(rawWatts) && rawWatts > 0) {
          return { slowSec: rawWatts, midSec: rawWatts, fastSec: rawWatts, rangePct: { start: 100, mid: 100, end: 100 } };
        }
      
        // it if is an executed step vs planned but not a ride, it will have step.average_speed as m/s (3.25150 for 8:15 pace)
        const rawSpeed = parseFloat(step.average_speed ?? step.speed);
        if (!isNaN(rawSpeed) && rawSpeed > 0) {
            // convert 3.25150 to 495 for 8:15 pace
          const sec = speedToPaceSeconds(rawSpeed);
          return { slowSec: sec, midSec: sec, fastSec: sec, rangePct: { start: 100, mid: 100, end: 100 } };
        }
      
        // if step.pace is a number, if it is m/s (3.25150) it will be converted to s/mi (495) for 8:15 pace
        // I don't think this happens as pace is a collection of elements, not one itself
        if (typeof step.pace === 'number' && step.pace > 0) {
          const sec = step.pace < 15 ? speedToPaceSeconds(step.pace) : step.pace;
          return { slowSec: sec, midSec: sec, fastSec: sec, rangePct: { start: 100, mid: 100, end: 100 } };
        }
      
        const refThresholdSec = (thresholdSecPerMile && thresholdSecPerMile > 0)
          ? thresholdSecPerMile
          : DEFAULT_FALLBACK_THRESHOLD_SEC;
      
        const rangePct = extractPaceRange(step);

          // Assuming variables: pace, refThresholdSec, rangePct, zoneService
        const handlers = {
            // rangePct.XX has the sec/mi (495 = 8:15)
            'secs': () => ({
                slowSec: rangePct.start,
                midSec:  rangePct.mid,
                fastSec: rangePct.end,
                rangePct
            }),
          
            // rangePct.XX has the % of threshold
            '%pace': () => ({
                slowSec: rangePct.start > 0 ? refThresholdSec / (rangePct.start / 100) : refThresholdSec,
                midSec:  rangePct.mid   > 0 ? refThresholdSec / (rangePct.mid / 100)   : refThresholdSec,
                fastSec: rangePct.end   > 0 ? refThresholdSec / (rangePct.end / 100)   : refThresholdSec,
                rangePct
            }),

            // rangePct.XX has the zone #
            'pace_zonex': () => {
              const zone = PACE_ZONES[step.pace?.value] || PACE_ZONES[4];
              const sec = zone.targetPct > 0 ? refThresholdSec / (zone.targetPct / 100) : refThresholdSec;
              return {
                slowSec: getZoneDetailsFromZoneNumber(rangePct.start, paces),
                midSec:  getZoneDetailsFromZoneNumber(rangePct.mid, paces),
                fastSec: getZoneDetailsFromZoneNumber(rangePct.end, paces),
                rangePct
              };
            }

          };
          
          // Execute handler or run default if unit is missing/unrecognized
          const handler = handlers[step.pace?.units] || (() => ({
            fastSec: refThresholdSec,
            midSec: refThresholdSec,
            slowSec: refThresholdSec,
            rangePct: { start: 100, end: 100, mid: 100 }
          }));
          
        return handler();
      };
      
      