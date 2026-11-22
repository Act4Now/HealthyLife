import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Goal = 'lose' | 'maintain' | 'gain'
type Activity = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high'
type Pace = 'gentle' | 'steady' | 'ambitious'
type TargetKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'water' | 'steps' | 'sleep'
type TargetValues = Record<TargetKey, number>
type Enabled = Record<TargetKey, boolean>
type Props = { userId?: string; onboarding?: boolean; onComplete?: () => void; onSkip?: () => void }

const emptyTargets: TargetValues = { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0, steps: 0, sleep: 0 }
const defaultsEnabled: Enabled = { calories: true, protein: false, carbs: false, fat: false, water: true, steps: false, sleep: false }
const labels: Record<TargetKey, string> = { calories: 'Calorii (kcal)', protein: 'Proteine (g)', carbs: 'Carbohidrați (g)', fat: 'Grăsimi (g)', water: 'Apă (ml)', steps: 'Pași', sleep: 'Somn (ore)' }
const keys: TargetKey[] = ['calories', 'protein', 'carbs', 'fat', 'water', 'steps', 'sleep']
const activityFactor: Record<Activity, number> = { sedentary: 26, light: 28, moderate: 30, high: 33, very_high: 36 }

function localDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function PersonalGoals({ userId, onboarding = false, onComplete, onSkip }: Props) {
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState<Goal>('maintain')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState<Activity>('moderate')
  const [pace, setPace] = useState<Pace>('steady')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg')
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm')
  const [values, setValues] = useState<TargetValues>(emptyTargets)
  const [enabled, setEnabled] = useState<Enabled>(defaultsEnabled)
  const [dayType, setDayType] = useState<'all' | 'weekday' | 'weekend'>('all')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const today = localDate()
  const todayKind = useMemo(() => {
    const day = new Date(`${today}T12:00:00`).getDay()
    return day === 0 || day === 6 ? 'weekend' : 'weekday'
  }, [today])

  useEffect(() => {
    if (!supabase || !userId) { setLoaded(true); return }
    let live = true
    Promise.all([
      supabase.from('profiles').select('height_cm,current_weight_kg,weight_goal,activity_level,goal_pace,preferred_weight_unit,preferred_height_unit,onboarding_completed_at').eq('id', userId).maybeSingle(),
      supabase.from('daily_targets').select('*').lte('target_date', today).in('day_type', ['all', todayKind]).order('target_date', { ascending: false }).order('created_at', { ascending: false }),
    ]).then(([p, t]) => {
      if (!live) return
      if (p.error) throw p.error
      if (t.error) throw t.error
      if (p.data) {
        const wUnit = p.data.preferred_weight_unit === 'lb' ? 'lb' : 'kg'
        const hUnit = p.data.preferred_height_unit === 'ft' ? 'ft' : 'cm'
        setWeightUnit(wUnit); setHeightUnit(hUnit)
        if (p.data.height_cm != null) setHeight(String(hUnit === 'ft' ? Number(p.data.height_cm) / 30.48 : p.data.height_cm))
        if (p.data.current_weight_kg != null) setWeight(String(wUnit === 'lb' ? Number(p.data.current_weight_kg) * 2.2046226218 : p.data.current_weight_kg))
        if (p.data.weight_goal) setGoal(p.data.weight_goal)
        if (p.data.activity_level) setActivity(p.data.activity_level)
        if (p.data.goal_pace) setPace(p.data.goal_pace)
      }
      const targetRows = t.data ?? []
      const selected = targetRows.find(row => row.day_type === todayKind) ?? targetRows.find(row => row.day_type === 'all')
      if (selected) {
        setValues({ calories: selected.calories_kcal ?? 0, protein: selected.protein_g ?? 0, carbs: selected.carbs_g ?? 0, fat: selected.fat_g ?? 0, water: selected.water_ml ?? 0, steps: selected.steps ?? 0, sleep: selected.sleep_hours ?? 0 })
        setEnabled({ ...defaultsEnabled, ...(selected.enabled ?? {}) })
        setDayType(selected.day_type)
        setStep(2)
      } else if (p.data && p.data.height_cm != null && p.data.current_weight_kg != null) {
        setStep(2)
        {
          const storedKg = Number(p.data.current_weight_kg)
          const storedActivity = (p.data.activity_level ?? 'moderate') as Activity
          const storedGoal = (p.data.weight_goal ?? 'maintain') as Goal
          const storedPace = (p.data.goal_pace ?? 'steady') as Pace
          const adjustment = storedGoal === 'lose' ? (storedPace === 'gentle' ? -250 : storedPace === 'steady' ? -400 : -500) : storedGoal === 'gain' ? (storedPace === 'gentle' ? 150 : storedPace === 'steady' ? 250 : 350) : 0
          setValues({ calories: Math.max(1200, Math.round(storedKg * activityFactor[storedActivity] + adjustment)), protein: 0, carbs: 0, fat: 0, water: Math.round(Math.max(1500, Math.min(4500, storedKg * 35)) / 50) * 50, steps: 0, sleep: 0 })
          setEnabled(defaultsEnabled)
        }
      }
      setLoaded(true)
    }).catch(error => {
      if (live) { setMessage(error instanceof Error ? error.message : 'Nu am putut încărca profilul și obiectivele.'); setLoaded(true) }
    })
    return () => { live = false }
  }, [userId, today, todayKind, onboarding])

  const heightCm = heightUnit === 'ft' ? Number(height) * 30.48 : Number(height)
  const weightKg = weightUnit === 'lb' ? Number(weight) / 2.2046226218 : Number(weight)
  const goalFactor = goal === 'lose' ? (pace === 'gentle' ? -250 : pace === 'steady' ? -400 : -500) : goal === 'gain' ? (pace === 'gentle' ? 150 : pace === 'steady' ? 250 : 350) : 0
  const profileValid = Number.isFinite(heightCm) && heightCm >= 100 && heightCm <= 250 && Number.isFinite(weightKg) && weightKg >= 25 && weightKg <= 350
  const suggestedCalories = profileValid ? Math.max(1200, Math.round(weightKg * activityFactor[activity] + goalFactor)) : null
  const suggestedWater = profileValid ? Math.round(Math.max(1500, Math.min(4500, weightKg * 35)) / 50) * 50 : null

  async function saveProfile() {
    if (!supabase || !userId) { setMessage('Autentificarea este necesară pentru a salva profilul.'); return }
    if (!profileValid) { setMessage('Introdu o înălțime între 100 și 250 cm și o greutate între 25 și 350 kg.'); return }
    setBusy(true); setMessage('')
    const { error } = await supabase.from('profiles').update({
      height_cm: Number(heightCm.toFixed(2)),
      current_weight_kg: Number(weightKg.toFixed(2)),
      weight_goal: goal,
      activity_level: activity,
      goal_pace: pace,
      preferred_weight_unit: weightUnit,
      preferred_height_unit: heightUnit,
    }).eq('id', userId)
    setBusy(false)
    if (error) { setMessage('Profilul nu a putut fi salvat: ' + error.message); return }
    setValues({ calories: suggestedCalories ?? 0, protein: 0, carbs: 0, fat: 0, water: suggestedWater ?? 0, steps: 0, sleep: 0 })
    setEnabled(defaultsEnabled)
    setMessage('Profilul a fost salvat. Valorile propuse sunt obiective, nu măsurători; ajustează-le înainte de salvare.')
    setStep(2)
  }

  async function saveTargets() {
    if (!supabase || !userId) { setMessage('Autentificarea este necesară pentru a salva obiectivele.'); return }
    const invalid = keys.find(key => enabled[key] && (!Number.isFinite(values[key]) || values[key] <= 0))
    if (invalid) { setMessage(`Introdu o valoare mai mare decât zero pentru: ${labels[invalid]}.`); return }
    setBusy(true); setMessage('')
    const row = {
      user_id: userId, target_date: today, day_type: dayType,
      calories_kcal: enabled.calories ? values.calories : null,
      protein_g: enabled.protein ? values.protein : null,
      carbs_g: enabled.carbs ? values.carbs : null,
      fat_g: enabled.fat ? values.fat : null,
      water_ml: enabled.water ? values.water : null,
      steps: enabled.steps ? values.steps : null,
      sleep_hours: enabled.sleep ? values.sleep : null,
      enabled,
    }
    const { data: existing, error: lookupError } = await supabase.from('daily_targets').select('id').eq('user_id', userId).eq('target_date', today).eq('day_type', dayType).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (lookupError) { setMessage('Nu am putut verifica țintele existente: ' + lookupError.message); setBusy(false); return }
    const result = existing
      ? await supabase.from('daily_targets').update(row).eq('id', existing.id)
      : await supabase.from('daily_targets').insert(row)
    if (result.error) { setMessage('Eroare la salvarea obiectivelor: ' + result.error.message); setBusy(false); return }
    const { error: profileError } = await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString(), onboarding_skipped_at: null }).eq('id', userId)
    if (profileError) { setMessage('Țintele au fost salvate, dar finalizarea configurării nu a putut fi înregistrată: ' + profileError.message); setBusy(false); return }
    setBusy(false)
    setMessage('Obiectivele au fost salvate. Datele istorice nu au fost modificate.')
    onComplete?.()
  }

  async function skipOnboarding() {
    if (!supabase || !userId) { setMessage('Autentificarea este necesară pentru a amâna configurarea.'); return }
    setBusy(true); setMessage('')
    const { error } = await supabase.from('profiles').update({ onboarding_skipped_at: new Date().toISOString() }).eq('id', userId)
    setBusy(false)
    if (error) { setMessage('Nu am putut salva amânarea: ' + error.message); return }
    onSkip?.()
  }

  if (!userId) return <section className="panel personal-goals"><h3>Obiective personalizate</h3><p>Autentifică-te pentru configurarea și sincronizarea obiectivelor personale.</p></section>
  if (!loaded) return <section className="panel personal-goals"><p>Se încarcă profilul și obiectivele…</p></section>

  return <section className="panel personal-goals" aria-labelledby="personal-goals-title">
    <div className="panel-heading"><div><h3 id="personal-goals-title">{onboarding ? 'Configurează profilul HealthyLife' : 'Profil și obiective personale'}</h3><p>Configurare scurtă, editabilă oricând</p></div><span>Pas {step} din 2</span></div>
    {step === 1 ? <>
      <div className="goal-steps"><span className="active">1 · Profil</span><span>2 · Ținte zilnice</span></div>
      <div className="goal-grid">
        <label>Obiectiv<select value={goal} onChange={e => setGoal(e.target.value as Goal)}><option value="lose">Slăbire</option><option value="maintain">Menținere</option><option value="gain">Creștere în greutate</option></select></label>
        <label>Înălțime ({heightUnit})<input type="number" min={heightUnit === 'cm' ? 100 : 3.28} max={heightUnit === 'cm' ? 250 : 8.2} step="0.01" value={height} placeholder={heightUnit === 'cm' ? 'ex. 170' : 'ex. 5.58'} onChange={e => setHeight(e.target.value)} /></label>
        <label>Greutate ({weightUnit})<input type="number" min={weightUnit === 'kg' ? 25 : 55.12} max={weightUnit === 'kg' ? 350 : 771.62} step="0.1" value={weight} placeholder={weightUnit === 'kg' ? 'ex. 70' : 'ex. 154.3'} onChange={e => setWeight(e.target.value)} /></label>
        <label>Unitatea greutății<select value={weightUnit} onChange={e => { const next = e.target.value as 'kg' | 'lb'; const kg = weightUnit === 'lb' ? Number(weight) / 2.2046226218 : Number(weight); setWeight(Number.isFinite(kg) && kg > 0 ? String(Number((next === 'lb' ? kg * 2.2046226218 : kg).toFixed(2))) : ''); setWeightUnit(next) }}><option value="kg">kg</option><option value="lb">lb</option></select></label>
        <label>Unitatea înălțimii<select value={heightUnit} onChange={e => { const next = e.target.value as 'cm' | 'ft'; const cm = heightUnit === 'ft' ? Number(height) * 30.48 : Number(height); setHeight(Number.isFinite(cm) && cm > 0 ? String(Number((next === 'ft' ? cm / 30.48 : cm).toFixed(2))) : ''); setHeightUnit(next) }}><option value="cm">cm</option><option value="ft">ft (zecimal)</option></select></label>
        <label>Nivel de activitate<select value={activity} onChange={e => setActivity(e.target.value as Activity)}><option value="sedentary">Sedentar</option><option value="light">Ușor activ</option><option value="moderate">Moderat</option><option value="high">Activ</option><option value="very_high">Foarte activ</option></select></label>
        <label>Ritmul preferat<select value={pace} onChange={e => setPace(e.target.value as Pace)}><option value="gentle">Blând</option><option value="steady">Moderat</option><option value="ambitious">Susținut</option></select></label>
      </div>
      <p className="goal-note">Înălțimea și greutatea sunt obligatorii pentru calcul. Conversiile folosesc factori exacți și se păstrează în baza de date în cm și kg. Estimările sunt orientative, nu recomandări medicale.</p>
      {suggestedCalories !== null && <div className="goal-suggestions"><div><span>Calorii propuse</span><strong>{suggestedCalories.toLocaleString('ro-RO')} kcal/zi</strong></div><div><span>Apă propusă</span><strong>{suggestedWater?.toLocaleString('ro-RO')} ml/zi</strong></div></div>}
      <div className="goal-actions">
        {onboarding && <button type="button" className="text-button" disabled={busy} onClick={() => void skipOnboarding()}>Amână configurarea</button>}
        <button type="button" className="full-button" disabled={busy || !profileValid} onClick={() => void saveProfile()}>Salvează profilul și continuă</button>
      </div>
    </> : <>
      <div className="goal-steps"><span>1 · Profil</span><span className="active">2 · Ținte zilnice</span></div>
      <div className="target-scope"><span>Aplică pentru</span><button type="button" className={dayType === 'all' ? 'selected' : ''} onClick={() => setDayType('all')}>Toate zilele</button><button type="button" className={dayType === 'weekday' ? 'selected' : ''} onClick={() => setDayType('weekday')}>Zile lucrătoare</button><button type="button" className={dayType === 'weekend' ? 'selected' : ''} onClick={() => setDayType('weekend')}>Weekend</button></div>
      <div className="target-editor">{keys.map(key => <div className="target-row" key={key}><label><input type="checkbox" checked={enabled[key]} onChange={e => setEnabled(v => ({ ...v, [key]: e.target.checked }))} /><span>{labels[key]}</span></label><input aria-label={labels[key]} type="number" min="0" step={key === 'sleep' ? 0.5 : 1} value={values[key] || ''} placeholder="Configurează valoarea" disabled={!enabled[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value === '' ? 0 : Number(e.target.value) }))} /></div>)}</div>
      <p className="goal-note">Alege țintele pe care dorești să le urmărești. Valorile goale nu sunt salvate; țintele se aplică pentru ziua aleasă înainte și nu rescriu istoricul.</p>
      <div className="goal-actions">{onboarding && <button type="button" className="text-button" disabled={busy} onClick={() => void skipOnboarding()}>Amână configurarea</button>}<button type="button" className="text-button" onClick={() => setStep(1)}>Înapoi la profil</button><button type="button" className="full-button" disabled={busy} onClick={() => void saveTargets()}>Salvează țintele</button></div>
    </>}
    {message && <p className="calorie-message" role="status">{message}</p>}
  </section>
}
