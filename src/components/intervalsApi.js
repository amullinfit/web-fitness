const VAL_WORKOUTBUILDER_URL = "/api/val-workoutbuilder";

/**
 * Fetch folders and filter by type === "FOLDER"
 */
export async function getFolders() {
  const response = await fetch(VAL_WORKOUTBUILDER_URL, {
    method: "GET",
  });
  if (!response.ok) throw new Error("Failed to fetch folders");
  return await response.json();
}

/**
 * Create a new folder on Intervals.icu
 */
export async function createFolder(folderName) {
  const response = await fetch(VAL_WORKOUTBUILDER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_folder",
      folderData: { name: folderName, type: "FOLDER" },
    }),
  });
  if (!response.ok) throw new Error("Failed to create folder");
  return await response.json();
}

/**
 * Create a brand new workout
 */
export async function createWorkout(workoutData) {
  const response = await fetch(VAL_WORKOUTBUILDER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_workout",
      workoutData,
    }),
  });
  if (!response.ok) throw new Error("Failed to create workout");
  return await response.json();
}

/**
 * Update an existing workout by ID
 */
export async function updateWorkout(workoutId, workoutData) {
  const response = await fetch(VAL_WORKOUTBUILDER_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update_workout",
      workoutId,
      workoutData,
    }),
  });
  if (!response.ok) throw new Error("Failed to update workout");
  return await response.json();
}