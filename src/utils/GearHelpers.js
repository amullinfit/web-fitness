/**
 * Shared gear normalization and classification helpers.
 */
export const getDistanceInMiles = (gear) => {
  if (gear.distance_miles !== undefined) return gear.distance_miles;
  if (gear.distance_m !== undefined) return gear.distance_m / 1609.34;
  if (gear.distance !== undefined) {
    return gear.distance > 5000 ? gear.distance / 1609.34 : gear.distance;
  }
  return 0;
};

export const isShoeGear = (gear) => {
  const type = (gear.type || '').toLowerCase();
  return type.includes('shoe');
};

export const isUnassignedActivity = (gear) => {
  const name = (gear.name || '').toUpperCase();
  return name.includes('NOT ASSIGNED A SHOE') || name.includes('NOT TRACKED');
};

export const hasRetiredDate = (gear) => Boolean(gear.retired);

export const sortByDistanceDesc = (items) => {
  return [...items].sort((a, b) => getDistanceInMiles(b) - getDistanceInMiles(a));
};
