    //
    // WorkoutChartHelpers.js
    //
    import { usePaces } from '../utils/PacesContext.jsx';

    // --- CHART CONFIGURATION CONSTANTS ---
    const WAVES_PER_MINUTE = 3;     // Number of wave cycles per minute across the top
    const WAVE_AMPLITUDE = 1.5;     // Amplitude in SVG viewBox units (0-100 scale)
    const VERTICAL_WAVE_CYCLES = 4; // Number of vertical wave cycles along the left & right sides
    const DEFAULT_FALLBACK_THRESHOLD_SEC = 360; // default threshold pace

    //
    //
    //-------------------------------------------------------------------------
    //-------------------------------------------------------------------------
    //-------------------------------------------------------------------------
    //
    //
    // - ZONE conversion helpers

    // Fallback zone config if PacesContext is not available
    const DEFAULT_PACE_ZONE_NAMES  = [  "Zone_1", "Zone_2", "Zone_3", "Zone_4","Zone_5a","Zone_5b","Zone_5c", "Zone 6"];
    const DEFAULT_PACE_ZONE_COLORS = [ "#b0b0b0","#88d8b0","#28a745","#ffc107","#fd7e14","#ff6b6b","#dc3545","#6f42c1"];
    const DEFAULT_PACE_ZONES       = [        80,       92,     94.3,      100,    103.4,    111.5,    128.9,      169];
    const DEFAULT_PACE_VAL_SEC     = [       620,      540,      525,      495,      480,      445,      330,      295];
    const DEFAULT_PACE_STR         = ["10:20/mi","9:00/mi","8:45/mi","8:15/mi","8:00/mi","7:25/mi","6:25/mi","4:55/mi"];

    /**
     * Dynamically resolves zone details using PacesContext zones, names, and colors.
     */
    export const getZoneDetailsFromPaces = (targetPace, paces) => {

        const zones  = paces?.pace_val_sec || DEFAULT_PACE_VAL_SEC;
        const names  = paces?.preset_colors?.map((item) => item.zone_name) || DEFAULT_PACE_ZONE_NAMES;
        const colors = paces?.preset_colors?.map((item) => item.color)     || DEFAULT_PACE_ZONE_COLORS;
        
        // Iterate through pace zone thresholds
        for (let i = 0; i < zones.length; i++) {
            if (targetPace >= zones[i]) {
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
        // Extract preset_colors list or fall back to empty array
        const presetColors = paces?.preset_colors || [];
    
        if (presetColors.length === 0) {
            // Fallback or default object if no preset colors exist
            return null;
        }
    
        let selectedZone;
    
        if (targetZone <= 0) {
            // Use the first zone (index 0)
            selectedZone = presetColors[0];
        } else {
            // Try to find matching zone by numeric id
            const matched = presetColors.find((item) => item.zone === targetZone);
    
            if (matched) {
                selectedZone = matched;
            } else {
                // Check if targetZone is greater than the highest zone number available
                const maxZone = Math.max(...presetColors.map((item) => item.zone));
    
                if (targetZone > maxZone) {
                    // Return the last zone in the list
                    selectedZone = presetColors[presetColors.length - 1];
                } else {
                    // Fallback for missing/unmatched intermediate numbers (defaults to first zone)
                    selectedZone = presetColors[0];
                }
            }
        }
    
        // Convert string paces "MM:SS/mi" to seconds integer if needed,
        // or calculate based on pace_val_sec
        const fastSec = selectedZone.pace_val_sec;
        const slowSec = fastSec + 90; // Or extract from pace_slow if pre-calculated
        const midSec = Math.floor((fastSec + slowSec) / 2);
    
        return {
            zone: selectedZone.zone,
            name: selectedZone.zone_name,
            color: selectedZone.color,
            slow: selectedZone.pace_slow,
            fast: selectedZone.pace_fast,
            fast_sec: fastSec,
            mid_sec: midSec,
            slow_sec: slowSec
        };
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
    
            const plannedSteps = flattened.map((step) => {
                // Destructure durationSec out so it is not included in restStep (...restStep)
                const { durationSec, ...restStep } = step;
    
                return {
                    ...restStep,
                    duration: step.duration || step.elapsed_time || durationSec || 60,
                    type: step.type || step.text || (step.warmup ? 'Warmup' : step.cooldown ? 'Cooldown' : 'Active')
                };
            });
    
            return plannedSteps;
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
        if (!step) return { min: 99, mid: 100, max: 101 };
      
        if (step.pace && typeof step.pace === 'object') {
          const start = step.pace.start ?? step.pace.value ?? 100;
          const end = step.pace.end ?? start;
          return {
            min: Math.min(start, end),
            mid: Math.round((start + end) / 2),
            max: Math.max(start, end)
          };
        }
      
        return { min: 99, mid: 100, max: 101 };
    };
      
    //
    // thresholdSecPerMile is the # of seconds to run a mile at threshold (495 for 8:15 pace)
    // output of this is the fast, slow and mid speed (as sec/mi aka 495 for 8:15) and % ranges
    //
    // output is returned in sec/mi (aka 495 for 8:15 threshold)
    export const extractPaceRangeInSeconds = (step, thresholdSecPerMile) => {
        if (!step) return null;

        // 1. Consume context
        const { paces, loading: pacesLoading } = usePaces();

        // if it is an executed step vs planned and a ride, it will have step.weighted_average_watts
        const rawWatts = parseFloat(step.average_watts ?? step.weighted_average_watts);
        if (!isNaN(rawWatts) && rawWatts > 0) {
            return { slowSec: rawWatts, 
                     midSec: rawWatts, 
                     fastSec: rawWatts, 
                     rangePct: { min: 99, mid: 100, max: 101 } };
        }
        
        // it if is an executed step vs planned but not a ride, it will have step.average_speed as m/s (3.25150 for 8:15 pace)
        const rawSpeed = parseFloat(step.average_speed ?? step.speed);
        if (!isNaN(rawSpeed) && rawSpeed > 0) {
            // convert 3.25150 to 495 for 8:15 pace
            const sec = speedToPaceSeconds(rawSpeed);
            return { slowSec: sec,
                     midSec: sec, 
                     fastSec: sec, 
                     rangePct: { min: 99, mid: 100, max: 101 } };
        }
        
        const refThresholdSec = (thresholdSecPerMile && thresholdSecPerMile > 0)
            ? thresholdSecPerMile
            : DEFAULT_FALLBACK_THRESHOLD_SEC;
        
        const rangePct = extractPaceRange(step);

        const handlers = {
            // rangePct.XX has the sec/mi (495 = 8:15)
            'secs': () => ({
                slowSec: rangePct.max,
                midSec:  rangePct.mid,
                fastSec: rangePct.min,
                rangePct
            }),
            
            // rangePct.XX has the % of threshold
            '%pace': () => ({
                slowSec: Math.round(rangePct.min > 0 ? refThresholdSec / (rangePct.min / 100) : refThresholdSec),
                midSec:  Math.round(rangePct.mid > 0 ? refThresholdSec / (rangePct.mid / 100) : refThresholdSec),
                fastSec: Math.round(rangePct.max > 0 ? refThresholdSec / (rangePct.max / 100) : refThresholdSec),
                rangePct
            }),

            // rangePct.XX has the zone #
            'pace_zone': () => {
                const slowDetails = getZoneDetailsFromZoneNumber(rangePct.min, paces);
                const midDetails  = getZoneDetailsFromZoneNumber(rangePct.mid,  paces);
                const fastDetails = getZoneDetailsFromZoneNumber(rangePct.max, paces);
            
                return {
                    slowSec: slowDetails?.slow_sec,
                    midSec:  midDetails?.mid_sec,
                    fastSec: fastDetails?.fast_sec,
                    rangePct
                };}
        };
            
        // Execute handler or run default if unit is missing/unrecognized
        const handler = handlers[step.pace?.units] || (() => ({
        fastSec: refThresholdSec,
        midSec: refThresholdSec,
        slowSec: refThresholdSec,
        rangePct: { min: 99, mid: 100, max: 101 }
        }));

        return handler();
    };

// =============================================================================
// INTERNAL HELPERS & PARSERS
// =============================================================================

/**
 * Extracts preset_colors array from the zonelist or paces input.
 */
const getZoneList = (pacesInput) => {
    if (!pacesInput) return [];
    if (Array.isArray(pacesInput)) return pacesInput;
    if (Array.isArray(pacesInput.preset_colors)) return pacesInput.preset_colors;
    return [];
  };
  
  /**
   * Extracts Threshold Pace in total seconds per mile from paces input or defaults.
   */
  export function getThresholdSecFromPaces(pacesInput) {
    if (!pacesInput) return 450; // Default 7:30/mi fallback if unspecified
    
    if (typeof pacesInput.thresholdSec === 'number') return pacesInput.thresholdSec;
    if (typeof pacesInput.threshold_pace_sec === 'number') return pacesInput.threshold_pace_sec;
    
    // Try to derive threshold from Zone 4 / Zone 5 boundary or preset_colors
    const zones = getZoneList(pacesInput);
    if (zones.length) {
      const z4 = zones.find(z => Number(z.zone) === 4) || zones[0];
      if (z4?.pace_val_sec) return z4.pace_val_sec;
      if (z4?.pace_fast) return parsePaceStrToSec(z4.pace_fast);
    }
    return 450;
  }
  
  /**
   * Normalizes pace string like "10:20/mi" -> "10:20"
   */
  const cleanPaceStr = (paceStr) => {
    if (!paceStr || typeof paceStr !== "string") return "";
    return paceStr.replace(/\/mi$/i, "").trim();
  };
  
  /**
   * Parses "10:20" or "10:20/mi" into total seconds per mile (620).
   */
  export function parsePaceStrToSec(paceStr) {
    const cleaned = cleanPaceStr(paceStr);
    if (!cleaned || cleaned === "0:00") return 0;
    const parts = cleaned.split(":");
    if (parts.length !== 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  
  /**
   * Formats seconds per mile (620) into "10:20".
   */
  export function formatSecPerMileToStr(totalSec) {
    if (!totalSec || isNaN(totalSec) || totalSec <= 0) return "--:--";
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
  
  /**
   * Finds matching zone number (1..N) from preset_colors for a given pace in seconds per mile.
   */
  export function getZoneFromPaceSec(paceSec, pacesInput) {
    const zones = getZoneList(pacesInput);
    if (!zones.length || !paceSec) return 1;
  
    for (const z of zones) {
      const fastSec = z.pace_val_sec || parsePaceStrToSec(z.pace_fast);
      const slowSec = parsePaceStrToSec(z.pace_slow);
  
      if (slowSec === 0) {
        if (paceSec >= fastSec) return Number(z.zone);
      } else {
        if (paceSec >= fastSec && paceSec <= slowSec) return Number(z.zone);
      }
    }
  
    const fastestZoneSec = Math.min(...zones.map((z) => z.pace_val_sec || 600));
    if (paceSec < fastestZoneSec) {
      return Math.max(...zones.map((z) => Number(z.zone)));
    }
  
    return 1;
  }
  
  // =============================================================================
  // CONVERSION MATH CORE
  // =============================================================================
  
  export function convertPaceSecToPct(paceSec, thresholdSec) {
    if (!paceSec || !thresholdSec) return 100;
    return Math.round((thresholdSec / paceSec) * 100);
  }
  
  export function convertPctToPaceSec(pct, thresholdSec) {
    if (!pct || !thresholdSec) return thresholdSec;
    return Math.round(thresholdSec / (pct / 100));
  }
  
  // =============================================================================
  // MASTER TARGET CONVERTER
  // =============================================================================
  
  /**
   * Converts a step's `pace` object between any target modes ("secs", "pace_zone", "%pace").
   * 
   * @param {Object} currentPace - Step `pace` object (e.g. { units: "%pace", start: 70, end: 90 })
   * @param {string} targetType - "zone" | "zone_range" | "pace" | "pace_range" | "pct" | "pct_range"
   * @param {Object|Array} pacesInput - The preset_colors zone list context
   * @returns {Object} Updated `pace` object matching schema
   */
  export function convertStepPaceTarget(currentPace, targetType, pacesInput) {
    const zones = getZoneList(pacesInput);
    const thresholdSec = getThresholdSecFromPaces(pacesInput);
    if (!currentPace) return currentPace;
  
    const findZone = (zNum) => zones.find((z) => Number(z.zone) === Number(zNum));
  
    const getZoneFastestSec = (zNum) => {
      const zObj = findZone(zNum);
      if (!zObj) return thresholdSec;
      return zObj.pace_val_sec || parsePaceStrToSec(zObj.pace_fast);
    };
  
    const getZoneSlowestSec = (zNum) => {
      const zObj = findZone(zNum);
      if (!zObj) return thresholdSec + 120;
      const slowSec = parsePaceStrToSec(zObj.pace_slow);
      return slowSec > 0 ? slowSec : getZoneFastestSec(zNum) + 120;
    };
  
    // Step 1: Normalize current pace into seconds (fastSec, slowSec)
    let currentFastSec = 0;
    let currentSlowSec = 0;
  
    if (currentPace.units === "secs") {
      if (currentPace.value != null) {
        currentFastSec = currentPace.value;
        currentSlowSec = currentPace.value;
      } else {
        currentFastSec = Math.min(currentPace.start, currentPace.end);
        currentSlowSec = Math.max(currentPace.start, currentPace.end);
      }
    } else if (currentPace.units === "pace_zone") {
      if (currentPace.value != null) {
        currentFastSec = getZoneFastestSec(currentPace.value);
        currentSlowSec = getZoneSlowestSec(currentPace.value);
      } else {
        const slowZ = Math.min(currentPace.start, currentPace.end);
        const fastZ = Math.max(currentPace.start, currentPace.end);
        currentFastSec = getZoneFastestSec(fastZ);
        currentSlowSec = getZoneSlowestSec(slowZ);
      }
    } else if (currentPace.units === "%pace") {
      if (currentPace.value != null) {
        currentFastSec = convertPctToPaceSec(currentPace.value, thresholdSec);
        currentSlowSec = currentFastSec;
      } else {
        const slowPct = Math.min(currentPace.start, currentPace.end);
        const fastPct = Math.max(currentPace.start, currentPace.end);
        currentFastSec = convertPctToPaceSec(fastPct, thresholdSec);
        currentSlowSec = convertPctToPaceSec(slowPct, thresholdSec);
      }
    }
  
    // Step 2: Convert normalized seconds to requested target shape
  
    // --- TARGET: PACE (secs) ---
    if (targetType === "pace") {
      return { units: "secs", value: currentFastSec };
    }
    if (targetType === "pace_range") {
      return { units: "secs", start: currentSlowSec, end: currentFastSec };
    }
  
    // --- TARGET: ZONE (pace_zone) ---
    if (targetType === "zone") {
      return { units: "pace_zone", value: getZoneFromPaceSec(currentFastSec, pacesInput) };
    }
    if (targetType === "zone_range") {
      return {
        units: "pace_zone",
        start: getZoneFromPaceSec(currentSlowSec, pacesInput),
        end: getZoneFromPaceSec(currentFastSec, pacesInput),
      };
    }
  
    // --- TARGET: THRESHOLD % (%pace) ---
    if (targetType === "pct") {
      return {
        units: "%pace",
        value: convertPaceSecToPct(currentFastSec, thresholdSec),
      };
    }
    if (targetType === "pct_range") {
      return {
        units: "%pace",
        start: convertPaceSecToPct(currentSlowSec, thresholdSec),
        end: convertPaceSecToPct(currentFastSec, thresholdSec),
      };
    }
  
    return currentPace;
  }
  
  // =============================================================================
  // STEP PARSER & DESCRIPTIVE TEXT EXTRACTOR
  // =============================================================================
  
  /**
   * Extracts normalized fastSec, slowSec, and descriptive labels for charts & UI text.
   */
  export function extractStepPaceRange(stepPace, pacesInput) {
    console.log('[App Debug WorkoutChartHelper] stepPace  : ', stepPace);
    console.log('[App Debug WorkoutChartHelper] pacesInput: ', pacesInput);

    if (!stepPace) return { fastSec: 0, slowSec: 0, formattedText: "" };
  
    const zones = getZoneList(pacesInput);
    const thresholdSec = getThresholdSecFromPaces(pacesInput);
    const findZone = (zNum) => zones.find((z) => Number(z.zone) === Number(zNum));
  
    let fastSec = 0;
    let slowSec = 0;
    let descriptiveLabel = "";
  
    // 1. Explicit Pace (`units: "secs"`)
    if (stepPace.units === "secs") {
      if (typeof stepPace.value === "number") {
        fastSec = stepPace.value;
        slowSec = stepPace.value;
        descriptiveLabel = `${formatSecPerMileToStr(fastSec)}/mi`;
      } else if (typeof stepPace.start === "number" && typeof stepPace.end === "number") {
        fastSec = Math.min(stepPace.start, stepPace.end);
        slowSec = Math.max(stepPace.start, stepPace.end);
        descriptiveLabel = `${formatSecPerMileToStr(slowSec)} - ${formatSecPerMileToStr(fastSec)}/mi`;
      }
    }
  
    // 2. Zone-Based (`units: "pace_zone"`)
    else if (stepPace.units === "pace_zone") {
      if (stepPace.value != null && zones.length) {
        const zObj = findZone(stepPace.value);
        if (zObj) {
          fastSec = zObj.pace_val_sec || parsePaceStrToSec(zObj.pace_fast);
          slowSec = parsePaceStrToSec(zObj.pace_slow) || (fastSec + 120);
  
          const fastStr = cleanPaceStr(zObj.pace_fast);
          let slowStr = cleanPaceStr(zObj.pace_slow);
          if (!slowStr || slowStr === "0:00") slowStr = formatSecPerMileToStr(slowSec);
  
          descriptiveLabel = `Zone ${stepPace.value} (${slowStr} - ${fastStr})`;
        }
      } else if (stepPace.start != null && stepPace.end != null && zones.length) {
        const slowZ = findZone(Math.min(stepPace.start, stepPace.end));
        const fastZ = findZone(Math.max(stepPace.start, stepPace.end));
  
        if (slowZ && fastZ) {
          fastSec = fastZ.pace_val_sec || parsePaceStrToSec(fastZ.pace_fast);
          slowSec = parsePaceStrToSec(slowZ.pace_slow) || (parsePaceStrToSec(slowZ.pace_fast) + 120);
  
          const fastPaceStr = cleanPaceStr(fastZ.pace_fast);
          let slowPaceStr = cleanPaceStr(slowZ.pace_slow);
          if (!slowPaceStr || slowPaceStr === "0:00") slowPaceStr = formatSecPerMileToStr(slowSec);
  
          descriptiveLabel = `Z${stepPace.start}-${stepPace.end} (${slowPaceStr} - ${fastPaceStr})`;
        }
      }
    }
  
    // 3. Threshold % (`units: "%pace"`)
    else if (stepPace.units === "%pace") {
      if (typeof stepPace.value === "number") {
        fastSec = convertPctToPaceSec(stepPace.value, thresholdSec);
        slowSec = fastSec;
        descriptiveLabel = `${stepPace.value}% Threshold (${formatSecPerMileToStr(fastSec)}/mi)`;
      } else if (typeof stepPace.start === "number" && typeof stepPace.end === "number") {
        const slowPct = Math.min(stepPace.start, stepPace.end);
        const fastPct = Math.max(stepPace.start, stepPace.end);
  
        fastSec = convertPctToPaceSec(fastPct, thresholdSec);
        slowSec = convertPctToPaceSec(slowPct, thresholdSec);
  
        descriptiveLabel = `${slowPct}%-${fastPct}% Threshold (${formatSecPerMileToStr(slowSec)} - ${formatSecPerMileToStr(fastSec)}/mi)`;
      }
    }
  
    console.log('[App Debug WorkoutChartHelper] fast/slow/text: ', fastsec, slowsec, descriptiveLabel);
    return { fastSec, slowSec, formattedText: descriptiveLabel };
  }