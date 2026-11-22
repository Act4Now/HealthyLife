import { useEffect, useMemo, useState } from 'react'
import { Flame, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Food = { name: string; kcal: number; protein: number; carbs: number; fat: number }
type Ingredient = { id: number; food: string; grams: number }
type MealLog = { id: string; description: string; calories_kcal: number; protein_g: number; carbohydrates_g: number; fat_g: number; created_at: string }

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
  const [items, setItems] = useState<Ingredient[]>([{ id: 1, food: 'Chicken breast', grams: 120 }, { id: 2, food: 'Rice, cooked', grams: 150 }])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [logs, setLogs] = useState<MealLog[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const totals = useMemo(() => items.reduce((sum, item) => {
    const f = foods[item.food]
    const factor = item.grams / 100
    return { kcal: sum.kcal + f.kcal * factor, protein: sum.protein + f.protein * factor, carbs: sum.carbs + f.carbs * factor, fat: sum.fat + f.fat * factor }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [items])

  useEffect(() => {
    if (!supabase || !userId) return
    supabase.from('meal_logs').select('id,description,calories_kcal,protein_g,carbohydrates_g,fat_g,created_at').order('created_at', { ascending: false }).limit(10)
      .then(({ data, error }) => { if (error) setMessage(error.message); else setLogs((data ?? []) as MealLog[]) })
  }, [userId])

  function attachPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Alege o fotografie JPG, PNG sau WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setMessage('Fotografia trebuie să fie sub 5 MB.'); return }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setMessage('')
  }

  async function saveMeal() {
    if (!description.trim() && items.length === 0) { setMessage('Adaugă o descriere sau ingrediente.'); return }
    setSaving(true); setMessage('')
    try {
      if (!supabase || !userId) { setMessage('Mod demo: estimarea este afișată, dar salvarea în istoric necesită autentificare Supabase și migrarea SQL.'); return }
      let photoPath: string | null = null
      if (photo) {
        photoPath = userId + '/' + crypto.randomUUID() + '-' + photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const { error: uploadError } = await supabase.storage.from('meal-photos').upload(photoPath, photo, { contentType: photo.type, upsert: false })
        if (uploadError) throw uploadError
      }
      const { data, error } = await supabase.from('meal_logs').insert({
        user_id: userId, description: description.trim() || items.map(x => x.food).join(', '),
        photo_path: photoPath, calories_kcal: Math.round(totals.kcal),
        protein_g: Number(totals.protein.toFixed(1)), carbohydrates_g: Number(totals.carbs.toFixed(1)),
        fat_g: Number(totals.fat.toFixed(1)), ingredients: items,
      }).select('id,description,calories_kcal,protein_g,carbohydrates_g,fat_g,created_at').single()
      if (error) throw error
      setLogs(current => [data as MealLog, ...current])
      setMessage('Masa a fost salvată în istoricul profilului.')
      setDescription(''); setPhoto(null); setPhotoPreview(''); setItems([])
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Nu am putut salva masa.') }
    finally { setSaving(false) }
  }

  return <div className="calorie-layout">
    <section className="panel calorie-form">
      <div className="panel-heading"><div><h3>Jurnal alimentar & calorii</h3><p>Descrie masa, adaugă ingredientele și atașează o fotografie</p></div><Flame className="calorie-flame" /></div>
      <label className="calorie-label">Descrierea mesei
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Piept de pui la grătar cu orez, avocado și roșii..." rows={3} />
      </label>
      <div className="ingredient-title"><strong>Ingrediente și cantități</strong><span>valori estimative / 100 g</span></div>
      <div className="ingredient-add">
        <select value={food} onChange={e => setFood(e.target.value)}>{Object.keys(foods).map(name => <option key={name}>{name}</option>)}</select>
        <input type="number" min="1" max="2000" value={grams} onChange={e => setGrams(Number(e.target.value))} aria-label="Grame" />
        <span>g</span><button onClick={() => setItems(v => [...v, { id: Date.now(), food, grams: Math.max(1, grams) }])}><Plus size={16} /> Adaugă</button>
      </div>
      <div className="ingredient-list">{items.map(item => <div key={item.id}><span>{item.food}</span><small>{item.grams} g · {Math.round(foods[item.food].kcal * item.grams / 100)} kcal</small><button aria-label="Șterge ingredientul" onClick={() => setItems(v => v.filter(x => x.id !== item.id))}><Trash2 size={15} /></button></div>)}</div>
      <label className="photo-drop"><ImagePlus size={19} /><span>{photo ? photo.name : 'Atașează fotografia mesei (opțional)'}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => attachPhoto(e.target.files?.[0])} /></label>
      {photoPreview && <img className="meal-photo-preview" src={photoPreview} alt="Previzualizare fotografie masă" />}
      <button className="save-meal-button" onClick={() => void saveMeal()} disabled={saving}><Save size={16} />{saving ? 'Se salvează…' : 'Salvează masa și valorile'}</button>
      {message && <p className="calorie-message" role="status">{message}</p>}
      <p className="calorie-disclaimer">Estimare orientativă din ingredientele și gramajele introduse. Fotografia se atașează la înregistrare; analiza automată a imaginii necesită conectarea unui serviciu AI cu viziune, care nu este configurat încă.</p>
    </section>
    <section className="panel calorie-result">
      <div className="panel-heading"><div><h3>Valori nutriționale estimate</h3><p>Total pentru ingredientele selectate</p></div><Flame className="calorie-flame" /></div>
      <div className="calorie-total"><strong>{Math.round(totals.kcal).toLocaleString('ro-RO')}</strong><span>kcal</span></div>
      <div className="macro-row"><span>Proteine</span><strong>{totals.protein.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.protein*4/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <div className="macro-row"><span>Carbohidrați</span><strong>{totals.carbs.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.carbs*4/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <div className="macro-row"><span>Grăsimi</span><strong>{totals.fat.toFixed(1)} g</strong><i><b style={{width: totals.kcal ? (totals.fat*9/totals.kcal*100)+'%' : '0%'}} /></i></div>
      <h4>Istoricul meselor</h4>
      {logs.length ? logs.map(log => <div className="meal-log-row" key={log.id}><span>{log.description}</span><strong>{log.calories_kcal} kcal</strong></div>) : <p className="empty-logs">Mesele salvate vor apărea aici după configurarea bazei de date.</p>}
    </section>
  </div>
}
