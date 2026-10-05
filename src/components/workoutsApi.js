// API Service file tracing HTTP calls and responses

export async function saveWorkoutApi(payload) {
    const isUpdate = Boolean(payload.id);
    const endpoint = isUpdate ? `/api/workouts/${payload.id}` : '/api/workouts';
    const method = isUpdate ? 'PUT' : 'POST';
  
    console.log('[Save Flow] [Step 6a API] Preparing HTTP Request', {
      endpoint,
      method,
      isUpdate,
      payload
    });
  
    try {
      console.log(`[Save Flow] [Step 6b API] Sending ${method} request to ${endpoint}...`);
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
  
      console.log('[Save Flow] [Step 6c API] HTTP response status:', response.status, response.statusText);
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Save Flow] [API ERROR] Non-2xx response from backend:', errorText);
        throw new Error(`Failed to save workout: ${response.status} ${response.statusText}`);
      }
  
      const data = await response.json();
      console.log('[Save Flow] [Step 6d API] Parsed JSON response body:', data);
      return data;
    } catch (error) {
      console.error('[Save Flow] [API EXCEPTION] Network or parsing failure:', error);
      throw error;
    }
  }
  
  export async function fetchWorkoutsApi() {
    const endpoint = '/api/workouts';
    console.log('[Save Flow] [Step 9a API] Fetching updated workouts list from', endpoint);
  
    try {
      const response = await fetch(endpoint);
      console.log('[Save Flow] [Step 9b API] Fetch workouts response status:', response.status);
  
      if (!response.ok) {
        throw new Error(`Failed to fetch workouts: ${response.status}`);
      }
  
      const data = await response.json();
      console.log('[Save Flow] [Step 9c API] Workouts list retrieved successfully:', data);
      return data;
    } catch (error) {
      console.error('[Save Flow] [API EXCEPTION] Failed to fetch workouts:', error);
      throw error;
    }
  }