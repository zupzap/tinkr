const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Stops other websites using a visitor's browser to call the API. It does not stop
 * scripts, which can send any Origin they like. Only the sites listed may call it,
 * which also shuts out deployment URLs like *.vercel.app.
 */
export function fromOwnSite(origin: string | null, host: string | null, sites: Set<string>) {
  if (!origin || !host || !sites.has(host)) return false;
  try {
    return sites.has(new URL(origin).host);
  } catch {
    return false;
  }
}

type Limits = { perMinute: number; perDay: number; everyonePerDay: number };
type Usage = { minuteStart: number; minute: number; dayStart: number; day: number };

/**
 * Counts in memory, so limits apply per running instance and reset on redeploy.
 * This slows one visitor down. It is not a spending limit: that has to be set at
 * the AI provider.
 */
export function createLimiter({ perMinute, perDay, everyonePerDay }: Limits) {
  const visitors = new Map<string, Usage>();
  let everyone = { dayStart: 0, day: 0 };

  return function allow(visitor: string, now = Date.now()) {
    if (now - everyone.dayStart >= DAY) {
      everyone = { dayStart: now, day: 0 };
      visitors.clear(); // a day's usage is the longest anything needs remembering
    }
    if (everyone.day >= everyonePerDay) return false;

    const usage = visitors.get(visitor) ?? { minuteStart: now, minute: 0, dayStart: now, day: 0 };
    if (now - usage.minuteStart >= MINUTE) Object.assign(usage, { minuteStart: now, minute: 0 });
    if (now - usage.dayStart >= DAY) Object.assign(usage, { dayStart: now, day: 0 });
    visitors.set(visitor, usage);
    if (usage.minute >= perMinute || usage.day >= perDay) return false;

    usage.minute += 1;
    usage.day += 1;
    everyone.day += 1;
    return true;
  };
}
