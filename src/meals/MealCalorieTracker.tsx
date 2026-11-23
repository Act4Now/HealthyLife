import { useEffect, useMemo, useState } from 'react'
import { Flame, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Food = { name: string; kcal: number; protein: number; carbs: number; fat: number }
type Ingredient = { id: number; food: string; grams: number; nutrition?: Food }
type MealLog = { id: string; description: string; calories_kcal: number; protein_g: number; carbohydrates_g: number; fat_g: number; created_at: string; ingredients?: Ingredient[] }
type CustomFood = { id: string; name: string; serving_name: string; serving_grams: number; calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number; favorite: boolean }
type CustomRecipe = { id: string; name: string; servings: number; ingredients: Ingredient[]; calories_per_serving: number; protein_per_serving: number; carbs_per_serving: number; fat_per_serving: number }

function localDate() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }

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
  const [food, setFood] = useState('')
  const [grams, setGrams] = useState(0)
  const [portion, setPortion] = useState(1)
  const [items, setItems] = useState<Ingredient[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [logs, setLogs] = useState<MealLog[]>([])
  const [logDate, setLogDate] = useState(localDate())
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null)
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisNote, setAnalysisNote] = useState('')
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([])
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([])
  const [foodName, setFoodName] = useState('')
  const [foodServing, setFoodServing] = useState('100 g')
  const [foodGrams, setFoodGrams] = useState(0)
  const [foodKcal, setFoodKcal] = useState(0)
  const [foodProtein, setFoodProtein] = useState(0)
  const [foodCarbs, setFoodCarbs] = useState(0)
  const [foodFat, setFoodFat] = useState(0)
  const [recipeName, setRecipeName] = useState('')
  const [recipeServings, setRecipeServings] = useState(1)
  const [aiResponse, setAiResponse] = useState('')
  const [recentMeals, setRecentMeals] = useState<{ description: string; count: number; ingredients: Ingredient[] }[]>([])
  const totals = useMemo(() => items.reduce((sum, item) => {
    const custom = customFoods.find(x => x.name === item.food); const f = item.nutrition ?? foods[item.food] ?? (custom ? { name: custom.name, kcal: Number(custom.calories_kcal) * 100 / Number(custom.serving_grams), protein: Number(custom.protein_g) * 100 / Number(custom.serving_grams), carbs: Number(custom.carbs_g) * 100 / Number(custom.serving_grams), fat: Number(custom.fat_g) * 100 / Number(custom.serving_grams) } : { name: item.food, kcal: 0, protein: 0, carbs: 0, fat: 0 })
    const factor = item.grams / 100
    return { kcal: sum.kcal + f.kcal * factor, protein: sum.protein + f.protein * factor, carbs: sum.carbs + f.carbs * factor, fat: sum.fat + f.fat * factor }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [items, customFoods])

  useEffect(() => {
    if (!supabase || !userId) return
    Promise.all([
      supabase.from('custom_foods').select('*').order('favorite', { ascending: false }).order('name'),
      supabase.from('custom_recipes').select('*').order('name'),
    ]).then(([foodResult, recipeResult]) => {
      if (foodResult.error) setMessage(foodResult.error.message)
      else setCustomFoods((foodResult.data ?? []) as CustomFood[])
      if (recipeResult.error) setMessage(recipeResult.error.message)
      else setCustomRecipes((recipeResult.data ?? []) as CustomRecipe[])
    })
  }, [userId])

  useEffect(() => {
    if (!supabase || !userId) return
    const start = new Date(`${logDate}T00:00:00`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    supabase.from('meal_logs').select('id,description,calories_kcal,protein_g,carbohydrates_g,fat_g,ingredients,created_at')
      .eq('user_id', userId).gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setMessage(error.message); else setLogs((data ?? []) as MealLog[]) })
  }, [userId, logDate])

  // Recent and frequent meals from the last 30 days, shown as one-tap shortcuts.
  useEffect(() => {
    if (!supabase || !userId) return
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    supabase.from('meal_logs').select('description,ingredients,created_at')
      .eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        const grouped = new Map<string, { description: string; count: number; ingredients: Ingredient[] }>()
        for (const row of (data ?? []) as { description: string; ingredients: Ingredient[] | null }[]) {
          const key = row.description.trim().toLowerCase()
          if (!key) continue
          const existing = grouped.get(key)
          if (existing) existing.count += 1
          else grouped.set(key, { description: row.description, count: 1, ingredients: Array.isArray(row.ingredients) ? row.ingredients : [] })
        }
        setRecentMeals([...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 8))
      })
  }, [userId, logs])

  function loadRecentMeal(meal: { description: string; ingredients: Ingredient[] }) {
    setEditingMealId(null); setEditingRecipeId(null)
    setItems(meal.ingredients.map((item, index) => ({ ...item, id: Date.now() + index })))
    setDescription(meal.description)
    setMessage('Masa a fost încărcată în formular. Verifică ingredientele și gramajele, apoi salvează o înregistrare nouă.')
  }

  async function saveCustomFood() {
    if (!supabase || !userId) { setMessage('Autentificarea este necesară pentru a salva alimente personale.'); return }
    if (!foodName.trim() || !Number.isFinite(foodGrams) || foodGrams <= 0 || !Number.isFinite(foodKcal) || foodKcal <= 0 || [foodProtein, foodCarbs, foodFat].some(value => !Number.isFinite(value) || value < 0)) { setMessage('Completează numele, gramajul și valorile nutriționale valide (kcal trebuie să fie peste zero).'); return }
    const payload = { name: foodName.trim(), serving_name: foodServing.trim() || '100 g', serving_grams: foodGrams, calories_kcal: foodKcal, protein_g: foodProtein, carbs_g: foodCarbs, fat_g: foodFat }
    const result = editingFoodId
      ? await supabase.from('custom_foods').update(payload).eq('id', editingFoodId).eq('user_id', userId).select('*').single()
      : await supabase.from('custom_foods').insert({ user_id: userId, ...payload }).select('*').single()
    if (result.error) { setMessage(result.error.message); return }
    setCustomFoods(current => (editingFoodId ? current.map(item => item.id === editingFoodId ? result.data as CustomFood : item) : [...current, result.data as CustomFood]).sort((a,b) => a.name.localeCompare(b.name)))
    setEditingFoodId(null); setFoodName(''); setFoodServing('100 g'); setFoodGrams(0); setFoodKcal(0); setFoodProtein(0); setFoodCarbs(0); setFoodFat(0)
    setMessage(editingFoodId ? 'Alimentul personal a fost actualizat.' : 'Alimentul personal a fost salvat.')
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
    if (!recipeName.trim() || !items.length || items.some(item => !Number.isFinite(item.grams) || item.grams <= 0) || !Number.isFinite(recipeServings) || recipeServings <= 0 || !Number.isFinite(totals.kcal) || totals.kcal <= 0) { setMessage('Adaugă un nume, ingrediente valide și numărul de porții.'); return }
    const payload = { name: recipeName.trim(), servings: recipeServings, ingredients: items, calories_per_serving: totals.kcal / recipeServings, protein_per_serving: totals.protein / recipeServings, carbs_per_serving: totals.carbs / recipeServings, fat_per_serving: totals.fat / recipeServings }
    const result = editingRecipeId
      ? await supabase.from('custom_recipes').update(payload).eq('id', editingRecipeId).eq('user_id', userId).select('*').single()
      : await supabase.from('custom_recipes').insert({ user_id: userId, ...payload }).select('*').single()
    if (result.error) { setMessage(result.error.message); return }
    setCustomRecipes(current => (editingRecipeId ? current.map(recipe => recipe.id === editingRecipeId ? result.data as CustomRecipe : recipe) : [...current, result.data as CustomRecipe]).sort((a,b) => a.name.localeCompare(b.name)))
    setEditingRecipeId(null); setRecipeName(''); setRecipeServings(1)
    setMessage(editingRecipeId ? 'Rețeta a fost actualizată.' : 'Rețeta a fost salvată; valorile sunt calculate per porție.')
  }

  function loadCustomRecipe(recipe: CustomRecipe) {
    setEditingRecipeId(null); setEditingMealId(null)
    setItems((recipe.ingredients ?? []).map((item, index) => ({ ...item, id: Date.now() + index })))
    setDescription(recipe.name)
    setMessage('Rețeta a fost încărcată în jurnal. Verifică gramajele înainte de salvare.')
  }

  function editCustomRecipe(recipe: CustomRecipe) {
    setEditingMealId(null); setEditingRecipeId(recipe.id); setRecipeName(recipe.name); setRecipeServings(recipe.servings)
    setItems((recipe.ingredients ?? []).map((item, index) => ({ ...item, id: Date.now() + index })))
    setMessage('Editezi rețeta. Modifică ingredientele și apoi salvează rețeta.')
  }

  async function deleteCustomRecipe(id: string) {
    if (!supabase || !userId) return
    const { error } = await supabase.from('custom_recipes').delete().eq('id', id).eq('user_id', userId)
    if (error) { setMessage(error.message); return }
    setCustomRecipes(current => current.filter(recipe => recipe.id !== id))
    if (editingRecipeId === id) setEditingRecipeId(null)
    setMessage('Rețeta a fost ștearsă.')
  }

  function editCustomFood(item: CustomFood) {
    setEditingFoodId(item.id); setFoodName(item.name); setFoodServing(item.serving_name); setFoodGrams(Number(item.serving_grams))
    setFoodKcal(Number(item.calories_kcal)); setFoodProtein(Number(item.protein_g)); setFoodCarbs(Number(item.carbs_g)); setFoodFat(Number(item.fat_g))
    setMessage('Editezi alimentul personal. Salvează pentru a aplica modificările.')
  }

  async function deleteMeal(id: string) {
    if (!supabase || !userId) return
    const { error } = await supabase.from('meal_logs').delete().eq('id', id).eq('user_id', userId)
    if (error) { setMessage(error.message); return }
    setLogs(current => current.filter(log => log.id !== id))
    if (editingMealId === id) setEditingMealId(null)
    setMessage('Înregistrarea mesei a fost ștearsă.')
  }

  async function copySelectedDay() {
    if (!supabase || !userId) { setMessage('Autentifică-te pentru a copia mesele.'); return }
    if (!logs.length || logDate === localDate()) return
    if (!window.confirm(`Copiază cele ${logs.length} mese din ${logDate} în jurnalul de astăzi?`)) return
    const rows = logs.map(log => ({
      user_id: userId,
      description: log.description,
      calories_kcal: log.calories_kcal,
      protein_g: log.protein_g,
      carbohydrates_g: log.carbohydrates_g,
      fat_g: log.fat_g,
      ingredients: log.ingredients ?? [],
    }))
    const { error } = await supabase.from('meal_logs').insert(rows)
    if (error) { setMessage('Nu am putut copia ziua: ' + error.message); return }
    setLogDate(localDate())
    setEditingMealId(null); setEditingRecipeId(null); setDescription(''); setItems([])
    setMessage('Mesele zilei selectate au fost copiate în jurnalul de astăzi.')
  }

  function loadMealForEdit(log: MealLog) {
    setEditingRecipeId(null)
    const saved = Array.isArray(log.ingredients) ? log.ingredients : []
    setEditingMealId(log.id); setDescription(log.description)
    setItems(saved.map((item, index) => ({ ...item, id: Date.now() + index })))
    setMessage('Editezi masa selectată. Salvează pentru a actualiza înregistrarea existentă.')
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

  function buildMealAnalysisPrompt() {
    return `Analyze the attached meal photo for a food diary. Identify visible foods and estimate edible portion weights in grams. For each ingredient return nutrition per 100 g: calories (kcal), protein_g, carbs_g, fat_g. Do not invent hidden ingredients; state uncertainty clearly. Reply ONLY with valid JSON in this exact shape:
{
  "description": "short meal description",
  "uncertainty": "what is uncertain",
  "ingredients": [
    { "name": "food name", "grams": 120, "kcal_per_100g": 150, "protein_g_per_100g": 20, "carbs_g_per_100g": 5, "fat_g_per_100g": 4 }
  ]
}
Use numeric values. If portion size cannot be determined, give a cautious estimate and explain uncertainty.`
  }

  async function analyzePhoto() {
    if (!photo) { setMessage('Selectează mai întâi o fotografie.'); return }
    const prompt = buildMealAnalysisPrompt()
    try {
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [photo] })) {
        await navigator.share({ title: 'HealthyLife – analiză masă', text: prompt, files: [photo] })
        setMessage('Fotografia și instrucțiunile au fost partajate. După analiza în aplicația AI aleasă, copiază răspunsul JSON aici.')
      } else {
        await navigator.clipboard.writeText(prompt)
        setMessage('Instrucțiunile au fost copiate. Deschide aplicația AI preferată, atașează fotografia și lipește instrucțiunile.')
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(prompt)
        setMessage('Partajarea fotografiei nu este disponibilă în acest browser. Instrucțiunile au fost copiate; atașează fotografia manual în aplicația AI.')
      } catch {
        setMessage('Partajarea nu este disponibilă. Copiază instrucțiunile afișate mai jos și atașează fotografia în aplicația AI.')
      }
    }
  }

  function importAiAnalysis() {
    try {
      const raw = aiResponse.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      const parsed = JSON.parse(raw) as { description?: unknown; uncertainty?: unknown; ingredients?: unknown[] }
      if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) throw new Error('Răspunsul nu conține ingrediente.')
      const analyzed: Ingredient[] = parsed.ingredients.map((entry, index) => {
        const item = entry as Record<string, unknown>
        const name = String(item.name ?? '').trim()
        const grams = Number(item.grams)
        const nutrition = {
          name,
          kcal: Number(item.kcal_per_100g),
          protein: Number(item.protein_g_per_100g),
          carbs: Number(item.carbs_g_per_100g),
          fat: Number(item.fat_g_per_100g),
        }
        if (!name || !Number.isFinite(grams) || grams <= 0 || ![nutrition.kcal, nutrition.protein, nutrition.carbs, nutrition.fat].every(value => Number.isFinite(value) && value >= 0)) {
          throw new Error('Unul dintre ingrediente are valori lipsă sau invalide. Cere aplicației AI JSON-ul în formatul indicat.')
        }
        return { id: Date.now() + index, food: name, grams: Math.round(grams), nutrition }
      })
      setItems(analyzed)
      if (typeof parsed.description === 'string') setDescription(parsed.description)
      setAnalysisNote(typeof parsed.uncertainty === 'string' ? parsed.uncertainty : 'Valorile sunt estimări generate de AI. Verifică ingredientele și gramajele.')
      setMessage('Analiza AI a fost importată. Verifică rezultatele înainte de salvare.')
      setAiResponse('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Nu am putut interpreta răspunsul AI. Lipește JSON-ul complet.')
    }
  }

  async function saveMeal() {
    if (items.length === 0) { setMessage('Adaugă cel puțin un ingredient și gramajul acestuia înainte de salvare.'); return }
    if (![totals.kcal, totals.protein, totals.carbs, totals.fat].every(value => Number.isFinite(value) && value >= 0) || totals.kcal <= 0) { setMessage('Verifică valorile nutriționale ale ingredientelor înainte de salvare.'); return }
    setSaving(true); setMessage('')
    try {
      if (!supabase || !userId) { setMessage('Autentifică-te pentru a salva masa în istoricul personal.'); return }
      if (items.some(item => !Number.isFinite(item.grams) || item.grams <= 0)) { setMessage('Verifică gramajele ingredientelor înainte de salvare.'); return }
      const payload = {
        description: description.trim() || items.map(x => x.food).join(', '),
        calories_kcal: Math.round(totals.kcal), protein_g: Number(totals.protein.toFixed(1)),
        carbohydrates_g: Number(totals.carbs.toFixed(1)), fat_g: Number(totals.fat.toFixed(1)), ingredients: items,
      }
      const result = editingMealId
        ? await supabase.from('meal_logs').update(payload).eq('id', editingMealId).eq('user_id', userId).select('id,description,calories_kcal,protein_g,carbohydrates_g,fat_g,ingredients,created_at').single()
        : await supabase.from('meal_logs').insert({ user_id: userId, ...payload }).select('id,description,calories_kcal,protein_g,carbohydrates_g,fat_g,ingredients,created_at').single()
      if (result.error) throw result.error
      if (editingMealId) setLogs(current => current.map(log => log.id === editingMealId ? result.data as MealLog : log))
      else if (logDate === localDate()) setLogs(current => [result.data as MealLog, ...current])
      else setLogDate(localDate())
      setMessage(editingMealId ? 'Masa a fost actualizată.' : 'Masa a fost salvată în istoricul profilului.')
      setEditingMealId(null); setDescription(''); setPhoto(null); setPhotoPreview(''); setAnalysisNote(''); setPhotoConsent(false); setItems([])
    } catch (e) {
      const detail = e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : ''
      setMessage(detail ? 'Nu am putut salva masa: ' + detail : 'Nu am putut salva masa. Verifică autentificarea și conexiunea la baza de date.')
    }
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
          <label>Gramaj porție (g)<input type="number" min="1" value={foodGrams || ''} placeholder="ex. 100" onChange={e=>setFoodGrams(Number(e.target.value))}/></label>
          <label>kcal / porție<input type="number" min="0" value={foodKcal} onChange={e=>setFoodKcal(Number(e.target.value))}/></label>
          <label>Proteine (g)<input type="number" min="0" value={foodProtein} onChange={e=>setFoodProtein(Number(e.target.value))}/></label>
          <label>Carbohidrați (g)<input type="number" min="0" value={foodCarbs} onChange={e=>setFoodCarbs(Number(e.target.value))}/></label>
          <label>Grăsimi (g)<input type="number" min="0" value={foodFat} onChange={e=>setFoodFat(Number(e.target.value))}/></label>
          <button type="button" onClick={()=>void saveCustomFood()}>{editingFoodId ? 'Actualizează alimentul' : 'Salvează alimentul'}</button>{editingFoodId && <button type="button" onClick={()=>{setEditingFoodId(null);setFoodName('');setFoodServing('100 g');setFoodGrams(100);setFoodKcal(0);setFoodProtein(0);setFoodCarbs(0);setFoodFat(0)}}>Anulează editarea</button>}
        </div>
        {customFoods.map(item=><div className="custom-food-row" key={item.id}><span>{item.name} · {item.serving_grams} g</span><button type="button" onClick={()=>void toggleFoodFavorite(item)}>{item.favorite?'★ Favorit':'☆ Favorit'}</button><button type="button" onClick={()=>editCustomFood(item)}>Editează</button><button type="button" onClick={()=>void deleteCustomFood(item.id)}>Șterge</button></div>)}
        {!customFoods.length && <p className="empty-logs">Alimentele create de tine vor apărea aici.</p>}
      </details>
      {recentMeals.length > 0 && <div className="recent-meals"><strong>Recente și frecvente</strong><div>{recentMeals.map(meal => <button type="button" key={meal.description} onClick={() => loadRecentMeal(meal)}>{meal.description}{meal.count > 1 ? ` ×${meal.count}` : ''}</button>)}</div></div>}
      <div className="ingredient-title"><strong>Ingrediente și cantități</strong><span>valori estimative / 100 g</span></div>
      <div className="ingredient-add">
        <select value={food} onChange={e => setFood(e.target.value)}><option value="">Selectează un aliment…</option>{Object.keys(foods).map(name => <option key={name}>{name}</option>)}{customFoods.length > 0 && <optgroup label="Alimentele mele">{customFoods.map(item => <option key={item.id} value={item.name}>{item.favorite ? '★ ' : ''}{item.name}</option>)}</optgroup>}</select>
        <input type="number" min="1" max="2000" value={grams} onChange={e => setGrams(Number(e.target.value))} aria-label="Grame" />
        <span>g</span><div className="portion-quick" aria-label="Mărimea porției">{[0.5,1,1.5,2].map(n=><button type="button" key={n} className={portion===n?'selected':''} onClick={()=>setPortion(n)}>{n===0.5?'½':n===1?'1':n===1.5?'1½':'2'}×</button>)}</div><button type="button" disabled={!food || !Number.isFinite(grams) || grams <= 0} onClick={() => setItems(v => [...v, { id: Date.now(), food, grams: Math.max(1, Math.round(grams*portion)) }])}><Plus size={16} /> Adaugă</button>
      </div>
      <div className="ingredient-list">{items.map(item => <div key={item.id}><span>{item.food}</span><small>{item.grams} g · {Math.round((item.nutrition ?? foods[item.food] ?? (() => { const x=customFoods.find(f=>f.name===item.food); return x ? {kcal:Number(x.calories_kcal)*100/Number(x.serving_grams)} : {kcal:0} })()).kcal * item.grams / 100)} kcal</small><button aria-label="Șterge ingredientul" onClick={() => setItems(v => v.filter(x => x.id !== item.id))}><Trash2 size={15} /></button></div>)}</div>
      <details className="custom-food-editor">
        <summary>＋ Salvează rețeta ingredientelor curente</summary>
        <div className="custom-food-fields">
          <input value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Numele rețetei" maxLength={160}/><label>Număr de porții<input type="number" min="1" max="100" step="1" value={recipeServings} onChange={e=>setRecipeServings(Math.max(1,Number(e.target.value)))}/></label>
          <button type="button" onClick={()=>void saveCustomRecipe()}>{editingRecipeId ? 'Actualizează rețeta' : 'Salvează rețeta'}</button>{editingRecipeId && <button type="button" onClick={()=>setEditingRecipeId(null)}>Anulează editarea</button>}
        </div>
        {customRecipes.map(recipe=><div className="custom-food-row" key={recipe.id}><span>{recipe.name} · {Math.round(recipe.calories_per_serving)} kcal / porție</span><button type="button" onClick={()=>loadCustomRecipe(recipe)}>Încarcă</button><button type="button" onClick={()=>editCustomRecipe(recipe)}>Editează</button><button type="button" onClick={()=>void deleteCustomRecipe(recipe.id)}>Șterge</button></div>)}
        {!customRecipes.length && <p className="empty-logs">Rețetele salvate vor apărea aici.</p>}
      </details>
      <label className="photo-drop"><ImagePlus size={19} /><span>{photo ? photo.name : 'Fotografia mesei (analizată temporar, nu este salvată)'}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => attachPhoto(e.target.files?.[0])} /></label>
      {photoPreview && <><img className="meal-photo-preview" src={photoPreview} alt="Previzualizare locală a fotografiei mesei" /><p className="calorie-disclaimer">Alege aplicația AI din meniul de partajare al telefonului (de exemplu ChatGPT sau Gemini). HealthyLife nu trimite fotografia către un serviciu AI și nu are nevoie de o cheie API. Fotografia este transmisă numai aplicației pe care o selectezi.</p><button type="button" className="outline-button" onClick={() => void analyzePhoto()} disabled={saving}>Partajează cu aplicația AI</button><details className="custom-food-editor"><summary>Instrucțiuni pentru copiere manuală</summary><textarea readOnly rows={8} value={buildMealAnalysisPrompt()} /><button type="button" className="outline-button" onClick={() => void navigator.clipboard.writeText(buildMealAnalysisPrompt())}>Copiază instrucțiunile</button></details><label className="calorie-label">Lipește răspunsul JSON primit de la aplicația AI<textarea rows={8} value={aiResponse} onChange={e=>setAiResponse(e.target.value)} placeholder='{"description":"...","ingredients":[...]}' /></label><button type="button" className="outline-button" onClick={importAiAnalysis} disabled={!aiResponse.trim()}>Importă analiza în jurnal</button></>}
      {analysisNote && <p className="calorie-disclaimer">{analysisNote}</p>}
      <button className="save-meal-button" onClick={() => void saveMeal()} disabled={saving}><Save size={16} />{saving ? 'Se salvează…' : editingMealId ? 'Actualizează masa' : 'Salvează masa și valorile'}</button>{editingMealId && <button type="button" className="outline-button" onClick={()=>{setEditingMealId(null);setDescription('');setItems([]);setMessage('Editarea a fost anulată.')}}>Anulează editarea</button>}
      {message && <p className="calorie-message" role="status">{message}</p>}
      <p className="calorie-disclaimer">Estimările din fotografie pot fi inexacte, mai ales pentru uleiuri, sosuri și ingrediente ascunse. Fotografia nu este transmisă de HealthyLife către niciun server AI. Dacă alegi partajarea, aceasta este trimisă direct aplicației selectate de tine, conform politicii și condițiilor acelui furnizor. Corectează ingredientele și gramajele înainte de salvare.</p>
    </section>
    <section className="panel calorie-result">
      <div className="panel-heading"><div><h3>Valori nutriționale estimate</h3><p>Total pentru ingredientele selectate</p></div><Flame className="calorie-flame" /></div>
      <div className="calorie-total"><strong>{Math.round(totals.kcal).toLocaleString('ro-RO')}</strong><span>kcal</span></div>
      <div className="macro-row"><span>Proteine</span><strong>{totals.protein.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.protein*4/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <div className="macro-row"><span>Carbohidrați</span><strong>{totals.carbs.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.carbs*4/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <div className="macro-row"><span>Grăsimi</span><strong>{totals.fat.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.fat*9/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <div className="meal-history-heading"><h4>Mesele zilei selectate</h4><label>Ziua <input type="date" value={logDate} max={localDate()} onChange={e=>setLogDate(e.target.value)} /></label>{logDate !== localDate() && logs.length > 0 && <button type="button" className="outline-button" onClick={()=>void copySelectedDay()}>Copiază toată ziua în astăzi</button>}</div>
      {logs.length ? logs.map(log => <div className="meal-log-row" key={log.id}><button type="button" className="meal-repeat" onClick={()=>loadMealForEdit(log)}>Editează</button><button type="button" className="meal-repeat" onClick={()=>{const saved=Array.isArray(log.ingredients)?log.ingredients:[];setEditingMealId(null);setEditingRecipeId(null);setItems(saved.map((item,index)=>({...item,id:Date.now()+index})));setDescription(log.description);setMessage('Masa a fost copiată în formular. Verifică data, ingredientele și gramajele înainte de a salva o înregistrare nouă.')}}>Copiază</button><span>{log.description}</span><strong>{log.calories_kcal} kcal</strong><button type="button" onClick={()=>void deleteMeal(log.id)} aria-label="Șterge masa">Șterge</button></div>) : <p className="empty-logs">Nu există mese salvate pentru această zi. Selectează o zi anterioară pentru a copia o masă.</p>}
    </section>
  </div>
}
