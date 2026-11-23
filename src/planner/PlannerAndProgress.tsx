import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, Check, Clock3, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type MealPlan = { id:string; planned_for:string; slot_name:string; meal_name:string; reminder_enabled:boolean; snoozed_until:string|null; reminder_sent_at:string|null; eaten_at:string|null }
type Suggestion = { id:string; suggestion_type:string; current_value:number|null; suggested_value:number|null; reason:string; status:string; created_at:string }
const roDate = (d:Date) => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)
const startOfWeek = () => { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d }
const dateTimeLocal = (value:string) => { const d=new Date(value); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16) }

export default function PlannerAndProgress({userId}:{userId?:string}) {
 const [plans,setPlans]=useState<MealPlan[]>([])
 const [suggestions,setSuggestions]=useState<Suggestion[]>([])
 const [week,setWeek]=useState(startOfWeek)
 const [day,setDay]=useState(roDate(new Date()))
 const [slot,setSlot]=useState('Mic dejun')
 const [meal,setMeal]=useState('')
 const [when,setWhen]=useState(dateTimeLocal(new Date(Date.now()+60*60*1000).toISOString()))
 const [reminder,setReminder]=useState(true)
 const [permission,setPermission]=useState(typeof Notification==='undefined'?'unsupported':Notification.permission)
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [editingId,setEditingId]=useState<string|null>(null)
 const [editingSuggestionId,setEditingSuggestionId]=useState<string|null>(null)
 const [editedSuggestionValue,setEditedSuggestionValue]=useState('')
 const weekDays=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(week);d.setDate(d.getDate()+i);return d}),[week])
 const load=useCallback(async()=>{
  if(!supabase||!userId)return
  const from=weekDays[0].toISOString(), to=new Date(weekDays[6].getTime()+86400000).toISOString()
  const [p,s]=await Promise.all([
   supabase.from('meal_plans').select('*').eq('user_id',userId).gte('planned_for',from).lt('planned_for',to).order('planned_for'),
   supabase.from('progress_suggestions').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(10)
  ])
  if(p.error)setMessage(p.error.message);else setPlans((p.data??[]) as MealPlan[])
  if(s.error)setMessage(s.error.message);else setSuggestions((s.data??[]) as Suggestion[])
 },[userId,weekDays])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{
  if(!supabase||!userId||typeof Notification==='undefined')return
  const client=supabase
  const tick=async()=>{
   const now=Date.now()
   const due=plans.filter(p=>p.reminder_enabled&&!p.reminder_sent_at&&new Date(p.snoozed_until??p.planned_for).getTime()<=now&&!p.eaten_at)
   for(const p of due){
    if(Notification.permission==='granted')new Notification('HealthyLife · '+p.slot_name,{body:'Este timpul pentru: '+p.meal_name})
    await client.from('meal_plans').update({reminder_sent_at:new Date().toISOString()}).eq('id',p.id).eq('user_id',userId)
    setPlans(current=>current.map(x=>x.id===p.id?{...x,reminder_sent_at:new Date().toISOString()}:x))
   }
  }
  const timer=window.setInterval(()=>void tick(),30000)
  void tick()
  return()=>window.clearInterval(timer)
 },[plans,userId])
 async function addPlan(){
  if(!supabase||!userId){setMessage('Autentificarea este necesară.');return}
  if(!meal.trim()){setMessage('Introdu numele mesei.');return}
  const values={planned_for:new Date(when).toISOString(),slot_name:slot,meal_name:meal.trim(),reminder_enabled:reminder}
  if(editingId){
   const result=await supabase.from('meal_plans').update({...values,reminder_sent_at:null,snoozed_until:null}).eq('id',editingId).eq('user_id',userId).select('*').single()
   if(result.error){setMessage(result.error.message);return}
   setPlans(current=>current.map(p=>p.id===editingId?result.data as MealPlan:p).sort((a,b)=>a.planned_for.localeCompare(b.planned_for)))
   setEditingId(null);setMessage('Masa planificată a fost actualizată.')
  }else{
   const result=await supabase.from('meal_plans').insert({user_id:userId,...values}).select('*').single()
   if(result.error){setMessage(result.error.message);return}
   setPlans(current=>[...current,result.data as MealPlan].sort((a,b)=>a.planned_for.localeCompare(b.planned_for)))
   setMessage('Masa a fost adăugată în plan.')
  }
  setMeal('')
 }
 function editPlan(p:MealPlan){
  setEditingId(p.id);setMeal(p.meal_name);setSlot(p.slot_name);setWhen(dateTimeLocal(p.planned_for));setReminder(p.reminder_enabled);setDay(roDate(new Date(p.planned_for)))
  setMessage('Editezi masa selectată. Salvează modificările sau anulează editarea.')
 }
 function cancelEdit(){setEditingId(null);setMeal('');setMessage('Editarea a fost anulată.')}
 async function askPermission(){
  if(typeof Notification==='undefined'){setMessage('Acest browser nu oferă notificări web.');return}
  const result=await Notification.requestPermission();setPermission(result)
  setMessage(result==='granted'?'Notificările sunt activate. Vor apărea cât timp HealthyLife este deschis.':'Permisiunea pentru notificări nu a fost acordată.')
 }
 async function snooze(p:MealPlan){
  if(!supabase||!userId)return
  const until=new Date(Date.now()+10*60*1000).toISOString()
  const {error}=await supabase.from('meal_plans').update({snoozed_until:until,reminder_sent_at:null}).eq('id',p.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setPlans(current=>current.map(x=>x.id===p.id?{...x,snoozed_until:until,reminder_sent_at:null}:x));setMessage('Mementoul a fost amânat 10 minute.')
 }
 async function markDone(p:MealPlan){
  if(!supabase||!userId)return
  const {error}=await supabase.from('meal_plans').update({eaten_at:new Date().toISOString()}).eq('id',p.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setPlans(current=>current.map(x=>x.id===p.id?{...x,eaten_at:new Date().toISOString()}:x))
 }
 async function remove(p:MealPlan){
  if(!supabase||!userId)return
  const {error}=await supabase.from('meal_plans').delete().eq('id',p.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setPlans(current=>current.filter(x=>x.id!==p.id))
 }
 async function generateSuggestions(){
  if(!supabase||!userId)return
  setBusy(true);setMessage('')
  try{
   const since=new Date();since.setDate(since.getDate()-14);since.setHours(0,0,0,0)
   const [water,meals,targets]=await Promise.all([
    supabase.from('hydration_logs').select('amount_ml,logged_at').eq('user_id',userId).gte('logged_at',since.toISOString()),
    supabase.from('meal_logs').select('created_at').eq('user_id',userId).gte('created_at',since.toISOString()),
    supabase.from('daily_targets').select('water_ml,calories_kcal,target_date').eq('user_id',userId).order('target_date',{ascending:false}).limit(1)
   ])
   for(const r of [water,meals,targets])if(r.error)throw r.error
   const waterRows=water.data??[],mealRows=meals.data??[]
   const activeDays=new Set(mealRows.map(x=>x.created_at.slice(0,10))).size
   const loggedWaterDays=new Set(waterRows.map(x=>x.logged_at.slice(0,10))).size
   if(activeDays<4&&loggedWaterDays<4){setMessage('Nu există încă suficiente înregistrări în ultimele 14 zile. Înregistrează câteva zile de activitate și încearcă din nou.');return}
   const grouped=new Map<string,number>()
   waterRows.forEach(x=>grouped.set(x.logged_at.slice(0,10),(grouped.get(x.logged_at.slice(0,10))??0)+Number(x.amount_ml)))
   const avgWater=grouped.size?Math.round([...grouped.values()].reduce((a,b)=>a+b,0)/grouped.size):0
   const target=Number(targets.data?.[0]?.water_ml??0)
   const rows:{suggestion_type:string;current_value:number|null;suggested_value:number|null;reason:string;user_id:string}[]=[]
   if(avgWater>0&&target>0&&loggedWaterDays>=4&&avgWater<target*.75)rows.push({user_id:userId,suggestion_type:'water',current_value:target,suggested_value:Math.max(250,Math.round(avgWater/100)*100),reason:'În zilele cu înregistrări din ultimele 14 zile, media hidratării a fost de '+avgWater+' ml/zi, sub 75% din obiectivul setat. Verifică dacă vrei să ajustezi obiectivul.'})
   if(activeDays>=4&&activeDays<10)rows.push({user_id:userId,suggestion_type:'calories',current_value:activeDays,suggested_value:activeDays,reason:'Ai înregistrat mese în '+activeDays+' din ultimele 14 zile. Încearcă să notezi mesele mai consecvent înainte de a schimba obiectivele nutriționale.'})
   if(!rows.length)rows.push({user_id:userId,suggestion_type:'steps',current_value:null,suggested_value:null,reason:'Ai suficiente înregistrări pentru o revizuire, dar datele disponibile nu indică o ajustare clară. Continuă monitorizarea și verifică dacă obiectivele actuale rămân potrivite.'})
   const {error}=await supabase.from('progress_suggestions').insert(rows)
   if(error)throw error
   await load();setMessage('Analiza ultimelor 14 zile a fost salvată. Sugestiile nu modifică automat obiectivele.')
  }catch(e){setMessage(e instanceof Error?e.message:'Nu am putut analiza progresul.')}finally{setBusy(false)}
 }
 function beginSuggestionEdit(s:Suggestion){
  setEditingSuggestionId(s.id)
  setEditedSuggestionValue(s.suggested_value===null?'':String(s.suggested_value))
 }
 async function saveSuggestionEdit(s:Suggestion){
  if(!supabase||!userId)return
  const value=editedSuggestionValue.trim()===''?null:Number(editedSuggestionValue)
  if(value!==null&&(!Number.isFinite(value)||value<0)){setMessage('Introdu o valoare numerică validă, pozitivă sau zero.');return}
  const {error}=await supabase.from('progress_suggestions').update({suggested_value:value,status:'edited',resolved_at:new Date().toISOString()}).eq('id',s.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setSuggestions(current=>current.map(x=>x.id===s.id?{...x,suggested_value:value,status:'edited'}:x))
  setEditingSuggestionId(null);setMessage('Valoarea sugestiei a fost salvată. Obiectivele nu au fost modificate automat.')
 }
 async function resolveSuggestion(s:Suggestion,status:'accepted'|'edited'|'dismissed'){
  if(!supabase||!userId)return
  const {error}=await supabase.from('progress_suggestions').update({status,resolved_at:new Date().toISOString()}).eq('id',s.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setSuggestions(current=>current.map(x=>x.id===s.id?{...x,status}:x))
  setMessage(status==='dismissed'?'Sugestia a fost respinsă.':'Răspunsul tău a fost salvat. Revizuiește manual obiectivele din Profil și obiective personale dacă dorești o modificare.')
 }
 return <div className="planner-layout">
  <section className="panel planner-panel">
   <div className="panel-heading"><div><h3><CalendarDays size={19}/> Planificator alimentar săptămânal</h3><p>Organizează mesele pe zile și setează mementouri.</p></div></div>
   <div className="planner-week"><button className="outline-button" onClick={()=>setWeek(d=>new Date(d.getTime()-7*86400000))}>‹</button><strong>{weekDays[0].toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – {weekDays[6].toLocaleDateString('ro-RO',{day:'numeric',month:'short'})}</strong><button className="outline-button" onClick={()=>setWeek(d=>new Date(d.getTime()+7*86400000))}>›</button><button className="outline-button" onClick={()=>setWeek(startOfWeek())}>Săptămâna curentă</button></div>
   <div className="planner-days">{weekDays.map(d=><button key={roDate(d)} className={day===roDate(d)?'selected':''} onClick={()=>setDay(roDate(d))}><span>{d.toLocaleDateString('ro-RO',{weekday:'short'})}</span><strong>{d.getDate()}</strong></button>)}</div>
   <div className="planner-form">
    <label>Data și ora<input type="datetime-local" value={when} onChange={e=>{setWhen(e.target.value);setDay(e.target.value.slice(0,10))}}/></label>
    <label>Tipul mesei<select value={slot} onChange={e=>setSlot(e.target.value)}><option>Mic dejun</option><option>Prânz</option><option>Cină</option><option>Gustare</option></select></label>
    <label className="planner-meal-name">Masă planificată<input value={meal} onChange={e=>setMeal(e.target.value)} placeholder="Ex.: Ovăz cu iaurt și fructe"/></label>
    <label className="planner-check"><input type="checkbox" checked={reminder} onChange={e=>setReminder(e.target.checked)}/> Activează mementoul</label>
    <button className="save-meal-button" onClick={()=>void addPlan()}>{editingId?<><Check size={16}/> Salvează modificările</>:<><Plus size={16}/> Adaugă în plan</>}</button>
    {editingId&&<button type="button" className="outline-button" onClick={cancelEdit}>Anulează editarea</button>}
   </div>
   <div className="planner-list">{plans.filter(p=>roDate(new Date(p.planned_for))===day).map(p=><article className="planner-item" key={p.id}><div><strong>{p.slot_name} · {new Date(p.planned_for).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</strong><span>{p.meal_name}</span><small>{p.eaten_at?'Marcată ca efectuată':p.reminder_enabled?'Memento activ':'Fără memento'}</small></div><div className="planner-actions"><button title="Editează masa" aria-label="Editează masa" onClick={()=>editPlan(p)}><Pencil size={15}/></button>{!p.eaten_at&&<button title="Marchează efectuată" onClick={()=>void markDone(p)}><Check size={15}/></button>}{p.reminder_enabled&&!p.eaten_at&&<button title="Amână 10 minute" onClick={()=>void snooze(p)}><Clock3 size={15}/></button>}<button title="Șterge din plan" onClick={()=>void remove(p)}><Trash2 size={15}/></button></div></article>)}{!plans.some(p=>roDate(new Date(p.planned_for))===day)&&<p className="empty-logs">Nu ai mese planificate pentru această zi.</p>}</div>
   <div className="planner-reminders"><Bell size={17}/><span>Permisiune notificări: <strong>{permission}</strong>. Mementourile din această versiune apar cât timp aplicația este deschisă în browser.</span><button className="outline-button" onClick={()=>void askPermission()}>Activează notificările</button></div>
  </section>
  <section className="panel planner-panel">
   <div className="panel-heading"><div><h3><RefreshCw size={19}/> Sugestii după 14 zile</h3><p>Analiză bazată pe înregistrările tale, nu pe valori presupuse.</p></div></div>
   <button className="save-meal-button" disabled={busy} onClick={()=>void generateSuggestions()}>{busy?'Se analizează…':'Analizează ultimele 14 zile'}</button>
   {suggestions.map(s=><article className="progress-suggestion" key={s.id}><small>{new Date(s.created_at).toLocaleDateString('ro-RO')} · {s.suggestion_type}</small><p>{s.reason}</p><strong>{s.status==='pending'?'În așteptare':s.status==='dismissed'?'Respinsă':s.status==='accepted'?'Acceptată':'Modificată'}</strong>{s.status==='pending'&&<div className="planner-actions"><button onClick={()=>void resolveSuggestion(s,'accepted')}>Accept</button><button onClick={()=>beginSuggestionEdit(s)}>Editează valoarea</button><button onClick={()=>void resolveSuggestion(s,'dismissed')}>Respinge</button></div>}
   {editingSuggestionId===s.id&&<div className="suggestion-edit"><label>Valoare propusă<input type="number" min="0" step="any" value={editedSuggestionValue} onChange={e=>setEditedSuggestionValue(e.target.value)} placeholder="Introdu valoarea"/></label><div className="planner-actions"><button onClick={()=>void saveSuggestionEdit(s)}>Salvează valoarea</button><button onClick={()=>setEditingSuggestionId(null)}>Anulează</button></div></div>}
   {s.current_value!==null&&<small>Valoare curentă: {s.current_value} · propusă: {s.suggested_value??'—'}</small>}</article>)}
   {!suggestions.length&&<p className="empty-logs">Nu există sugestii generate încă.</p>}
   <p className="calorie-disclaimer">Sugestiile sunt orientative, nu recomandări medicale. Nu schimbă automat obiectivele și pot fi respinse. Analiza are nevoie de date reale înregistrate în cont în ultimele 14 zile.</p>
  </section>
  {message&&<p className="calorie-message planner-message" role="status">{message}</p>}
 </div>
}
