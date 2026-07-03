// Mirrors the server's billing rules for DISPLAY ONLY (checkout preview).
// The server always recomputes the authoritative charge at checkout time.
// Keep this in sync with server/routes/visits.js.
const GRACE_HOURS = 10 / 60;

function groupBill(room, checkIn, now, groupSize) {
  const hourly = parseFloat(room.hourly_rate);
  const daily = parseFloat(room.daily_rate);
  const threshold = room.threshold_hours;

  const rawHours = (now - new Date(checkIn)) / (1000 * 60 * 60);
  const billedHours = Math.max(1, Math.ceil(rawHours - GRACE_HOURS));

  const base = billedHours <= threshold ? hourly * billedHours : daily;
  return room.pricing_mode === 'per_person' ? base * groupSize : base;
}

// One person's live share of the bill so far.
export function perPersonShare(room, checkIn, now, groupSize) {
  return Number((groupBill(room, checkIn, now, groupSize) / groupSize).toFixed(2));
}
