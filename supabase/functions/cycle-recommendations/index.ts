// Edge function that generates personalized cycle recommendations via Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phase, energy, symptoms, kind, fridge, dietStyle, intolerances, favoriteFoods } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sys = `Du bist eine erfahrene Ernährungs- und Bewegungs-Coachin spezialisiert auf den weiblichen Zyklus. Antworte kurz, warmherzig, auf Deutsch. Liefere ausschließlich gültiges JSON gemäß Tool-Schema.`;
    const fridgeList: string[] = Array.isArray(fridge) ? fridge.filter((x: unknown) => typeof x === "string" && x.trim()) : [];
    const recipeContext = kind === "recipes"
      ? `\nErnährungsstil: ${dietStyle ?? "omnivor"}.${(intolerances ?? []).length ? ` Unverträglichkeiten/Verzicht: ${(intolerances ?? []).join(", ")}.` : ""}${(favoriteFoods ?? []).length ? ` Lieblingszutaten: ${(favoriteFoods ?? []).join(", ")}.` : ""}${fridgeList.length ? ` Verfügbare Zutaten im Kühlschrank, die bevorzugt verwendet werden sollen: ${fridgeList.join(", ")}. Nutze möglichst viele dieser Zutaten und ergänze nur das Nötigste.` : ""}`
      : "";
    const userMsg = `Aktuelle Zyklusphase: ${phase}. Energielevel: ${energy ?? "unbekannt"}. Beschwerden: ${(symptoms ?? []).join(", ") || "keine"}.${recipeContext} Erstelle ${kind === "recipes" ? "3 passende Rezeptideen mit kurzer Begründung, Zutatenliste mit Mengen für 2 Portionen, und 3-6 kurzen Zubereitungsschritten" : "3 passende Sport-/Bewegungsempfehlungen mit Dauer, Begründung und 4-7 konkreten Übungen pro Workout (Übungsname, Sätze/Wiederholungen oder Dauer, kurzer Hinweis zur Ausführung)"}.`;

    const tool = kind === "recipes" ? {
      type: "function",
      function: {
        name: "recipes",
        description: "Drei Rezeptvorschläge",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  why: { type: "string", description: "Warum jetzt passend (1 Satz)" },
                  nutrients: { type: "array", items: { type: "string" } },
                  uses_from_fridge: { type: "array", items: { type: "string" }, description: "Welche der vorhandenen Kühlschrank-Zutaten verwendet werden" },
                  servings: { type: "number", description: "Standard-Portionenzahl, üblich 2." },
                  ingredients: {
                    type: "array",
                    description: "Zutatenliste passend zur Portionenzahl.",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        amount: { type: "number", description: "Menge als Zahl, z.B. 200" },
                        unit: { type: "string", description: "Einheit, z.B. g, ml, Stk, EL, TL, Prise" },
                      },
                      required: ["name"],
                    },
                  },
                  steps: {
                    type: "array",
                    description: "3-6 kurze Zubereitungsschritte.",
                    items: { type: "string" },
                  },
                },
                required: ["title", "why", "nutrients", "servings", "ingredients", "steps"],
              },
            },
          },
          required: ["items"],
        },
      },
    } : {
      type: "function",
      function: {
        name: "workouts",
        description: "Drei Bewegungsempfehlungen",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  duration: { type: "string", description: "z.B. 20 min" },
                  intensity: { type: "string", enum: ["leicht", "moderat", "intensiv"] },
                  why: { type: "string" },
                  exercises: {
                    type: "array",
                    description: "4-7 konkrete Übungen.",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Name der Übung, z.B. Squats" },
                        sets: { type: "string", description: "Sätze x Wiederholungen oder Dauer, z.B. '3 x 12' oder '2 min'" },
                        details: { type: "string", description: "Kurzer Hinweis zur Ausführung (1 Satz)" },
                      },
                      required: ["name"],
                    },
                  },
                },
                required: ["title", "duration", "intensity", "why", "exercises"],
              },
            },
          },
          required: ["items"],
        },
      },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte gleich nochmal versuchen." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte Workspace aufladen." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI-Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { items: [] };

    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("recommendations error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
