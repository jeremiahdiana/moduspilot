export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  allDay: boolean;
  accountEmail?: string;
}

export async function getTodayEvents(accessToken: string, timezone = 'UTC'): Promise<CalendarEvent[]> {
  try {
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    // Build timezone-aware start/end of day by extracting the UTC offset for the user's timezone
    const tzParts = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const tzLabel = tzParts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0';
    const tzMatch = tzLabel.match(/GMT([+-])(\d+)(?::(\d+))?/);
    const offsetStr = tzMatch ? `${tzMatch[1]}${tzMatch[2].padStart(2, '0')}:${(tzMatch[3] ?? '0').padStart(2, '0')}` : '+00:00';
    const timeMin = new Date(`${dateStr}T00:00:00${offsetStr}`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59${offsetStr}`).toISOString();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '10',
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.items ?? []).map((e: any) => ({
      id: e.id,
      title: e.summary ?? 'Untitled',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location ?? undefined,
      allDay: !e.start?.dateTime,
    }));
  } catch {
    return [];
  }
}

export async function getUpcomingEvents(accessToken: string, windowMinutes = 60, timezone = 'UTC'): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString();
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '20' });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.items ?? []).map((e: any) => ({
      id: e.id, title: e.summary ?? 'Untitled',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location ?? undefined,
      allDay: !e.start?.dateTime,
    }));
  } catch { return []; }
}

export async function getRecentlyEndedEvents(accessToken: string, windowMinutes = 60): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const timeMin = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString();
    const timeMax = now.toISOString();
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '20' });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.items ?? []).filter((e: any) => e.start?.dateTime && e.end?.dateTime).map((e: any) => ({
      id: e.id, title: e.summary ?? 'Untitled',
      start: e.start.dateTime, end: e.end.dateTime,
      location: e.location ?? undefined, allDay: false,
    }));
  } catch { return []; }
}

export function fmtEventTime(iso: string, timezone?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    return '';
  }
}
