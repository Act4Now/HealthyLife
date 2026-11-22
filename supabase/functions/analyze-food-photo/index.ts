// Supabase Edge Function: transient food-photo analysis.
// The image is sent in-memory to Gemini inline_data and is never written to Storage or Postgres.
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://act4now.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return Response.json({ error: "Analiza foto nu este configurată. Administratorul trebuie să configureze GEMINI_API_KEY." }, { status: 503, headers: corsHeaders });

  try {
    const { image_base64, mime_type } = await req.json();
    if (typeof image_base64 !== "string" || image_base64.length < 100 || image_base64.length > 7_000_000) {
      return Response.json({ error: "Imagine invalidă sau prea mare (maxim 5 MB)." }, { status: 400, headers: corsHeaders });
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime_type)) {
      return Response.json({ error: "Format acceptat: JPG, PNG sau WebP." }, { status: 400, headers: corsHeaders });
    }

    const prompt = `Analizează fotografia unei mese. Identifică doar alimentele vizibile și estimează porția comestibilă în grame. Nu inventa ingrediente invizibile. Întoarce DOAR JSON valid în forma {"description":"descriere scurtă în română","ingredients":[{"name":"nume aliment în română","grams":120,"kcal_per_100g":165,"protein_g_per_100g":31,"carbs_g_per_100g":0,"fat_g_per_100g":3.6}],"uncertainty":"ce nu se poate determina din imagine"}. Valorile nutriționale sunt estimări orientative. Dacă nu poți identifica masa, întoarce ingredients=[] și explică în uncertainty.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type, data: image_base64 } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Gemini vision request failed", response.status, detail.slice(0, 500));
      return Response.json({ error: "Serviciul de analiză nu a putut procesa fotografia." }, { status: 502, headers: corsHeaders });
    }
    const payload = await response.json();
    const raw = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("");
    if (!raw) return Response.json({ error: "Analiza nu a returnat un rezultat." }, { status: 502, headers: corsHeaders });
    const result = JSON.parse(raw);
    if (!Array.isArray(result.ingredients)) throw new Error("Invalid analysis schema");
    result.ingredients = result.ingredients.filter((item: Record<string, unknown>) =>
      typeof item.name === "string" && Number.isFinite(item.grams) && Number(item.grams) > 0 &&
      ["kcal_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g"].every(key => Number.isFinite(item[key]))
    );
    return Response.json(result, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Food photo analysis error", error);
    return Response.json({ error: "Nu am putut interpreta fotografia. Încearcă o imagine mai clară." }, { status: 400, headers: corsHeaders });
  }
});
