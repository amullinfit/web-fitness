//
// WorkoutChartHelpers.js
//

// --- CHART CONFIGURATION CONSTANTS ---
const WAVES_PER_MINUTE = 3;     // Number of wave cycles per minute across the top
const WAVE_AMPLITUDE = 1.5;     // Amplitude in SVG viewBox units (0-100 scale)
const VERTICAL_WAVE_CYCLES = 4; // Number of vertical wave cycles along the left & right sides
const DEFAULT_FALLBACK_THRESHOLD_SEC = 360; // Default threshold pace (6:00/mi fallback)

// Fallback zone config if PacesContext is not available
const DEFAULT_PACE_ZONE_NAMES  = ["Zone_1", "Zone_2", "Zone_3", "Zone_4", "Zone_5a", "Zone_5b", "Zone_5c", "Zone 6"];
const DEFAULT_PACE_ZONE_COLORS = ["#b0b0b0", "#88d8b0", "#28a745", "#ffc107", "#fd7e14", "#ff6b6b", "#dc3545", "#6f42c1"];
const DEFAULT_PACE_VAL_SEC     = [620, 540, 525, 495, 480, 445, 330, 295];

// =============================================================================
// ZONE CONVERSION HELPERS
// =============================================================================

export const getZoneDetailsFromPaces = (targetPace, paces) => {
    const zones  = paces?.pace_val_sec || DEFAULT_PACE_VAL_SEC;
    const names  = paces?.preset_colors?.map((item) => item.zone_name) || DEFAULT_PACE_ZONE_NAMES;
    const colors = paces?.preset_colors?.map((item) => item.color)     || DEFAULT_PACE_ZONE_COLORS;
    
    for (let i = 0; i < zones.length; i++) {
        if (targetPace >= zones[i]) {
            return {
                name:  names[i]  || `Zone ${i + 1}`,
                color: colors[i] || '#28a745'
            };
        }
    }

    const lastIdx = zones.length - 1;
    return {
        name: names[lastIdx] || `Zone ${zones.length}`,
        color: colors[lastIdx] || '#343a40'
    };
};

export const getZoneDetailsFromZoneNumber = (targetZone, paces) => {
    const presetColors = paces?.preset_colors || [];
    if (presetColors.length === 0) return null;

    let selectedZone;
    if (targetZone <= 0) {
        selectedZone = presetColors[0];
    } else {
        const matched = presetColors.find((item) => Number(item.zone) === Number(targetZone));
        if (matched) {
            selectedZone = matched;
        } else {
            const maxZone = Math.max(...presetColors.map((item) => Number(item.zone)));
            selectedZone = targetZone > maxZone ? presetColors[presetColors.length - 1] : presetColors[0];
        }
    }

    const fastSec = selectedZone.pace_val_sec || parsePaceStrToSec(selectedZone.pace_fast) || DEFAULT_FALLBACK_THRESHOLD_SEC;
    const slowSec = parsePaceStrToSec(selectedZone.pace_slow) || (fastSec + 90);
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

export const formatIntensityTitleCase = (val) => {
    if (!val) return "Active";
    const str = String(val);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const parseBoolProp = (val, defaultValue = true) => {
    if (val === undefined) return defaultValue;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
};

export const speedToPaceSeconds = (speedMps) => {
    if (typeof speedMps !== 'number' || speedMps <= 0 || isNaN(speedMps)) return null;
    return 1609.344 / speedMps;
};

// =============================================================================
// STEP PARSING & NORMALIZATION
// =============================================================================

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
                        duration: s.duration || s.elapsed_time || 60
                    };
                }));
            }
        } else {
            acc.push(step);
        }
        return acc;
    }, []);
};

export const extractPlannedSteps = (workout) => {
    if (!workout?.workout_doc) return [];
    try {
        const doc = typeof workout.workout_doc === 'string' ? JSON.parse(workout.workout_doc) : workout.workout_doc;
        const rawSteps = doc?.steps || [];
        const flattened = flattenSteps(rawSteps);

        return flattened.map((step) => {
            const { durationSec, ...restStep } = step;
            return {
                ...restStep,
                duration: step.duration || step.elapsed_time || durationSec || 60,
                type: step.type || step.text || (step.warmup ? 'Warmup' : step.cooldown ? 'Cooldown' : 'Active')
            };
        });
    } catch (e) {
        console.error('Error parsing workout_doc:', e);
        return [];
    }
};

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

/**
 * FIXED: Pass `paces` object as an argument instead of calling `usePaces()` hook internally.
 */
export const extractPaceRangeInSeconds = (step, thresholdSecPerMile, paces) => {
    if (!step) return null;

    // Cycling / Watt-based efforts
    const rawWatts = parseFloat(step.average_watts ?? step.weighted_average_watts);
    if (!isNaN(rawWatts) && rawWatts > 0) {
        return {
            slowSec: rawWatts,
            midSec: rawWatts,
            fastSec: rawWatts,
            rangePct: { min: 99, mid: 100, max: 101 }
        };
    }

    // Executed workout interval (m/s speed)
    const rawSpeed = parseFloat(step.average_speed ?? step.speed);
    if (!isNaN(rawSpeed) && rawSpeed > 0) {
        const sec = speedToPaceSeconds(rawSpeed);
        return {
            slowSec: sec,
            midSec: sec,
            fastSec: sec,
            rangePct: { min: 99, mid: 100, max: 101 }
        };
    }

    const refThresholdSec = (thresholdSecPerMile && thresholdSecPerMile > 0)
        ? thresholdSecPerMile
        : getThresholdSecFromPaces(paces);

    const stepPace = step.pace;
    if (!stepPace) {
        return {
            slowSec: refThresholdSec,
            midSec: refThresholdSec,
            fastSec: refThresholdSec,
            rangePct: { min: 99, mid: 100, max: 101 }
        };
    }

    // Units: "secs" (explicit pace)
    if (stepPace.units === 'secs') {
        const val = stepPace.value ?? stepPace.start ?? refThresholdSec;
        const start = stepPace.start ?? val;
        const end = stepPace.end ?? val;
        return {
            slowSec: Math.max(start, end),
            midSec: Math.round((start + end) / 2),
            fastSec: Math.min(start, end),
            rangePct: { min: 99, mid: 100, max: 101 }
        };
    }

    // Units: "%pace" (threshold percentage)
    if (stepPace.units === '%pace') {
        const val = stepPace.value ?? stepPace.start ?? 100;
        const startPct = stepPace.start ?? val;
        const endPct = stepPace.end ?? val;
        const minPct = Math.min(startPct, endPct);
        const maxPct = Math.max(startPct, endPct);

        return {
            slowSec: Math.round(minPct > 0 ? refThresholdSec / (minPct / 100) : refThresholdSec),
            midSec: Math.round(refThresholdSec / (((minPct + maxPct) / 2) / 100)),
            fastSec: Math.round(maxPct > 0 ? refThresholdSec / (maxPct / 100) : refThresholdSec),
            rangePct: { min: minPct, mid: (minPct + maxPct) / 2, max: maxPct }
        };
    }

    // Units: "pace_zone"
    if (stepPace.units === 'pace_zone') {
        const targetZone = stepPace.value ?? stepPace.start ?? 1;
        const details = getZoneDetailsFromZoneNumber(targetZone, paces);
        return {
            slowSec: details?.slow_sec || refThresholdSec + 60,
            midSec: details?.mid_sec || refThresholdSec,
            fastSec: details?.fast_sec || refThresholdSec - 30,
            rangePct: { min: 99, mid: 100, max: 101 }
        };
    }

    return {
        slowSec: refThresholdSec,
        midSec: refThresholdSec,
        fastSec: refThresholdSec,
        rangePct: { min: 99, mid: 100, max: 101 }
    };
};

// =============================================================================
// INTERNAL HELPERS & PARSERS
// =============================================================================

const getZoneList = (pacesInput) => {
    if (!pacesInput) return [];
    if (Array.isArray(pacesInput)) return pacesInput;
    if (Array.isArray(pacesInput.preset_colors)) return pacesInput.preset_colors;
    return [];
};

export function getThresholdSecFromPaces(pacesInput) {
    if (!pacesInput) return 450;
    if (typeof pacesInput.thresholdSec === 'number') return pacesInput.thresholdSec;
    if (typeof pacesInput.threshold_pace_sec === 'number') return pacesInput.threshold_pace_sec;

    const zones = getZoneList(pacesInput);
    if (zones.length) {
        const z4 = zones.find(z => Number(z.zone) === 4) || zones[0];
        if (z4?.pace_val_sec) return z4.pace_val_sec;
        if (z4?.pace_fast) return parsePaceStrToSec(z4.pace_fast);
    }
    return 450;
}

const cleanPaceStr = (paceStr) => {
    if (!paceStr || typeof paceStr !== "string") return "";
    return paceStr.replace(/\/mi$/i, "").trim();
};

export function parsePaceStrToSec(paceStr) {
    const cleaned = cleanPaceStr(paceStr);
    if (!cleaned || cleaned === "0:00") return 0;
    const parts = cleaned.split(":");
    if (parts.length !== 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export function formatSecPerMileToStr(totalSec) {
    if (!totalSec || isNaN(totalSec) || totalSec <= 0) return "--:--";
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function generateWavyBarPath(durationMinutes = 1) {
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
}