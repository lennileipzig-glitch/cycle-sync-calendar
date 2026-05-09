// Sprach-Assistent: Wandelt natürliche Sprache in strukturierte App-Aktionen um.
// Nutzt Lovable AI mit Tool Calling.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Context {
  today: string;            // YYYY-MM-DD (Lokalzeit der Userin)
  currentTime: string;      // HH:mm
  weekday: string;          // "Montag" etc.
  phase?: string;           // aktuelle Zyklusphase
  energy?: string | null;
  upcomingEvents?: { date: string; time: string; title: string; category: string; energy_cost?: number | null }[];
  fridge?: string[];
  dietStyle?: string;
  intolerances?: string[];
  favoriteSports?: string[];
  sportLevel?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, context } = await req.json() as { transcript: string; context: Context };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "Kein Text empfangen" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sys = `Du bist Fravia, eine warmherzige Assistentin für eine Zyklus-, Ernährungs- und Bewegungs-App.
Die Nutzerin spricht Deutsch und gibt dir eine kurze Anweisung. Du erkennst die Absicht und rufst genau EIN Tool auf.

Heute ist ${context.weekday}, ${context.today}, aktuelle Uhrzeit ${context.currentTime}.
Aktuelle Zyklusphase: ${context.phase ?? "unbekannt"}. Energielevel: ${context.energy ?? "unbekannt"}.
${context.fridge?.length ? `Im Kühlschrank: ${context.fridge.join(", ")}.` : ""}
${context.dietStyle ? `Ernährungsstil: ${context.dietStyle}.` : ""}
${context.intolerances?.length ? `Unverträglichkeiten: ${context.intolerances.join(", ")}.` : ""}
${context.favoriteSports?.length ? `Lieblings-Sportarten: ${context.favoriteSports.join(", ")}.` : ""}
${context.sportLevel ? `Sport-Level: ${context.sportLevel}.` : ""}

Bevorstehende Termine (nächste 7 Tage):
${(context.upcomingEvents ?? []).slice(0, 30).map(e => `- ${e.date} ${e.time} ${e.title} [${e.category}]${e.energy_cost ? ` (Aufwand ${e.energy_cost}/5)` : ""}`).join("\n") || "(keine)"}

REGELN:
- "Ich habe X gegessen/Mahlzeit Y": tool=add_meal mit confidence=high wenn Zeit klar, sonst medium.
- "Ich habe Sport gebucht/Kurs morgen 18 Uhr": tool=add_sport mit Zeit/Datum.
- "Termin morgen 14 Uhr Zahnarzt": tool=add_appointment.
- "Schlag mir ein Rezept vor / was kann ich kochen": tool=suggest_recipe (nutzt Kühlschrank-Inhalt). Liefere 2-4 Rezepte. Für JEDES Rezept IMMER: servings (Standard 2), ingredients (Liste mit name, amount, unit – passend zur Portionenzahl), und steps (3-7 kurze Zubereitungsschritte).
- "Plane mir Sport diese Woche / find einen guten Tag für Yoga": tool=smart_plan_sport. Wähle einen Tag in den nächsten 7 Tagen mit wenig Belastung, der zur Phase passt (Krafttraining/HIIT in Follikel/Ovulation, Yoga/Spaziergänge in Menstruation/Luteal).
- "Plane mir eine Mahlzeit": tool=smart_plan_meal.
- Datumsangaben relativ ("morgen", "übermorgen", "nächsten Montag") in YYYY-MM-DD umrechnen.
- Uhrzeiten IMMER als HH:mm (24h) extrahieren, wenn die Nutzerin sie nennt. Beispiele:
  * "um 18 Uhr" → "18:00"
  * "18 Uhr 30" / "halb sieben abends" → "18:30"
  * "um 8" (morgens-Kontext: Frühstück/Termin) → "08:00", abends-Kontext (Abendessen, Sport) → "20:00"
  * "Viertel nach 7" → "07:15", "Viertel vor 8" → "07:45"
  * "mittags" → "12:00", "abends" → "19:00", "morgens" → "08:00", "nachmittags" → "15:00"
  Übernimm die genannte Uhrzeit EXAKT — rate nicht und ändere sie nicht.
- NUR wenn die Nutzerin GAR KEINE Uhrzeit nennt, nutze Defaults: Mahlzeiten 12:00/19:00/08:00, Sport 18:00, Termine 09:00.
- DAUER (duration_min) IMMER setzen. Wenn die Nutzerin eine Dauer nennt ("zwei Stunden", "eine halbe Stunde", "90 Minuten", "von 15 bis 17 Uhr"), übernimm sie EXAKT. Sonst Defaults: Mahlzeit 30, Sport 60, Termin 60. Bei Sportarten mit typisch längerer Dauer (Handball, Fußball, Wandern, lange Läufe) ruhig 90–120 vorschlagen.
- confidence: "high" wenn Datum, Zeit und Aktion eindeutig sind. "medium" wenn etwas geraten/abgeleitet wurde. "low" wenn vieles unklar.

KATEGORIE-ZUORDNUNG (wichtig!):
- Klar Sport/Bewegung (Yoga, Lauf, Gym, Pilates, Spaziergang, Schwimmen, Krafttraining, HIIT, Tanzen, Sportkurs ...) → tool=add_sport bzw. smart_plan_sport.
- Klar Ernährung/Mahlzeit (gegessen, Frühstück, Mittag, Abendessen, Snack, Rezept, Kochen, Lebensmittel ...) → tool=add_meal bzw. smart_plan_meal / suggest_recipe.
- Wenn die Aktion ein konkreter zeitgebundener Termin ist (Arzttermin, Meeting, Friseur, Treffen ...) → tool=add_appointment.
- Wenn unklar ist, ob es ein TERMIN oder ein TO-DO ist (z. B. "Steuererklärung machen", "Mama anrufen", "Wohnung putzen") → tool=clarify_category mit options=["termin","todo"] und einer freundlichen Frage.
- Wenn die Kategorie GAR NICHT erkennbar ist (zu vage, kein klares Thema) → tool=clarify_category mit options=["termin","todo","sport","ernaehrung"].
- Nur wenn auch nach Kategorie-Klärung etwas ganz anderes unklar bleibt (z. B. fehlt das Datum) → tool=clarify (offene Rückfrage).

- title kurz und klar ("Yoga-Kurs", "Spaghetti mit Spinat").
- energy_cost (1-5): leicht=1-2, moderat=3, intensiv=4-5.
- MEHRTÄGIGE EREIGNISSE: Wenn die Nutzerin von einem Termin/Event spricht, der über mehrere Tage geht (z. B. "Tagung von Freitag bis Sonntag", "Konferenz nächste Woche Dienstag bis Donnerstag", "Wochenendtrip", "Urlaub vom 5. bis 12. Mai"), setze date = Startdatum (YYYY-MM-DD), end_date = Enddatum (YYYY-MM-DD), und time = Startuhrzeit, end_time = Endeuhrzeit. Wenn keine konkreten Uhrzeiten genannt werden, nutze 09:00 für time und 18:00 für end_time. Trage es trotzdem ein – frage NICHT zurück, nur weil mehrere Tage involviert sind. Setze confidence auf "medium" wenn Uhrzeiten geraten wurden.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "add_meal",
          description: "Eine Mahlzeit als Kalender-Event eintragen.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string", description: "YYYY-MM-DD" },
              time: { type: "string", description: "HH:mm" },
              duration_min: { type: "number", description: "Dauer in Minuten. Wenn die Nutzerin sie nennt ('zwei Stunden', 'eine halbe Stunde'), übernimm sie. Sonst: 30 für Mahlzeiten." },
              details: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              spoken_summary: { type: "string", description: "Kurze deutsche Bestätigung an die Nutzerin, max 1 Satz" },
            },
            required: ["title", "date", "time", "confidence", "spoken_summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "add_sport",
          description: "Eine Sport-/Bewegungseinheit als Kalender-Event eintragen.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              duration_min: { type: "number", description: "Dauer in Minuten. Wenn die Nutzerin sie nennt ('zwei Stunden', '90 Minuten'), übernimm sie EXAKT. Sonst Default 60 für Sport." },
              energy_cost: { type: "number", description: "1-5" },
              details: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              spoken_summary: { type: "string" },
            },
            required: ["title", "date", "time", "confidence", "spoken_summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "add_appointment",
          description: "Einen normalen Termin eintragen.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              duration_min: { type: "number", description: "Dauer in Minuten. Wenn die Nutzerin sie nennt ('zwei Stunden', 'bis 16 Uhr'), übernimm sie. Sonst Default 60." },
              location: { type: "string" },
              details: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              spoken_summary: { type: "string" },
            },
            required: ["title", "date", "time", "confidence", "spoken_summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "suggest_recipe",
          description: "Rezeptvorschlag basierend auf Kühlschrank und Phase.",
          parameters: {
            type: "object",
            properties: {
              recipes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    why: { type: "string" },
                    uses_from_fridge: { type: "array", items: { type: "string" } },
                    short_steps: { type: "string" },
                    servings: { type: "number", description: "Standard-Portionenzahl, z.B. 2" },
                    ingredients: {
                      type: "array",
                      description: "Zutatenliste für die angegebene Portionenzahl.",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          amount: { type: "number", description: "Menge als Zahl, z.B. 200" },
                          unit: { type: "string", description: "Einheit, z.B. 'g', 'ml', 'Stk', 'EL', 'TL', 'Prise'" },
                        },
                        required: ["name"],
                      },
                    },
                    steps: {
                      type: "array",
                      description: "Kurze Zubereitungsschritte (3-7 Schritte).",
                      items: { type: "string" },
                    },
                  },
                  required: ["title", "why"],
                },
              },
              spoken_summary: { type: "string" },
            },
            required: ["recipes", "spoken_summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "smart_plan_sport",
          description: "Plane eine Sporteinheit auf den besten Tag/Zeit basierend auf Phase und vorhandener Belastung.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              duration_min: { type: "number" },
              energy_cost: { type: "number" },
              reasoning: { type: "string", description: "Warum dieser Tag/Zeit (Phase + Auslastung)" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              spoken_summary: { type: "string" },
            },
            required: ["title", "date", "time", "reasoning", "confidence", "spoken_summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "smart_plan_meal",
          description: "Plane eine Mahlzeit auf den besten Tag/Zeit.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              reasoning: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              spoken_summary: { type: "string" },
            },
            required: ["title", "date", "time", "reasoning", "confidence", "spoken_summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "clarify_category",
          description: "Wenn unklar ist, in welche Kategorie der Eintrag gehört, mit Auswahl an Optionen nachfragen.",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string", description: "Freundliche Rückfrage auf Deutsch." },
              options: {
                type: "array",
                description: "Auswahlmöglichkeiten. Erlaubt: 'termin', 'todo', 'sport', 'ernaehrung'.",
                items: { type: "string", enum: ["termin", "todo", "sport", "ernaehrung"] },
                minItems: 2,
                maxItems: 4,
              },
              suggested_title: { type: "string", description: "Vermuteter Titel für den Eintrag." },
              suggested_date: { type: "string", description: "YYYY-MM-DD falls erkennbar." },
              suggested_time: { type: "string", description: "HH:mm falls erkennbar." },
              spoken_summary: { type: "string" },
            },
            required: ["question", "options", "spoken_summary"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "clarify",
          description: "Wenn die Anweisung in anderer Hinsicht unklar ist (z. B. fehlendes Datum), freundlich nachfragen.",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string" },
              spoken_summary: { type: "string" },
            },
            required: ["question", "spoken_summary"],
          },
        },
      },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: transcript },
        ],
        tools,
        tool_choice: "required",
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen, bitte gleich nochmal." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI-Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function) {
      return new Response(JSON.stringify({ action: "clarify", payload: { question: "Ich habe das nicht ganz verstanden. Magst du es anders formulieren?", spoken_summary: "Ich habe das nicht verstanden." } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = {}; }

    return new Response(JSON.stringify({ action: call.function.name, payload: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-assistant error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
