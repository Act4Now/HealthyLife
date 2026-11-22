import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Entry = { id: string; category: string; label: string; detail: string; at: string }

const toDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const shiftDate = (value: string, amount: number) => { const d = new Date(value + 'T12:00:00'); d.setDate(d.getDate()+amount); return toDate(d) }

export default function HistoryTracker({ userId }: { userId?: string }) {
  const [date, setDate] = useState(toDate(new Date()))
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !userId) { setEntries([]); return }
    setLoading(true); setMessage('')
    const start = new Date(date + 'T00:00:00')
    const end = new Date(date + 'T00:00:00')
    end.setDate(end.getDate()+1)
    const from = start.toISOString()
    const until = end.toISOString()
    const [meals, water, meds, weights] = await Promise.all([
      supabase.from('meal_logs').select('id,description,calories_kcal,created_at').gte('created_at',from).lt('created_at',until).order('created_at',{ascending:false}),
      supabase.from('hydration_logs').select('id,amount_ml,logged_at').gte('logged_at',from).lt('logged_at',until).order('logged_at',{ascending:false}),
      supabase.from('medication_logs').select('id,medication_id,status,taken_at,medications(name)').gte('taken_at',from).lt('taken_at',until).order('taken_at',{ascending:false}),
      supabase.from('weight_logs').select('id,weight_kg,measured_at,notes').gte('measured_at',from).lt('measured_at',until).order('measured_at',{ascending:false}),
    ])
    const errors = [meals.error,water.error,meds.error,weights.error].filter(Boolean)
    if (errors.length) setMessage(errors[0]?.message ?? 'Nu s-a putut încărca istoricul.')
    const rows: Entry[] = [
      ...((meals.data ?? []) as any[]).map(x=>({id:x.id,category:'Masă',label:x.description,detail:x.calories_kcal+' kcal',at:x.created_at})),
      ...((water.data ?? []) as any[]).map(x=>({id:x.id,category:'Hidratare',label:'Apă consumată',detail:x.amount_ml+' ml',at:x.logged_at})),
      ...((meds.data ?? []) as any[]).map(x=>({id:x.id,category:'Medicament',label:x.medications?.name ?? 'Administrare',detail:x.status==='taken'?'Administrat':'Omis',at:x.taken_at})),
      ...((weights.data ?? []) as any[]).map(x=>({id:x.id,category:'Greutate',label:x.notes || 'Măsurătoare',detail:x.weight_kg+' kg',at:x.measured_at})),
    ]
    setEntries(rows.sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()))
    setLoading(false)
  },[date,userId])

  useEffect(()=>{void load()},[load])

  if (!userId) return <section className="panel placeholder-panel"><h3>Istoric</h3><p>Autentifică-te pentru a consulta istoricul personal.</p></section>

  return <section className="panel wellness-panel history-panel">
    <div className="panel-heading"><div><h3><CalendarDays size={19}/> Istoricul activității</h3><p>Alege o zi pentru a vedea mesele, hidratarea, administrările și măsurătorile</p></div><button type="button" onClick={()=>void load()} disabled={loading} aria-label="Reîncarcă istoricul"><RefreshCw size={17}/></button></div>
    <div className="history-date-controls">
      <button type="button" onClick={()=>setDate(d=>shiftDate(d,-1))} aria-label="Ziua precedentă"><ChevronLeft size={18}/></button>
      <label><span>Data istoricului</span><input type="date" value={date} max={toDate(new Date())} onChange={e=>e.target.value && setDate(e.target.value)}/></label>
      <button type="button" onClick={()=>setDate(d=>shiftDate(d,1))} disabled={date>=toDate(new Date())} aria-label="Ziua următoare"><ChevronRight size={18}/></button>
      <button type="button" className="history-today" onClick={()=>setDate(toDate(new Date()))}>Astăzi</button>
    </div>
    {loading ? <p>Se încarcă istoricul…</p> : entries.length ? entries.map(x=><div className="wellness-row history-entry" key={x.category+x.id}><div><span>{x.category} · {new Date(x.at).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</span><strong>{x.label}</strong></div><strong>{x.detail}</strong></div>) : <p className="empty-logs">Nu există înregistrări pentru această zi.</p>}
    {message && <p className="calorie-message" role="status">{message}</p>}
  </section>
}
