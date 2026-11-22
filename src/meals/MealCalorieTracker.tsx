import { useEffect, useMemo, useState } from 'react'
import { Flame, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Food = { name: string; kcal: number; protein: number; carbs: number; fat: number }
type Ingredient = { id: number; food: string; grams: number; nutrition?: Food }
type MealLog = { id: string; description: string; calories_kcal: number; protein_g: number; carbohydrates_g: number; fat_g: number; created_at: string; ingredients?: Ingredient[] }
type CustomFood = { id: string; name: string; serving_name: string; serving_grams: number; calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number; favorite: boolean }
type CustomRecipe = { id: string; name: string; servings: number; ingredients: Ingredient[]; calories_per_serving: number; protein_per_serving: number; carbs_per_serving: number; fat_per_serving: number }

const foods: Record<string, Food> = {
  'Chicken breast': { name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  'Rice, cooked': { name: 'Rice, cooked', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  'Avocado': { name: 'Avocado', kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  'Tomato': { name: 'Tomato', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  'Egg': { name: 'Egg', kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  'Oats, dry': { name: 'Oats, dry', kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
  'Banana': { name: 'Banana', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  'Greek yogurt': { name: 'Greek yogurt', kcal: 97, protein: 9, carbs: 3.9, fat: 5 },
  'Salmon': { name: 'Salmon', kcal: 208, protein: 20, carbs: 0, fat: 13 },
  'Broccoli': { name: 'Broccoli', kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  'Olive oil': { name: 'Olive oil', kcal: 884, protein: 0, carbs: 0, fat: 100 },
  'Chickpeas, cooked': { name: 'Chickpeas, cooked', kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6 },
  'Potato, boiled': { name: 'Potato, boiled', kcal: 87, protein: 1.9, carbs: 20.1, fat: 0.1 },
  'Bread, whole wheat': { name: 'Bread, whole wheat', kcal: 247, protein: 13, carbs: 41, fat: 4.2 },
}

export default function MealCalorieTracker({ userId }: { userId?: string }) {
  const [description, setDescription] = useState('')
  const [food, setFood] = useState('Chicken breast')
  const [grams, setGrams] = useState(120)
  const [portion, setPortion] = useState(1)
  const [items, setItems] = useState<Ingredient[]>([{ id: 1, food: 'Chicken breast', grams: 120 }, { id: 2, food: 'Rice, cooked', grams: 150 }])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [logs, setLogs] = useState<MealLog[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisNote, setAnalysisNote] = useState('')
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([])
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([])
  const [foodName, setFoodName] = useState('')
  const [foodServing, setFoodServing] = useState('100 g')
  const [foodGrams, setFoodGrams] = useState(100)
  const [foodKcal, setFoodKcal] = useState(0)
  const [foodProtein, setFoodProtein] = useState(0)
  const [foodCarbs, setFoodCarbs] = useState(0)
  const [foodFat, setFoodFat] = useState(0)
  const [recipeName, setRecipeName] = useState('')
  const [photoConsent, setPhotoConsent] = useState(false)
  const totals = useMemo(() => items.reduce((sum, item) => {
    const custom = customFoods.find(x => x.name === item.food); const f = item.nutrition ?? foods[item.food] ?? (custom ? { name: custom.name, kcal: Number(custom.calories_kcal) * 100 / Number(custom.serving_grams), protein: Number(custom.protein_g) * 100 / Number(custom.serving_grams), carbs: Number(custom.carbs_g) * 100 / Number(custom.serving_grams), fat: Number(custom.fat_g) * 100 / Number(custom.serving_grams) } : { name: item.food, kcal: 0, protein: 0, carbs: 0, fat: 0 })
    const factor = item.grams / 100
    return { kcal: sum.kcal + f.kcal * factor, protein: sum.protein + f.protein * factor, carbs: sum.carbs + f.carbs * factor, fat: sum.fat + f.fat * factor }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [items])

  useEffect(() => {
    if (!supabase || !userId) return
    Promise.all([supabase.from('custom_foods').select('*').order('favorite', { ascending: false }).order('name'), supabase.from('custom_recipes').select('*').order('name')]).then(([foodResult, recipeResult]) => {
      if (foodResult.error) setMessage(foodResult.error.message)
      else setCustomFoods((foodResult.data ?? []) as CustomFood[])
      if (recipeResult.error) setMessage(recipeResult.error.message)
      else setCustomRecipes((recipeResult.data ?? []) as CustomRecipe[])
    })
    supabase.from('meal_logs').select('id,description,calories_kcal,protein_g,carbohydrates_g,fat_g,ingredients,created_at').order('created_at', { ascending: false }).limit(10)
      .then(({ data, error }) => { if (error) setMessage(error.message); else setLogs((data ?? []) as MealLog[]) })
  }, [userId])

  async function saveCustomFood() {
    if (!supabase || !userId) { setMessage('Autentificarea este necesară pentru a salva alimente personale.'); return }
    if (!foodName.trim() || foodGrams <= 0) { setMessage('Completează numele și gramajul porției.'); return }
    const { data, error } = await supabase.from('custom_foods').insert({ user_id: userId, name: foodName.trim(), serving_name: foodServing.trim() || '100 g', serving_grams: foodGrams, calories_kcal: foodKcal, protein_g: foodProtein, carbs_g: foodCarbs, fat_g: foodFat }).select('*').single()
    if (error) { setMessage(error.message); return }
    setCustomFoods(current => [...current, data as CustomFood].sort((a,b) => a.name.localeCompare(b.name)))
    setFoodName(''); setMessage('Alimentul personal a fost salvat.')
  }

  async function toggleFoodFavorite(item: CustomFood) {
    if (!supabase) return
    const { data, error } = await supabase.from('custom_foods').update({ favorite: !item.favorite }).eq('id', item.id).select('*').single()
    if (error) { setMessage(error.message); return }
    setCustomFoods(current => current.map(x => x.id === item.id ? data as CustomFood : x))
  }

  async function deleteCustomFood(id: string) {
    if (!supabase) return
    const { error } = await supabase.from('custom_foods').delete().eq('id', id)
    if (error) { setMessage(error.message); return }
    setCustomFoods(current => current.filter(x => x.id !== id))
  }

  async function saveCustomRecipe() {
    if (!supabase || !userId) { setMessage('Autentificarea este necesară pentru a salva rețete.'); return }
    if (!recipeName.trim() || !items.length) { setMessage('Adaugă un nume și cel puțin un ingredient.'); return }
    const { data, error } = await supabase.from('custom_recipes').insert({ user_id: userId, name: recipeName.trim(), servings: 1, ingredients: items, calories_per_serving: totals.kcal, protein_per_serving: totals.protein, carbs_per_serving: totals.carbs, fat_per_serving: totals.fat }).select('*').single()
    if (error) { setMessage(error.message); return }
    setCustomRecipes(current => [...current, data as CustomRecipe].sort((a,b) => a.name.localeCompare(b.name)))
    setRecipeName(''); setMessage('Rețeta a fost salvată pentru o porție.')
  }

  function loadCustomRecipe(recipe: CustomRecipe) {
    setItems((recipe.ingredients ?? []).map((item, index) => ({ ...item, id: Date.now() + index })))
    setDescription(recipe.name)
    setMessage('Rețeta a fost încărcată în jurnal. Verifică gramajele înainte de salvare.')
  }

  function attachPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Alege o fotografie JPG, PNG sau WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setMessage('Fotografia trebuie să fie sub 5 MB.'); return }
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(String(reader.result ?? ''))
    reader.readAsDataURL(file)
    setAnalysisNote('')
    setMessage('')
  }

  async function analyzePhoto() {
    if (!photo || !supabase) { setMessage('Autentifică-te și selectează o fotografie pentru analiză.'); return }
    if (!photoConsent) { setMessage('Confirmă mai întâi transmiterea temporară a fotografiei către Google Gemini.'); return }
    setAnalyzing(true); setMessage(''); setAnalysisNote('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Nu am putut citi fotografia.'))
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.readAsDataURL(photo)
      })
      const [header, base64] = dataUrl.split(',')
      const mime = header.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1]
      if (!mime || !base64) throw new Error('Formatul fotografiei nu este acceptat.')
      const { data, error } = await supabase.functions.invoke('analyze-food-photo', { body: { image_base64: base64, mime_type: mime } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const analyzed = (data?.ingredients ?? []).map((item: Record<string, unknown>, index: number) => ({
        id: Date.now() + index,
        food: String(item.name),
        grams: Math.max(1, Math.round(Number(item.grams))),
        nutrition: {
          name: String(item.name),
          kcal: Number(item.kcal_per_100g),
          protein: Number(item.protein_g_per_100g),
          carbs: Number(item.carbs_g_per_100g),
          fat: Number(item.fat_g_per_100g),
        },
      }))
      if (!analyzed.length) throw new Error(data?.uncertainty || 'Nu am identificat alimente în fotografie. Încearcă o imagine mai clară.')
      setItems(analyzed)
      if (data.description) setDescription(String(data.description))
      setAnalysisNote(String(data.uncertainty ?? 'Valorile sunt estimative. Verifică ingredientele și gramajele înainte de salvare.'))
      setMessage('Analiza fotografiei s-a terminat. Verifică și corectează rezultatele.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Analiza fotografiei a eșuat.')
    } finally { setAnalyzing(false) }
  }

  async function saveMeal() {
    if (!description.trim() && items.length === 0) { setMessage('Adaugă o descriere sau ingrediente.'); return }
    setSaving(true); setMessage('')
    try {
      if (!supabase || !userId) { setMessage('Mod demo: estimarea este afișată, dar salvarea în istoric necesită autentificare Supabase și migrarea SQL.'); return }
      const { data, error } = await supabase.from('meal_logs').insert({
        user_id: userId, description: description.trim() || items.map(x => x.food).join(', '),
        calories_kcal: Math.round(totals.kcal),
        protein_g: Number(totals.protein.toFixed(1)), carbohydrates_g: Number(totals.carbs.toFixed(1)),
        fat_g: Number(totals.fat.toFixed(1)), ingredients: items,
      }).select('id,description,calories_kcal,protein_g,carbohydrates_g,fat_g,created_at').single()
      if (error) throw error
      setLogs(current => [data as MealLog, ...current])
      setMessage('Masa a fost salvată în istoricul profilului.')
      setDescription(''); setPhoto(null); setPhotoPreview(''); setAnalysisNote(''); setPhotoConsent(false); setItems([])
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Nu am putut salva masa.') }
    finally { setSaving(false) }
  }

  return <div className="calorie-layout">
    <section className="panel calorie-form">
      <div className="panel-heading"><div><h3>Jurnal alimentar & calorii</h3><p>Descrie masa, adaugă ingredientele sau analizează o fotografie fără a o salva</p></div><Flame className="calorie-flame" /></div>
      <label className="calorie-label">Descrierea mesei
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Piept de pui la grătar cu orez, avocado și roșii..." rows={3} />
      </label>
      <details className="custom-food-editor">
        <summary>＋ Creează aliment personal</summary>
        <div className="custom-food-fields">
          <input value={foodName} onChange={e=>setFoodName(e.target.value)} placeholder="Numele alimentului" maxLength={120}/>
          <input value={foodServing} onChange={e=>setFoodServing(e.target.value)} placeholder="Denumirea porției"/>
          <label>Gramaj porție (g)<input type="number" min="1" value={foodGrams} onChange={e=>setFoodGrams(Number(e.target.value))}/></label>
          <label>kcal / porție<input type="number" min="0" value={foodKcal} onChange={e=>setFoodKcal(Number(e.target.value))}/></label>
          <label>Proteine (g)<input type="number" min="0" value={foodProtein} onChange={e=>setFoodProtein(Number(e.target.value))}/></label>
          <label>Carbohidrați (g)<input type="number" min="0" value={foodCarbs} onChange={e=>setFoodCarbs(Number(e.target.value))}/></label>
          <label>Grăsimi (g)<input type="number" min="0" value={foodFat} onChange={e=>setFoodFat(Number(e.target.value))}/></label>
          <button type="button" onClick={()=>void saveCustomFood()}>Salvează alimentul</button>
        </div>
        {customFoods.map(item=><div className="custom-food-row" key={item.id}><span>{item.name} · {item.serving_grams} g</span><button type="button" onClick={()=>void toggleFoodFavorite(item)}>{item.favorite?'★ Favorit':'☆ Favorit'}</button><button type="button" onClick={()=>void deleteCustomFood(item.id)}>Șterge</button></div>)}
        {!customFoods.length && <p className="empty-logs">Alimentele create de tine vor apărea aici.</p>}
      </details>
      <div className="ingredient-title"><strong>Ingrediente și cantități</strong><span>valori estimative / 100 g</span></div>
      <div className="ingredient-add">
        <select value={food} onChange={e => setFood(e.target.value)}>{Object.keys(foods).map(name => <option key={name}>{name}</option>)}{customFoods.length > 0 && <optgroup label="Alimentele mele">{customFoods.map(item => <option key={item.id} value={item.name}>{item.favorite ? '★ ' : ''}{item.name}</option>)}</optgroup>}</select>
        <input type="number" min="1" max="2000" value={grams} onChange={e => setGrams(Number(e.target.value))} aria-label="Grame" />
        <span>g</span><div className="portion-quick" aria-label="Mărimea porției">{[0.5,1,1.5,2].map(n=><button type="button" key={n} className={portion===n?'selected':''} onClick={()=>setPortion(n)}>{n===0.5?'½':n===1?'1':n===1.5?'1½':'2'}×</button>)}</div><button onClick={() => setItems(v => [...v, { id: Date.now(), food, grams: Math.max(1, Math.round(grams*portion)) }])}><Plus size={16} /> Adaugă</button>
      </div>
      <div className="ingredient-list">{items.map(item => <div key={item.id}><span>{item.food}</span><small>{item.grams} g · {Math.round((item.nutrition ?? foods[item.food]).kcal * item.grams / 100)} kcal</small><button aria-label="Șterge ingredientul" onClick={() => setItems(v => v.filter(x => x.id !== item.id))}><Trash2 size={15} /></button></div>)}</div>
      <details className="custom-food-editor">
        <summary>＋ Salvează rețeta ingredientelor curente</summary>
        <div className="custom-food-fields">
          <input value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Numele rețetei" maxLength={160}/>
          <button type="button" onClick={()=>void saveCustomRecipe()}>Salvează rețeta</button>
        </div>
        {customRecipes.map(recipe=><div className="custom-food-row" key={recipe.id}><span>{recipe.name} · {Math.round(recipe.calories_per_serving)} kcal / porție</span><button type="button" onClick={()=>loadCustomRecipe(recipe)}>Încarcă</button></div>)}
        {!customRecipes.length && <p className="empty-logs">Rețetele salvate vor apărea aici.</p>}
      </details>
      <label className="photo-drop"><ImagePlus size={19} /><span>{photo ? photo.name : 'Fotografia mesei (analizată temporar, nu este salvată)'}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => attachPhoto(e.target.files?.[0])} /></label>
      {photoPreview && <><img className="meal-photo-preview" src={photoPreview} alt="Previzualizare locală a fotografiei mesei" /><label className="calorie-disclaimer"><input type="checkbox" checked={photoConsent} onChange={e => setPhotoConsent(e.target.checked)} /> Sunt de acord ca fotografia să fie transmisă către Google Gemini pentru analiză. HealthyLife nu o salvează. Pentru conturile Google AI gratuite, Google poate folosi conținutul transmis pentru îmbunătățirea produselor; consultă politica Google înainte de a continua.</label><button type="button" className="outline-button" onClick={() => void analyzePhoto()} disabled={analyzing || saving || !photoConsent}>{analyzing ? 'Se analizează fotografia…' : 'Analizează fotografia'}</button></>}
      {analysisNote && <p className="calorie-disclaimer">{analysisNote}</p>}
      <button className="save-meal-button" onClick={() => void saveMeal()} disabled={saving}><Save size={16} />{saving ? 'Se salvează…' : 'Salvează masa și valorile'}</button>
      {message && <p className="calorie-message" role="status">{message}</p>}
      <p className="calorie-disclaimer">Estimările din fotografie pot fi inexacte, mai ales pentru uleiuri, sosuri și ingrediente ascunse. Fotografia este transmisă temporar către Google Gemini numai după acordul tău. HealthyLife nu o încarcă în Supabase și nu o salvează în istoricul aplicației. Politica Google și condițiile planului API se aplică procesării externe. Corectează ingredientele și gramajele înainte de salvare.</p>
    </section>
    <section className="panel calorie-result">
      <div className="panel-heading"><div><h3>Valori nutriționale estimate</h3><p>Total pentru ingredientele selectate</p></div><Flame className="calorie-flame" /></div>
      <div className="calorie-total"><strong>{Math.round(totals.kcal).toLocaleString('ro-RO')}</strong><span>kcal</span></div>
      <div className="macro-row"><span>Proteine</span><strong>{totals.protein.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.protein*4/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <div className="macro-row"><span>Carbohidrați</span><strong>{totals.carbs.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.carbs*4/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <div className="macro-row"><span>Grăsimi</span><strong>{totals.fat.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.fat*9/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <h4>Mese recente · selectează pentru a repeta</h4>
      {logs.length ? logs.map(log => <div className="meal-log-row" key={log.id}><button type="button" className="meal-repeat" onClick={()=>{const saved=Array.isArray((log as any).ingredients)?(log as any).ingredients:[];if(saved.length){setItems(saved.map((item:any,index:number)=>({id:Date.now()+index,food:String(item.food??item.name??'Ingredient'),grams:Number(item.grams??100),...(item.nutrition?{nutrition:item.nutrition}:{})})));setDescription(log.description);setMessage('Am copiat ingredientele mesei selectate. Verifică valorile înainte de salvare.')}else{setDescription(log.description);setMessage('Am copiat descrierea mesei. Adaugă ingredientele pentru calcul nutrițional.')}}}>Repetă</button><span>{log.description}</span><strong>{log.calories_kcal} kcal</strong></div>) : <p className="empty-logs">Mesele salvate vor apărea aici după configurarea bazei de date.</p>}
    </section>
  </div>
}
