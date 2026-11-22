import { useState } from 'react'
import { ChefHat, Clock3, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Recipe = { name:string; description:string; ingredients:string[]; steps:string[]; prep_minutes:number; calories_per_serving:number; protein_g:number; carbs_g:number; fat_g:number }

export default function RecipeGenerator(){
  const [ingredients,setIngredients]=useState('')
  const [dietary,setDietary]=useState('')
  const [servings,setServings]=useState(2)
  const [recipes,setRecipes]=useState<Recipe[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  async function generate(){
    if(!supabase){setMessage('Conectează Supabase și autentifică-te pentru a folosi rețetele AI.');return}
    setBusy(true);setMessage('')
    try{
      const {data,error}=await supabase.functions.invoke('generate-recipes',{body:{ingredients,dietary,servings}})
      if(error)throw error
      if(data?.error)throw new Error(data.error)
      setRecipes(data.recipes??[])
      if(!data.recipes?.length)setMessage('Nu au fost generate rețete. Încearcă alte ingrediente.')
    }catch(e){setMessage(e instanceof Error?e.message:'Generarea rețetelor a eșuat.')}
    finally{setBusy(false)}
  }
  return <div className="calorie-layout">
    <section className="panel calorie-form">
      <div className="panel-heading"><div><h3><ChefHat size={19}/> Rețete AI</h3><p>Idei de mese pe baza ingredientelor și preferințelor tale</p></div><Sparkles/></div>
      <label className="calorie-label">Ingrediente disponibile<textarea rows={4} value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder="Ex.: ouă, roșii, spanac, iaurt, orez (opțional)"/></label>
      <label className="calorie-label">Preferințe sau restricții alimentare<textarea rows={2} value={dietary} onChange={e=>setDietary(e.target.value)} placeholder="Ex.: vegetarian, fără lactoză, fără nuci (opțional)"/></label>
      <label className="calorie-label">Număr de porții<input type="number" min="1" max="8" value={servings} onChange={e=>setServings(Math.min(8,Math.max(1,Number(e.target.value))))}/></label>
      <button className="save-meal-button" disabled={busy} onClick={()=>void generate()}><Sparkles size={16}/>{busy?'Se generează…':'Generează 3 rețete'}</button>
      {message&&<p className="calorie-message" role="status">{message}</p>}
      <p className="calorie-disclaimer">Rețetele și valorile nutriționale sunt generate automat și trebuie verificate. Nu reprezintă recomandări medicale. Datele introduse sunt trimise către Google Gemini pentru generare.</p>
    </section>
    <section className="panel calorie-result">
      <h3>Idei pentru masa ta</h3>
      {!recipes.length&&!busy&&<p className="empty-logs">Completează ingredientele și generează rețete.</p>}
      {recipes.map((r,i)=><article className="recipe-card" key={r.name+i}>
        <h4>{r.name}</h4><p>{r.description}</p>
        <div className="recipe-meta"><span><Clock3 size={14}/> {r.prep_minutes} min</span><strong>{r.calories_per_serving} kcal / porție</strong></div>
        <p><strong>Proteine:</strong> {r.protein_g} g · <strong>Carbohidrați:</strong> {r.carbs_g} g · <strong>Grăsimi:</strong> {r.fat_g} g</p>
        <h5>Ingrediente</h5><ul>{r.ingredients?.map((x,j)=><li key={j}>{x}</li>)}</ul>
        <h5>Mod de preparare</h5><ol>{r.steps?.map((x,j)=><li key={j}>{x}</li>)}</ol>
      </article>)}
    </section>
  </div>
}
