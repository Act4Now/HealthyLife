import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Goal = 'lose' | 'maintain' | 'gain'
type Activity = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high'
type Pace = 'gentle' | 'steady' | 'ambitious'
type TargetKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'water' | 'steps' | 'sleep'
type TargetValues = Record<TargetKey, number>
type Enabled = Record<TargetKey, boolean>

const defaults: TargetValues = { calories: 2000, protein: 100, carbs: 250, fat: 70, water: 2000, steps: 8000, sleep: 8 }
const labels: Record<TargetKey, string> = { calories: 'Calorii (kcal)', protein: 'Proteine (g)', carbs: 'Carbohidrați (g)', fat: 'Grăsimi (g)', water: 'Apă (ml)', steps: 'Pași', sleep: 'Somn (ore)' }
const keys: TargetKey[] = ['calories','protein','carbs','fat','water','steps','sleep']

export default function PersonalGoals({ userId }: { userId?: string }) {
  const [step,setStep] = useState(1)
  const [goal,setGoal] = useState<Goal>('maintain')
  const [height,setHeight] = useState('170')
  const [weight,setWeight] = useState('70')
  const [activity,setActivity] = useState<Activity>('moderate')
  const [pace,setPace] = useState<Pace>('steady')
  const [weightUnit,setWeightUnit] = useState<'kg'|'lb'>('kg')
  const [heightUnit,setHeightUnit] = useState<'cm'|'ft'>('cm')
  const [values,setValues] = useState<TargetValues>(defaults)
  const [enabled,setEnabled] = useState<Enabled>({calories:true,protein:true,carbs:true,fat:true,water:true,steps:false,sleep:false})
  const [weekend,setWeekend] = useState(false)
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const [loaded,setLoaded] = useState(false)

  useEffect(() => {
    if (!supabase || !userId) { setLoaded(true); return }
    let live = true
    Promise.all([
      supabase.from('profiles').select('height_cm,current_weight_kg,weight_goal,activity_level,goal_pace,preferred_weight_unit,preferred_height_unit,onboarding_completed_at').eq('id',userId).maybeSingle(),
      supabase.from('daily_targets').select('*').lte('target_date',new Date().toISOString().slice(0,10)).order('target_date',{ascending:false}).limit(1).maybeSingle()
    ]).then(([p,t]) => {
      if (!live) return
      if (p.data) {
        setHeight(String(p.data.height_cm ?? 170)); setWeight(String(p.data.current_weight_kg ?? 70))
        if (p.data.weight_goal) setGoal(p.data.weight_goal)
        if (p.data.activity_level) setActivity(p.data.activity_level)
        if (p.data.goal_pace) setPace(p.data.goal_pace)
        if (p.data.preferred_weight_unit) setWeightUnit(p.data.preferred_weight_unit)
        if (p.data.preferred_height_unit) setHeightUnit(p.data.preferred_height_unit)
      }
      if (t.data) {
        const d=t.data
        setValues({calories:d.calories_kcal ?? defaults.calories,protein:d.protein_g ?? defaults.protein,carbs:d.carbs_g ?? defaults.carbs,fat:d.fat_g ?? defaults.fat,water:d.water_ml ?? defaults.water,steps:d.steps ?? defaults.steps,sleep:d.sleep_hours ?? defaults.sleep})
        setEnabled({...defaultsEnabled,...(d.enabled ?? {})})
        setWeekend(d.day_type==='weekend')
      }
      setLoaded(true)
    }).catch(e=>{if(live){setMessage(e instanceof Error?e.message:'Nu am putut încărca obiectivele.');setLoaded(true)}})
    return ()=>{live=false}
  },[userId])

  const defaultsEnabled: Enabled = {calories:true,protein:true,carbs:true,fat:true,water:true,steps:false,sleep:false}
  const heightCm = heightUnit==='ft' ? Number(height)*30.48 : Number(height)
  const weightKg = weightUnit==='lb' ? Number(weight)/2.20462 : Number(weight)
  const activityFactor: Record<Activity,number> = {sedentary:26,light:28,moderate:30,high:33,very_high:36}
  const goalFactor = goal==='lose' ? (pace==='gentle' ? -250 : pace==='steady' ? -400 : -500) : goal==='gain' ? (pace==='gentle' ? 150 : pace==='steady' ? 250 : 350) : 0
  const suggestedCalories = Math.max(1200,Math.round(weightKg*(activityFactor[activity])+goalFactor))
  const suggestedWater = Math.round(Math.max(1500,Math.min(4500,weightKg*35))/50)*50

  async function saveSetup() {
    if(!supabase||!userId){setMessage('Autentifică-te pentru a salva profilul și obiectivele.');return}
    if(!(heightCm>=100&&heightCm<=250&&weightKg>=25&&weightKg<=350)){setMessage('Verifică înălțimea și greutatea introduse.');return}
    setBusy(true);setMessage('')
    const profile={id:userId,height_cm:heightCm,current_weight_kg:weightKg,weight_goal:goal,activity_level:activity,goal_pace:pace,preferred_weight_unit:weightUnit,preferred_height_unit:heightUnit,onboarding_completed_at:new Date().toISOString()}
    const {error:profileError}=await supabase.from('profiles').upsert(profile,{onConflict:'id'})
    if(profileError){setMessage(profileError.message);setBusy(false);return}
    await saveTargets({...values,calories:suggestedCalories,water:suggestedWater})
    setBusy(false);setStep(2)
  }

  async function saveTargets(targetValues: TargetValues = values) {
    if(!supabase||!userId){setMessage('Autentifică-te pentru a salva obiectivele.');return}
    setBusy(true)
    const enabledKeys=Object.fromEntries(keys.map(k=>[k,enabled[k]]))
    const row={user_id:userId,target_date:new Date().toISOString().slice(0,10),day_type:weekend?'weekend':'all',calories_kcal:targetValues.calories,protein_g:targetValues.protein,carbs_g:targetValues.carbs,fat_g:targetValues.fat,water_ml:targetValues.water,steps:targetValues.steps,sleep_hours:targetValues.sleep,enabled:enabledKeys}
    const {error}=await supabase.from('daily_targets').insert(row)
    setMessage(error?'Eroare la salvarea obiectivelor: '+error.message:'Obiectivele au fost salvate începând de astăzi. Înregistrările istorice au rămas neschimbate.')
    setBusy(false)
  }

  if(!userId)return <section className="panel personal-goals"><h3>Obiective personalizate</h3><p>Autentifică-te pentru configurarea și sincronizarea obiectivelor personale.</p></section>
  if(!loaded)return <section className="panel personal-goals"><p>Se încarcă profilul și obiectivele…</p></section>

  return <section className="panel personal-goals">
    <div className="panel-heading"><div><h3>Profil și obiective personale</h3><p>Configurare scurtă, editabilă oricând</p></div><span>Pas {step} din 2</span></div>
    {step===1 ? <>
      <div className="goal-steps"><span className="active">1 · Profil</span><span>2 · Ținte zilnice</span></div>
      <div className="goal-grid">
        <label>Obiectiv
          <select value={goal} onChange={e=>setGoal(e.target.value as Goal)}><option value="lose">Slăbire</option><option value="maintain">Menținere</option><option value="gain">Creștere în greutate</option></select>
        </label>
        <label>Înălțime ({heightUnit})<input type="number" min="1" step="0.1" value={height} onChange={e=>setHeight(e.target.value)}/></label>
        <label>Greutate actuală ({weightUnit})<input type="number" min="1" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
        <label>Unitatea greutății<select value={weightUnit} onChange={e=>setWeightUnit(e.target.value as 'kg'|'lb')}><option value="kg">kg</option><option value="lb">lb</option></select></label>
        <label>Unitatea înălțimii<select value={heightUnit} onChange={e=>setHeightUnit(e.target.value as 'cm'|'ft')}><option value="cm">cm</option><option value="ft">ft (valoare zecimală)</option></select></label>
        <label>Nivel de activitate<select value={activity} onChange={e=>setActivity(e.target.value as Activity)}><option value="sedentary">Sedentar</option><option value="light">Ușor activ</option><option value="moderate">Moderat</option><option value="high">Activ</option><option value="very_high">Foarte activ</option></select></label>
        <label>Ritmul preferat<select value={pace} onChange={e=>setPace(e.target.value as Pace)}><option value="gentle">Blând</option><option value="steady">Moderat</option><option value="ambitious">Susținut</option></select></label>
      </div>
      <p className="goal-note">Estimare orientativă, nu recomandare medicală. Formula simplificată nu include vârsta sau alți factori individuali; verifică și modifică valorile înainte de confirmare.</p>
      <div className="goal-suggestions"><div><span>Calorii sugerate</span><strong>{suggestedCalories.toLocaleString('ro-RO')} kcal/zi</strong></div><div><span>Apă sugerată</span><strong>{suggestedWater.toLocaleString('ro-RO')} ml/zi</strong></div></div>
      <div className="goal-actions"><button type="button" className="text-button" onClick={()=>{setMessage('Poți reveni la configurare oricând din Setări.');setStep(2)}}>Sari peste configurare</button><button type="button" className="full-button" disabled={busy} onClick={()=>{setValues(v=>({...v,calories:suggestedCalories,water:suggestedWater}));void saveSetup()}}>Salvează profilul și continuă</button></div>
    </> : <>
      <div className="goal-steps"><span>1 · Profil</span><span className="active">2 · Ținte zilnice</span></div>
      <div className="target-scope"><span>Aplică pentru</span><button type="button" className={!weekend?'selected':''} onClick={()=>setWeekend(false)}>Toate zilele</button><button type="button" className={weekend?'selected':''} onClick={()=>setWeekend(true)}>Weekend</button></div>
      <div className="target-editor">{keys.map(key=><div className="target-row" key={key}><label><input type="checkbox" checked={enabled[key]} onChange={e=>setEnabled(v=>({...v,[key]:e.target.checked}))}/><span>{labels[key]}</span></label><input aria-label={labels[key]} type="number" min="0" step={key==='sleep'?0.5:1} value={values[key]} disabled={!enabled[key]} onChange={e=>setValues(v=>({...v,[key]:Number(e.target.value)}))}/></div>)}</div>
      <p className="goal-note">Dezactivează țintele pe care nu dorești să le urmărești. Modificările se aplică de astăzi înainte; datele anterioare nu sunt rescrise.</p>
      <div className="goal-actions"><button type="button" className="text-button" onClick={()=>setStep(1)}>Înapoi la profil</button><button type="button" className="full-button" disabled={busy} onClick={()=>void saveTargets()}>Salvează țintele</button></div>
    </>}
    {message&&<p className="calorie-message" role="status">{message}</p>}
  </section>
}
