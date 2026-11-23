import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Droplets, Flame, Plus, Scale, Utensils } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Language = 'ro' | 'en'
type Props = {
  userId?: string
  language: Language
  widgets?: string[]
  weightUnit?: 'kg' | 'lb'
  onNavigate: (id: string) => void
}
type Targets = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; water: number | null }
type Summary = {
  kcal: number
  protein: number
  carbs: number
  fat: number
  meals: number
  waterMl: number
  targets: Targets
  waterGoal: number | null
  latestWeightKg: number | null
  latestWeightAt: string | null
  goalWeightKg: number | null
  goalDate: string | null
  reminder: string
}

const DEFAULT_WIDGETS = ['targets', 'meals', 'water', 'weight']
const KNOWN_WIDGETS = ['targets', 'meals', 'water', 'weight']
const KG_TO_LB = 2.2046226218
const REMINDER_DAYS: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }

const text = {
  ro: {
    loading: 'Se încarcă rezumatul…',
    signIn: 'Autentifică-te pentru a vedea rezumatul zilei.',
    calories: 'Calorii', of: 'din', left: 'rămase', over: 'peste țintă', noTarget: 'Fără țintă setată',
    setTargets: 'Setează ținte', macros: 'Macronutrienți', protein: 'Proteine', carbs: 'Carbohidrați', fat: 'Grăsimi',
    meals: 'Mese', mealsToday: 'mese înregistrate astăzi', noMeals: 'Nicio masă înregistrată astăzi.', addMeal: 'Adaugă masă',
    water: 'Apă', addWater: 'Adaugă', glass: 'ml',
    weight: 'Greutate', latest: 'Ultima măsurătoare', goal: 'Obiectiv', noWeight: 'Nicio măsurătoare încă.', addWeight: 'Adaugă greutatea',
    weighIn: 'Este momentul pentru o nouă cântărire.', saved: 'Apă adăugată.', error: 'Nu am putut încărca rezumatul: ',
    approx: 'Valorile reflectă doar ce ai înregistrat astăzi.',
  },
  en: {
    loading: 'Loading your overview…',
    signIn: 'Sign in to see your daily overview.',
    calories: 'Calories', of: 'of', left: 'left', over: 'over target', noTarget: 'No target set',
    setTargets: 'Set targets', macros: 'Macros', protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
    meals: 'Meals', mealsToday: 'meals logged today', noMeals: 'No meals logged today.', addMeal: 'Add a meal',
    water: 'Water', addWater: 'Add', glass: 'ml',
    weight: 'Weight', latest: 'Latest measurement', goal: 'Goal', noWeight: 'No measurements yet.', addWeight: 'Add weight',
    weighIn: 'Time for a new weigh-in.', saved: 'Water added.', error: 'Could not load the overview: ',
    approx: 'Values reflect only what you logged today.',
  },
}

function localDate(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const pct = (value: number, goal: number | null) => (goal && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0)
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value))
const fmt = (value: number, language: Language) => Math.round(value).toLocaleString(language === 'ro' ? 'ro-RO' : 'en-GB')

export default function TodayOverview({ userId, language, widgets, weightUnit = 'kg', onNavigate }: Props) {
  const t = text[language]
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return }
    const client = supabase
    const todayKey = localDate()
    const start = new Date(`${todayKey}T00:00:00`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const day = new Date(`${todayKey}T12:00:00`).getDay()
    const kind = day === 0 || day === 6 ? 'weekend' : 'weekday'
    const [targetsRes, mealsRes, waterRes, weightRes, goalsRes] = await Promise.all([
      client.from('daily_targets').select('day_type,calories_kcal,protein_g,carbs_g,fat_g,water_ml,target_date,created_at')
        .eq('user_id', userId).lte('target_date', todayKey).in('day_type', ['all', kind])
        .order('target_date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('meal_logs').select('calories_kcal,protein_g,carbohydrates_g,fat_g')
        .eq('user_id', userId).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
      client.from('hydration_logs').select('amount_ml')
        .eq('user_id', userId).gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString()),
      client.from('weight_logs').select('weight_kg,measured_at').eq('user_id', userId).order('measured_at', { ascending: false }).limit(1),
      client.from('wellness_goals').select('hydration_goal_ml,weight_goal_kg,weight_goal_date,weigh_in_reminder').eq('user_id', userId).maybeSingle(),
    ])
    const failed = [targetsRes.error, mealsRes.error, waterRes.error, weightRes.error, goalsRes.error].find(Boolean)
    if (failed) { setMessage(t.error + failed.message); setLoading(false); return }
    const rows = (targetsRes.data ?? []) as Record<string, unknown>[]
    const selected = rows.find(row => row.day_type === kind) ?? rows.find(row => row.day_type === 'all')
    const meals = (mealsRes.data ?? []) as Record<string, unknown>[]
    const water = (waterRes.data ?? []) as Record<string, unknown>[]
    const latestWeight = ((weightRes.data ?? []) as Record<string, unknown>[])[0]
    const goals = goalsRes.data as Record<string, unknown> | null
    const targets: Targets = {
      calories: num(selected?.calories_kcal), protein: num(selected?.protein_g), carbs: num(selected?.carbs_g),
      fat: num(selected?.fat_g), water: num(selected?.water_ml),
    }
    setSummary({
      kcal: meals.reduce((sum, row) => sum + Number(row.calories_kcal ?? 0), 0),
      protein: meals.reduce((sum, row) => sum + Number(row.protein_g ?? 0), 0),
      carbs: meals.reduce((sum, row) => sum + Number(row.carbohydrates_g ?? 0), 0),
      fat: meals.reduce((sum, row) => sum + Number(row.fat_g ?? 0), 0),
      meals: meals.length,
      waterMl: water.reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0),
      targets,
      waterGoal: num(goals?.hydration_goal_ml) ?? targets.water,
      latestWeightKg: num(latestWeight?.weight_kg),
      latestWeightAt: (latestWeight?.measured_at as string | undefined) ?? null,
      goalWeightKg: num(goals?.weight_goal_kg),
      goalDate: (goals?.weight_goal_date as string | null | undefined) ?? null,
      reminder: String(goals?.weigh_in_reminder ?? 'off'),
    })
    setMessage('')
    setLoading(false)
  }, [userId, t.error])

  useEffect(() => { void load() }, [load])

  async function addWater(amount: number) {
    if (!supabase || !userId) return
    setBusy(true)
    const { error } = await supabase.from('hydration_logs').insert({ user_id: userId, amount_ml: amount })
    setBusy(false)
    if (error) { setMessage(error.message); return }
    setMessage(t.saved)
    await load()
  }

  if (!userId) return <section className="panel overview-empty"><p>{t.signIn}</p></section>
  if (loading) return <section className="panel overview-empty"><p>{t.loading}</p></section>
  if (!summary) return <section className="panel overview-empty">{message && <p role="status">{message}</p>}</section>

  const order = (widgets && widgets.length ? widgets : DEFAULT_WIDGETS).filter(key => KNOWN_WIDGETS.includes(key))
  const toDisplayWeight = (kg: number) => (weightUnit === 'lb' ? kg * KG_TO_LB : kg)
  const calorieTarget = summary.targets.calories
  const remaining = calorieTarget ? Math.round(calorieTarget - summary.kcal) : null
  const daysSinceWeight = summary.latestWeightAt ? Math.floor((Date.now() - new Date(summary.latestWeightAt).getTime()) / 86400000) : null
  const interval = REMINDER_DAYS[summary.reminder]
  const weighInDue = interval !== undefined && (daysSinceWeight === null || daysSinceWeight >= interval)

  const macro = (label: string, value: number, target: number | null) => (
    <div className="overview-macro" key={label}>
      <span>{label}</span>
      <strong>{value.toFixed(0)} g{target ? ` / ${Math.round(target)} g` : ''}</strong>
      {target ? <i><b style={{ width: pct(value, target) + '%' }} /></i> : null}
    </div>
  )

  const cards: Record<string, ReactElement> = {
    targets: <article className="panel overview-card" key="targets">
      <div className="panel-heading"><div><h3><Flame size={17} /> {t.calories}</h3></div></div>
      <div className="wellness-total"><strong>{fmt(summary.kcal, language)}</strong><span>{calorieTarget ? ` ${t.of} ${fmt(calorieTarget, language)} kcal` : ' kcal'}</span></div>
      {calorieTarget ? <>
        <div className="wellness-progress"><span style={{ width: pct(summary.kcal, calorieTarget) + '%' }} /></div>
        <p className="overview-note">{remaining !== null && remaining >= 0 ? `${fmt(remaining, language)} kcal ${t.left}` : `${fmt(Math.abs(remaining ?? 0), language)} kcal ${t.over}`}</p>
      </> : <p className="overview-note">{t.noTarget} · <button type="button" className="text-button" onClick={() => onNavigate('settings')}>{t.setTargets}</button></p>}
      {(summary.targets.protein || summary.targets.carbs || summary.targets.fat) ? <div className="overview-macros">
        {summary.targets.protein ? macro(t.protein, summary.protein, summary.targets.protein) : null}
        {summary.targets.carbs ? macro(t.carbs, summary.carbs, summary.targets.carbs) : null}
        {summary.targets.fat ? macro(t.fat, summary.fat, summary.targets.fat) : null}
      </div> : null}
    </article>,
    meals: <article className="panel overview-card" key="meals">
      <div className="panel-heading"><div><h3><Utensils size={17} /> {t.meals}</h3></div></div>
      <div className="wellness-total"><strong>{summary.meals}</strong><span> {t.mealsToday}</span></div>
      {summary.meals === 0 && <p className="overview-note">{t.noMeals}</p>}
      <div className="wellness-actions"><button type="button" onClick={() => onNavigate('meals')}><Plus size={15} /> {t.addMeal}</button></div>
    </article>,
    water: <article className="panel overview-card" key="water">
      <div className="panel-heading"><div><h3><Droplets size={17} /> {t.water}</h3></div></div>
      <div className="wellness-total"><strong>{fmt(summary.waterMl, language)}</strong><span>{summary.waterGoal ? ` ${t.of} ${fmt(summary.waterGoal, language)} ml` : ' ml'}</span></div>
      {summary.waterGoal ? <div className="wellness-progress"><span style={{ width: pct(summary.waterMl, summary.waterGoal) + '%' }} /></div> : null}
      <div className="wellness-actions">{[150, 250, 500].map(n => <button type="button" key={n} disabled={busy} onClick={() => void addWater(n)}>+{n} {t.glass}</button>)}</div>
    </article>,
    weight: <article className="panel overview-card" key="weight">
      <div className="panel-heading"><div><h3><Scale size={17} /> {t.weight}</h3></div></div>
      {summary.latestWeightKg !== null
        ? <div className="wellness-total"><strong>{toDisplayWeight(summary.latestWeightKg).toFixed(1)}</strong><span> {weightUnit} · {t.latest}</span></div>
        : <p className="overview-note">{t.noWeight}</p>}
      {summary.goalWeightKg !== null && <p className="overview-note">{t.goal}: {toDisplayWeight(summary.goalWeightKg).toFixed(1)} {weightUnit}{summary.goalDate ? ` · ${summary.goalDate}` : ''}</p>}
      {weighInDue && <p className="overview-reminder" role="status">{t.weighIn}</p>}
      <div className="wellness-actions"><button type="button" onClick={() => onNavigate('weight')}><Plus size={15} /> {t.addWeight}</button></div>
    </article>,
  }

  return <section aria-label={language === 'ro' ? 'Rezumatul zilei' : "Today's overview"}>
    <div className="overview-grid">{order.map(key => cards[key])}</div>
    {message && <p className="calorie-message" role="status">{message}</p>}
    <p className="overview-footnote">{t.approx}</p>
  </section>
}
