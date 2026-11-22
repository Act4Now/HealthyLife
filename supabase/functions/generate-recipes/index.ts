const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://act4now.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return Response.json({ error: "Rețetele AI nu sunt configurate. Administratorul trebuie să configureze GEMINI_API_KEY." }, { status: 503, headers: corsHeaders });
  try {
    const { ingredients, dietary, servings } = await req.json();
    const prompt = `Propune 3 rețete simple în limba română. Ingrediente disponibile: ${String(ingredients ?? "").slice(0,1000)}. Preferințe/restricții alimentare declarate: ${String(dietary ?? "fără preferințe").slice(0,500)}. Porții: ${Math.min(8,Math.max(1,Number(servings)||2))}. Returnează exclusiv JSON: {"recipes":[{"name":"...","description":"...","ingredients":["cantitate ingredient"],"steps":["pas"],"prep_minutes":20,"calories_per_serving":450,"protein_g":25,"carbs_g":40,"fat_g":15}]}. Nu face afirmații medicale, nu prezenta rețetele ca tratament și precizează că valorile nutriționale sunt estimative.`;
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:0.6}})
    });
    if(!response.ok){console.error("Gemini recipe request failed",response.status,(await response.text()).slice(0,500));return Response.json({error:"Serviciul AI nu a putut genera rețetele."},{status:502,headers:corsHeaders});}
    const payload=await response.json();
    const raw=payload.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text??"").join("");
    if(!raw) throw new Error("Empty model response");
    const result=JSON.parse(raw);
    if(!Array.isArray(result.recipes)) throw new Error("Invalid recipe response");
    return Response.json({recipes:result.recipes.slice(0,3)},{headers:{...corsHeaders,"Cache-Control":"no-store"}});
  } catch(error){console.error("Recipe generation error",error);return Response.json({error:"Nu am putut genera rețetele. Încearcă din nou."},{status:400,headers:corsHeaders});}
});
