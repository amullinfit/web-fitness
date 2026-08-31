import { fetch } from "https://esm.town/v/std/fetch";

function getDetroitDateString(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  };
  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export default async function(req: Request): Promise<Response> {
  const apiKey = Deno.env.get("INTERVALS_API_KEY");
  const athleteId = Deno.env.get("INTERVALS_ATHLETE_ID");
  const authHeader = "Basic " + btoa(`API_KEY:${apiKey}`);

  const todayDate = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const oldest = getDetroitDateString(todayDate);
  const newest = getDetroitDateString(futureDate);

  try {
    const res = await fetch(
      `https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`,
      { headers: { "Authorization": authHeader } }
    );
    const events = await res.json();

    const cleanedWorkouts = events
      .filter((e: any) => e.category === "WORKOUT" || e.type)
      .slice(0, 10)
      .map((w: any) => ({
        ...w,
        name: w.name ? w.name.replace(/IntervalCoach\s*-?\s*/gi, "").trim() : "Workout"
      }));

    return Response.json(cleanedWorkouts, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}