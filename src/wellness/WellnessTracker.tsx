import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, Plus, Trash2, Droplets, Pill, Weight, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Module = 'hydration' | 'medication' | 'weight'
type WaterLog = { id: string; amount_ml: number; logged_at: string }
type Medication = { id: string; name: string; dose: string; schedule: string; notes: string }
type MedicationLog = { id: string; medication_id: string; taken_at: string; status: string }
type WeightLog = { id: string; weight_kg: number; measured_at: string; notes: string }

const today = () => new Date().toISOString().slice(0, 10)
const localDateTime = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export default function WellnessTracker({ module, userId }: { module: Module; userId?: string }) {
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([])
  const [waterGoal, setWaterGoal] = useState(2000)
  const [medications, setMedications] = useState<Medication[]>([])
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [newWater, setNewWater] = useState(250)
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medSchedule, setMedSchedule] = useState('08:00')
  const [weightValue, setWeightValue] = useState('')
  const [weightDate, setWeightDate] = useState(today())
  const [weightNotes, setWeightNotes] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return }
    setLoading(true); setMessage('')
    const [w, g, m, ml, wt, goals] = await Promise.all([
      supabase.from('hydration_logs').select('id,amount_ml,logged_at').order('logged_at', { ascending: false }).limit(100),
      supabase.from('wellness_goals').select('hydration_goal_ml,weight_goal_kg').maybeSingle(),
      supabase.from('medications').select('id,name,dose,schedule,notes').eq('active', true).order('created_at'),
      supabase.from('medication_logs').select('id,medication_id,taken_at,status').order('taken_at', { ascending: false }).limit(100),
      supabase.from('weight_logs').select('id,weight_kg,measured_at,notes').order('measured_at', { ascending: true }).limit(100),
    ])
    const errors = [w.error, g.error, m.error, ml.error, wt.error].filter(Boolean)
    if (errors.length) setMessage(errors[0]?.message ?? 'Nu s-au putut încărca datele.')
    setWaterLogs((w.data ?? []) as WaterLog[])
    setWaterGoal(g.data?.hydration_goal_ml ?? 2000)
    setMedications((m.data ?? []) as Medication[])
    setMedLogs((ml.data ?? []) as MedicationLog[])
    setWeightLogs((wt.data ?? []) as WeightLog[])
    if (g.data?.weight_goal_kg) setGoalWeight(String(g.data.weight_goal_kg))
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load])

  const waterToday = waterLogs.filter(x => x.logged_at.slice(0, 10) === today()).reduce((s, x) => s + x.amount_ml, 0)
  const latestWeight = weightLogs.at(-1)
  const title = module === 'hydration' ? 'Hidratare' : module === 'medication' ? 'Medicamente' : 'Greutate'

  async function saveWater(amount = newWater) {
    if (!supabase || !userId) return setMessage('Autentifică-te pentru a salva înregistrările.')
    if (!Number.isFinite(amount) || amount < 1 || amount > 5000) return setMessage('Introdu o cantitate între 1 și 5.000 ml.')
    setBusy(true); setMessage('')
    const { error } = await supabase.from('hydration_logs').insert({ user_id: userId, amount_ml: Math.round(amount) })
    if (error) setMessage(error.message); else { setNewWater(250); await load(); setMessage('Cantitatea de apă a fost salvată.') }
    setBusy(false)
  }

  async function saveWaterGoal() {
    if (!supabase || !userId) return
    setBusy(true)
    const { error } = await supabase.from('wellness_goals').upsert({ user_id: userId, hydration_goal_ml: waterGoal }, { onConflict: 'user_id' })
    setMessage(error?.message ?? 'Obiectivul de hidratare a fost actualizat.'); setBusy(false)
  }

  async function addMedication(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !userId) return setMessage('Autentifică-te pentru a salva medicamentele.')
    if (!medName.trim() || !medDose.trim()) return setMessage('Completează numele și doza.')
    setBusy(true)
    const { error } = await supabase.from('medications').insert({ user_id: userId, name: medName.trim(), dose: medDose.trim(), schedule: medSchedule })
    if (error) setMessage(error.message); else { setMedName(''); setMedDose(''); await load(); setMessage('Medicament adăugat.') }
    setBusy(false)
  }

  async function recordMedication(id: string, status: 'taken' | 'skipped') {
    if (!supabase || !userId) return
    setBusy(true)
    const { error } = await supabase.from('medication_logs').insert({ user_id: userId, medication_id: id, status })
    setMessage(error?.message ?? (status === 'taken' ? 'Administrare confirmată.' : 'Doza a fost marcată ca omisă.'))
    await load(); setBusy(false)
  }

  async function deleteMedication(id: string) {
    if (!supabase || !userId) return
    setBusy(true)
    const { error } = await supabase.from('medications').update({ active: false }).eq('id', id)
    setMessage(error?.message ?? 'Medicament arhivat.'); await load(); setBusy(false)
  }

  async function saveWeight(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(weightValue)
    if (!supabase || !userId) return setMessage('Autentifică-te pentru a salva greutatea.')
    if (!Number.isFinite(value) || value < 20 || value > 500) return setMessage('Introdu o greutate validă între 20 și 500 kg.')
    setBusy(true)
    const { error } = await supabase.from('weight_logs').insert({ user_id: userId, weight_kg: value, measured_at: new Date(weightDate + 'T12:00:00').toISOString(), notes: weightNotes.trim() })
    if (error) setMessage(error.message); else { setWeightValue(''); setWeightNotes(''); await load(); setMessage('Greutatea a fost înregistrată.') }
    setBusy(false)
  }

  async function saveWeightGoal() {
    if (!supabase || !userId) return
    const value = goalWeight ? Number(goalWeight) : null
    if (value !== null && (!Number.isFinite(value) || value < 20 || value > 500)) return setMessage('Obiectivul trebuie să fie între 20 și 500 kg.')
    setBusy(true)
    const { error } = await supabase.from('wellness_goals').upsert({ user_id: userId, weight_goal_kg: value }, { onConflict: 'user_id' })
    setMessage(error?.message ?? 'Obiectivul de greutate a fost salvat.'); setBusy(false)
  }

  const chart = useMemo(() => {
    if (weightLogs.length < 2) return null
    const values = weightLogs.slice(-12)
    const min = Math.min(...values.map(x => x.weight_kg)) - 1
    const max = Math.max(...values.map(x => x.weight_kg)) + 1
    const points = values.map((x, i) => `${values.length === 1 ? 50 : 8 + i * 84 / (values.length - 1)},${92 - (x.weight_kg - min) / (max - min || 1) * 76}`).join(' ')
    return { points, values }
  }, [weightLogs])

  if (!userId) return <section className="panel placeholder-panel"><h3>{title}</h3><p>Autentificarea Supabase este necesară pentru salvarea datelor personale.</p></section>
  if (loading) return <section className="panel placeholder-panel"><p>Se încarcă datele…</p></section>

  return <div className="wellness-layout">
    {module === 'hydration' && <section className="panel wellness-panel">
      <div className="panel-heading"><div><h3><Droplets size={19} /> Hidratare zilnică</h3><p>Înregistrează apa consumată și urmărește obiectivul zilnic</p></div></div>
      <div className="wellness-total"><strong>{waterToday.toLocaleString('ro-RO')}</strong><span> / {waterGoal.toLocaleString('ro-RO')} ml</span></div>
      <div className="wellness-progress"><span style={{ width: Math.min(100, waterToday / Math.max(1, waterGoal) * 100) + '%' }} /></div>
      <p>{Math.max(0, waterGoal - waterToday).toLocaleString('ro-RO')} ml până la obiectiv · {Math.round(waterToday / Math.max(1, waterGoal) * 100)}%</p>
      <div className="wellness-actions">{[150, 250, 500].map(n => <button key={n} disabled={busy} onClick={() => void saveWater(n)}>+{n} ml</button>)}</div>
      <div className="wellness-inline"><label>Cantitate personalizată (ml)<input type="number" min="1" max="5000" value={newWater} onChange={e => setNewWater(Number(e.target.value))} /></label><button disabled={busy} onClick={() => void saveWater()}><Plus size={16}/> Adaugă apă</button></div>
      <div className="wellness-inline"><label>Obiectiv zilnic (ml)<input type="number" min="250" max="10000" value={waterGoal} onChange={e => setWaterGoal(Number(e.target.value))}/></label><button disabled={busy} onClick={() => void saveWaterGoal()}><Save size={16}/> Salvează obiectivul</button></div>
      <h4>Înregistrări recente</h4>
      {waterLogs.slice(0, 15).map(x => <div className="wellness-row" key={x.id}><span>{new Date(x.logged_at).toLocaleString('ro-RO')}</span><strong>{x.amount_ml} ml</strong></div>)}
      {!waterLogs.length && <p>Nu există încă înregistrări.</p>}
    </section>}

    {module === 'medication' && <><section className="panel wellness-panel">
      <div className="panel-heading"><div><h3><Pill size={19}/> Medicamentele mele</h3><p>Gestionează lista și programul introdus de tine</p></div></div>
      <form className="wellness-form" onSubmit={addMedication}><label>Denumire<input value={medName} onChange={e => setMedName(e.target.value)} placeholder="Numele medicamentului" required/></label><label>Doză<input value={medDose} onChange={e => setMedDose(e.target.value)} placeholder="Ex.: 1 comprimat" required/></label><label>Ora programată<input type="time" value={medSchedule} onChange={e => setMedSchedule(e.target.value)}/></label><button disabled={busy}><Plus size={16}/> Adaugă medicament</button></form>
      <p className="calorie-disclaimer">Introdu doar schema indicată de medic sau farmacist. Aplicația nu recomandă doze și nu înlocuiește sfatul medical.</p>
      <h4>Program activ</h4>
      {medications.map(m => { const last = medLogs.find(x => x.medication_id === m.id && x.taken_at.slice(0,10) === today()); return <div className="wellness-med" key={m.id}><div><strong>{m.name}</strong><span>{m.dose} · {m.schedule}</span>{last && <small>Astăzi: {last.status === 'taken' ? 'administrat' : 'omis'}</small>}</div><div className="wellness-actions"><button disabled={busy || !!last} onClick={() => void recordMedication(m.id, 'taken')}>Administrat</button><button disabled={busy || !!last} onClick={() => void recordMedication(m.id, 'skipped')}>Omis</button><button className="danger-button" disabled={busy} onClick={() => void deleteMedication(m.id)} aria-label="Arhivează"><Trash2 size={15}/></button></div></div>})}
      {!medications.length && <p>Nu ai adăugat medicamente.</p>}
    </section><section className="panel wellness-panel"><h3>Istoric administrări</h3>{medLogs.slice(0,20).map(x => <div className="wellness-row" key={x.id}><span>{new Date(x.taken_at).toLocaleString('ro-RO')}</span><strong>{medications.find(m => m.id === x.medication_id)?.name ?? 'Medicament'} · {x.status === 'taken' ? 'Administrat' : 'Omis'}</strong></div>)}{!medLogs.length && <p>Nu există administrări înregistrate.</p>}</section></>}

    {module === 'weight' && <><section className="panel wellness-panel">
      <div className="panel-heading"><div><h3><Weight size={19}/> Monitorizarea greutății</h3><p>Înregistrează măsurători și urmărește evoluția</p></div></div>
      <div className="wellness-total"><strong>{latestWeight ? latestWeight.weight_kg.toLocaleString('ro-RO') : '—'}</strong><span> kg · ultima măsurătoare</span></div>
      <form className="wellness-form" onSubmit={saveWeight}><label>Greutate (kg)<input type="number" step="0.1" min="20" max="500" value={weightValue} onChange={e => setWeightValue(e.target.value)} placeholder="Ex.: 74.5" required/></label><label>Data măsurătorii<input type="date" value={weightDate} max={today()} onChange={e => setWeightDate(e.target.value)}/></label><label>Note (opțional)<input value={weightNotes} onChange={e => setWeightNotes(e.target.value)} placeholder="Observații"/></label><button disabled={busy}><Plus size={16}/> Salvează măsurătoarea</button></form>
      <div className="wellness-inline"><label>Obiectiv (kg)<input type="number" step="0.1" min="20" max="500" value={goalWeight} onChange={e => setGoalWeight(e.target.value)} placeholder="Opțional"/></label><button disabled={busy} onClick={() => void saveWeightGoal()}><Save size={16}/> Salvează obiectiv</button></div>
    </section><section className="panel wellness-panel"><h3><Activity size={19}/> Evoluția greutății</h3>{chart ? <><svg viewBox="0 0 100 100" role="img" aria-label="Grafic evoluție greutate" className="weight-chart"><polyline points={chart.points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>{chart.points.split(' ').map((p,i) => { const [x,y] = p.split(','); return <circle key={i} cx={x} cy={y} r="1.8" fill="currentColor"/> })}</svg><div className="wellness-row"><span>Prima din selecție: {chart.values[0].weight_kg} kg</span><strong>Ultima: {chart.values.at(-1)?.weight_kg} kg</strong></div></> : <p>Adaugă cel puțin două măsurători pentru a vedea graficul.</p>}<h4>Istoric măsurători</h4>{[...weightLogs].reverse().slice(0,30).map(x => <div className="wellness-row" key={x.id}><span>{new Date(x.measured_at).toLocaleDateString('ro-RO')} {x.notes ? '· '+x.notes : ''}</span><strong>{x.weight_kg} kg</strong></div>)}</section></>}
    {message && <p className="calorie-message" role="status">{message}</p>}
  </div>
}
