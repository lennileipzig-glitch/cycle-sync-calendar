// Public iCal feed for a calendar share token.
// Subscribable in Apple Calendar / Google Calendar via webcal:// or https://
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toICalDateUTC(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function toICalDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
function escapeText(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
// RFC5545: lines should be folded at 75 octets
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) out.push(" " + rest);
  return out.join("\r\n");
}

function freqMap(freq: string | null): string | null {
  if (!freq) return null;
  const f = freq.toLowerCase();
  if (f === "daily") return "DAILY";
  if (f === "weekly") return "WEEKLY";
  if (f === "monthly") return "MONTHLY";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Path can be /calendar-feed/<token>.ics or ?token=<token>
    const parts = url.pathname.split("/").filter(Boolean);
    let token = url.searchParams.get("token");
    const last = parts[parts.length - 1];
    if (!token && last && last !== "calendar-feed") {
      token = last.replace(/\.ics$/i, "");
    }
    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Look up share by token (any status; we serve as long as not revoked)
    const { data: share, error: shareErr } = await admin
      .from("calendar_shares")
      .select("id, owner_id, status, show_phases, recipient_email")
      .eq("invite_token", token)
      .maybeSingle();

    if (shareErr) throw shareErr;
    if (!share || share.status === "revoked") {
      return new Response("Calendar not found or revoked", { status: 404, headers: corsHeaders });
    }

    // Owner display name (best-effort)
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", share.owner_id)
      .maybeSingle();
    const ownerName = profile?.display_name || "Luna";

    // Fetch events of the owner. Limit to a sensible window.
    const since = new Date();
    since.setMonth(since.getMonth() - 2);
    const until = new Date();
    until.setFullYear(until.getFullYear() + 1);

    const { data: events, error: evErr } = await admin
      .from("calendar_events")
      .select("id, title, starts_at, ends_at, all_day, location, recurrence_freq, recurrence_until, created_at")
      .eq("user_id", share.owner_id)
      .gte("starts_at", since.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at", { ascending: true })
      .limit(1000);

    if (evErr) throw evErr;

    const now = new Date();
    const lines: string[] = [];
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//Luna//Calendar Share//DE");
    lines.push("CALSCALE:GREGORIAN");
    lines.push("METHOD:PUBLISH");
    lines.push(`X-WR-CALNAME:${escapeText(`Luna · ${ownerName}`)}`);
    lines.push(`X-WR-CALDESC:${escapeText(`Geteilter Luna-Kalender von ${ownerName}`)}`);

    for (const e of events ?? []) {
      const start = new Date(e.starts_at);
      const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
      const uid = `${e.id}@luna-share`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${toICalDateUTC(now)}`);
      if (e.all_day) {
        lines.push(`DTSTART;VALUE=DATE:${toICalDate(start)}`);
        // For all-day events, DTEND is exclusive (next day)
        const endDay = new Date(end);
        if (endDay.getTime() <= start.getTime()) endDay.setUTCDate(endDay.getUTCDate() + 1);
        lines.push(`DTEND;VALUE=DATE:${toICalDate(endDay)}`);
      } else {
        lines.push(`DTSTART:${toICalDateUTC(start)}`);
        lines.push(`DTEND:${toICalDateUTC(end)}`);
      }
      lines.push(fold(`SUMMARY:${escapeText(e.title || "Termin")}`));
      if (e.location) lines.push(fold(`LOCATION:${escapeText(e.location)}`));

      const freq = freqMap(e.recurrence_freq);
      if (freq) {
        let rrule = `RRULE:FREQ=${freq}`;
        if (e.recurrence_until) {
          const u = new Date(e.recurrence_until + "T23:59:59Z");
          rrule += `;UNTIL=${toICalDateUTC(u)}`;
        }
        lines.push(rrule);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    const body = lines.map(fold).join("\r\n") + "\r\n";

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="luna-${token}.ics"`,
      },
    });
  } catch (err) {
    console.error("calendar-feed error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Error: ${msg}`, { status: 500, headers: corsHeaders });
  }
});
