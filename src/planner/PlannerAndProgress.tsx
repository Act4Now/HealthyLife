import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, Check, Clock3, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type MealPlan = { id:string; planned_for:string; slot_name:string; meal_name:string; reminder_enabled:boolean; snoozed_until:string|null; reminder_sent_at:string|null; eaten_at:string|null }
type MealSlot = { id:string; slot_key:string; slot_label:string; slot_time:string; reminder_enabled:boolean; sort_order:number }
type Suggestion = { id:string; suggestion_type:string; current_value:number|null; suggested_value:number|null; reason:string; status:string; created_at:string }
const roDate = (d:Date) => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)
const startOfWeek = () => { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d }
const vapidKeyToBytes = (value:string) => {
 const padding='='.repeat((4-value.length%4)%4)
 const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/')
 const raw=window.atob(base64)
 return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))
}
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
 const [slots,setSlots]=useState<MealSlot[]>([])
 const [newSlotLabel,setNewSlotLabel]=useState('')
 const [newSlotTime,setNewSlotTime]=useState('12:00')
 const weekDays=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(week);d.setDate(d.getDate()+i);return d}),[week])
 const load=useCallback(async()=>{
  if(!supabase||!userId)return
  const from=weekDays[0].toISOString(), to=new Date(weekDays[6].getTime()+86400000).toISOString()
  const [p,s,sl]=await Promise.all([
   supabase.from('meal_plans').select('*').eq('user_id',userId).gte('planned_for',from).lt('planned_for',to).order('planned_for'),
   supabase.from('progress_suggestions').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(10),
   supabase.from('meal_slot_settings').select('*').eq('user_id',userId).order('sort_order').order('slot_time')
  ])
  if(p.error)setMessage(p.error.message);else setPlans((p.data??[]) as MealPlan[])
  if(s.error)setMessage(s.error.message);else setSuggestions((s.data??[]) as Suggestion[])
  if(!sl.error)setSlots((sl.data??[]) as MealSlot[])
 },[userId,weekDays])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{if(slots.length&&!slots.some(x=>x.slot_label===slot))setSlot(slots[0].slot_label)},[slots,slot])
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
 async function enablePushNotifications(){
  if(!supabase||!userId){setMessage('Autentificarea este necesară.');return}
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setMessage('Acest browser nu acceptă notificări push.');return}
  const publicKey=(import.meta as ImportMeta & {env:ImportMetaEnv & {VITE_VAPID_PUBLIC_KEY?:string}}).env.VITE_VAPID_PUBLIC_KEY
  if(!publicKey){setMessage('Lipsește VITE_VAPID_PUBLIC_KEY din configurația build-ului.');return}
  try{
   const permissionResult=await Notification.requestPermission()
   setPermission(permissionResult)
   if(permissionResult!=='granted'){setMessage('Permisiunea pentru notificări nu a fost acordată.');return}
   const registration=await navigator.serviceWorker.ready
   let subscription=await registration.pushManager.getSubscription()
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKeyToBytes(publicKey)})
   const json=subscription.toJSON()
   const keys=json.keys
   if(!json.endpoint||!keys?.p256dh||!keys.auth)throw new Error('Browserul nu a returnat toate datele abonamentului push.')
   const {error}=await supabase.from('push_subscriptions').upsert({
    user_id:userId,endpoint:json.endpoint,p256dh:keys.p256dh,auth:keys.auth,updated_at:new Date().toISOString()
   },{onConflict:'user_id,endpoint'})
   if(error)throw error
   setMessage('Notificările push sunt activate pentru acest browser.')
  }catch(error){setMessage(error instanceof Error?error.message:'Nu am putut activa notificările push.')}
 }
  function chooseSlot(name:string){
  setSlot(name)
  const found=slots.find(x=>x.slot_label===name)
  if(found){setWhen(day+'T'+found.slot_time.slice(0,5));setReminder(found.reminder_enabled)}
 }
 async function addSlot(){
  if(!supabase||!userId)return
  const label=newSlotLabel.trim()
  if(!label){setMessage('Introdu numele mesei.');return}
  const key=(label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'masa')+'-'+Date.now().toString(36)
  const {error}=await supabase.from('meal_slot_settings').insert({user_id:userId,slot_key:key,slot_label:label,slot_time:newSlotTime,reminder_enabled:true,sort_order:slots.length})
  if(error){setMessage(error.message);return}
  setNewSlotLabel('');await load();setMessage('Masa a fost adăugată în lista ta.')
 }
 async function addDefaultSlots(){
  if(!supabase||!userId)return
  const defaults=[['breakfast','Mic dejun','08:00'],['lunch','Prânz','13:00'],['snack','Gustare','16:30'],['dinner','Cină','19:30']]
  const {error}=await supabase.from('meal_slot_settings').insert(defaults.map((d,i)=>({user_id:userId,slot_key:d[0],slot_label:d[1],slot_time:d[2],reminder_enabled:true,sort_order:i})))
  if(error){setMessage(error.message);return}
  await load();setMessage('Mesele implicite au fost adăugate. Le poți șterge sau completa.')
 }
 async function removeSlot(id:string){
  if(!supabase||!userId)return
  const {error}=await supabase.from('meal_slot_settings').delete().eq('id',id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setSlots(current=>current.filter(x=>x.id!==id))
 }
 async function disablePushNotifications(){
  if(!supabase||!userId)return
  try{
   if(!('serviceWorker' in navigator)){setMessage('Acest browser nu acceptă notificări push.');return}
   const registration=await navigator.serviceWorker.ready
   const subscription=await registration.pushManager.getSubscription()
   if(subscription){
    const endpoint=subscription.endpoint
    await subscription.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('user_id',userId).eq('endpoint',endpoint)
   }
   setMessage('Notificările push au fost dezactivate pentru acest browser.')
  }catch(error){setMessage(error instanceof Error?error.message:'Nu am putut dezactiva notificările push.')}
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
   const [water,meals,targets,weights,profile,wellness]=await Promise.all([
    supabase.from('hydration_logs').select('amount_ml,logged_at').eq('user_id',userId).gte('logged_at',since.toISOString()),
    supabase.from('meal_logs').select('created_at').eq('user_id',userId).gte('created_at',since.toISOString()),
    supabase.from('daily_targets').select('water_ml,calories_kcal,target_date').eq('user_id',userId).order('target_date',{ascending:false}).limit(1),
    supabase.from('weight_logs').select('weight_kg,measured_at').eq('user_id',userId).gte('measured_at',since.toISOString()).order('measured_at'),
    supabase.from('profiles').select('weight_goal').eq('id',userId).maybeSingle(),
    supabase.from('wellness_goals').select('hydration_goal_ml').eq('user_id',userId).maybeSingle()
   ])
   for(const r of [water,meals,targets,weights,profile,wellness])if(r.error)throw r.error
   const waterRows=water.data??[],mealRows=meals.data??[]
   const weightRows=(weights.data??[]) as {weight_kg:number;measured_at:string}[]
   const activeDays=new Set(mealRows.map(x=>x.created_at.slice(0,10))).size
   const loggedWaterDays=new Set(waterRows.map(x=>x.logged_at.slice(0,10))).size
   if(activeDays<4&&loggedWaterDays<4&&weightRows.length<3){setMessage('Nu există încă suficiente înregistrări în ultimele 14 zile. Înregistrează câteva zile de activitate și încearcă din nou.');return}
   const grouped=new Map<string,number>()
   waterRows.forEach(x=>grouped.set(x.logged_at.slice(0,10),(grouped.get(x.logged_at.slice(0,10))??0)+Number(x.amount_ml)))
   const avgWater=grouped.size?Math.round([...grouped.values()].reduce((a,b)=>a+b,0)/grouped.size):0
   const target=Number(wellness.data?.hydration_goal_ml??targets.data?.[0]?.water_ml??0)
   const rows:{suggestion_type:string;current_value:number|null;suggested_value:number|null;reason:string;user_id:string}[]=[]
   if(avgWater>0&&target>0&&loggedWaterDays>=4&&avgWater<target*.75){
    const stepGoal=Math.min(target,Math.max(1000,Math.round(avgWater*1.25/100)*100))
    rows.push({user_id:userId,suggestion_type:'water',current_value:target,suggested_value:stepGoal,reason:'În zilele cu înregistrări din ultimele 14 zile, media hidratării a fost de '+avgWater+' ml/zi, sub 75% din obiectivul setat. O țintă intermediară mai ușor de atins ar putea fi '+stepGoal+' ml/zi; o poți crește treptat. Verifică dacă ți se potrivește.'})
   }
   const calorieTarget=Number(targets.data?.[0]?.calories_kcal??0)
   const goal=profile.data?.weight_goal as string|null|undefined
   if(weightRows.length>=3&&calorieTarget>0&&goal){
    const first=weightRows[0],last=weightRows[weightRows.length-1]
    const spanWeeks=(new Date(last.measured_at).getTime()-new Date(first.measured_at).getTime())/(7*86400000)
    if(spanWeeks>=1){
     const rate=(Number(last.weight_kg)-Number(first.weight_kg))/spanWeeks
     let delta=0
     if(goal==='lose'&&rate>-0.1)delta=-100
     else if(goal==='lose'&&rate<-1)delta=150
     else if(goal==='gain'&&rate<0.1)delta=150
     else if(goal==='gain'&&rate>0.75)delta=-100
     else if(goal==='maintain'&&rate>0.4)delta=-100
     else if(goal==='maintain'&&rate<-0.4)delta=100
     if(delta!==0)rows.push({user_id:userId,suggestion_type:'calories',current_value:calorieTarget,suggested_value:Math.max(1200,calorieTarget+delta),reason:'În ultimele 14 zile greutatea ta s-a modificat cu aproximativ '+rate.toFixed(2)+' kg pe săptămână, comparativ cu obiectivul ales. Ți-ar putea fi util să ajustezi ținta zilnică de calorii cu '+Math.abs(delta)+' kcal. Este o estimare orientativă, nu o recomandare medicală; verifică dacă ți se potrivește.'})
    }
   }
   if(activeDays>=4&&activeDays<10)rows.push({user_id:userId,suggestion_type:'calories',current_value:null,suggested_value:null,reason:'Ai înregistrat mese în '+activeDays+' din ultimele 14 zile. Încearcă să notezi mesele mai consecvent înainte de a schimba obiectivele nutriționale.'})
   if(!rows.length)rows.push({user_id:userId,suggestion_type:'steps',current_value:null,suggested_value:null,reason:'Ai suficiente înregistrări pentru o revizuire, dar datele disponibile nu indică o ajustare clară. Continuă monitorizarea și verifică dacă obiectivele actuale rămân potrivite.'})
   const {error}=await supabase.from('progress_suggestions').insert(rows)
   if(error)throw error
   await load();setMessage('Analiza ultimelor 14 zile a fost salvată. Sugestiile nu modifică obiectivele decât dacă le accepți.')
  }catch(e){setMessage(e instanceof Error?e.message:'Nu am putut analiza progresul.')}finally{setBusy(false)}
 }
 // Applies an accepted/edited suggestion to the latest target of each day type, dated today, so history is not rewritten.
 async function applySuggestion(s:Suggestion,value:number|null):Promise<boolean>{
  if(!supabase||!userId||value===null||s.current_value===null)return false
  const column=s.suggestion_type==='water'?'water_ml':s.suggestion_type==='calories'?'calories_kcal':null
  if(!column)return false
  const rounded=Math.round(value)
  if(column==='water_ml'&&(rounded<250||rounded>10000))return false
  if(column==='calories_kcal'&&(rounded<1000||rounded>6000))return false
  const today=roDate(new Date())
  const {data,error}=await supabase.from('daily_targets').select('*').eq('user_id',userId).lte('target_date',today).order('target_date',{ascending:false}).order('created_at',{ascending:false})
  if(error)throw error
  const latest=new Map<string,Record<string,unknown>>()
  for(const row of (data??[]) as Record<string,unknown>[]){const kind=String(row.day_type);if(!latest.has(kind))latest.set(kind,row)}
  let changed=false
  for(const row of latest.values()){
   if(row[column]===null||row[column]===undefined)continue
   if(row.target_date===today){
    const {error:updateError}=await supabase.from('daily_targets').update({[column]:rounded}).eq('id',row.id as string).eq('user_id',userId)
    if(updateError)throw updateError
   }else{
    const copy:Record<string,unknown>={...row}
    delete copy.id;delete copy.created_at
    const {error:insertError}=await supabase.from('daily_targets').insert({...copy,target_date:today,[column]:rounded})
    if(insertError)throw insertError
   }
   changed=true
  }
  if(column==='water_ml'){
   const {error:goalError}=await supabase.from('wellness_goals').upsert({user_id:userId,hydration_goal_ml:rounded,updated_at:new Date().toISOString()},{onConflict:'user_id'})
   if(goalError)throw goalError
   changed=true
  }
  return changed
 }
 function beginSuggestionEdit(s:Suggestion){
  setEditingSuggestionId(s.id)
  setEditedSuggestionValue(s.suggested_value===null?'':String(s.suggested_value))
 }
 async function saveSuggestionEdit(s:Suggestion){
  if(!supabase||!userId)return
  const value=editedSuggestionValue.trim()===''?null:Number(editedSuggestionValue)
  if(value!==null&&(!Number.isFinite(value)||value<0)){setMessage('Introdu o valoare numerică validă, pozitivă sau zero.');return}
  let applied=false
  try{applied=await applySuggestion(s,value)}catch(e){setMessage(e instanceof Error?e.message:'Nu am putut actualiza ținta.');return}
  const {error}=await supabase.from('progress_suggestions').update({suggested_value:value,status:'edited',resolved_at:new Date().toISOString()}).eq('id',s.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setSuggestions(current=>current.map(x=>x.id===s.id?{...x,suggested_value:value,status:'edited'}:x))
  setEditingSuggestionId(null);setMessage(applied?'Ținta a fost actualizată începând de astăzi. Istoricul nu a fost modificat.':'Valoarea sugestiei a fost salvată.')
 }
 async function resolveSuggestion(s:Suggestion,status:'accepted'|'edited'|'dismissed'){
  if(!supabase||!userId)return
  let applied=false
  try{if(status==='accepted')applied=await applySuggestion(s,s.suggested_value)}catch(e){setMessage(e instanceof Error?e.message:'Nu am putut actualiza ținta.');return}
  const {error}=await supabase.from('progress_suggestions').update({status,resolved_at:new Date().toISOString()}).eq('id',s.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setSuggestions(current=>current.map(x=>x.id===s.id?{...x,status}:x))
  setMessage(status==='dismissed'?'Sugestia a fost respinsă.':applied?'Ținta a fost actualizată începând de astăzi. Istoricul nu a fost modificat.':'Răspunsul tău a fost salvat.')
 }
 return <div className="planner-layout">
  <section className="panel planner-panel">
   <div className="panel-heading"><div><h3><CalendarDays size={19}/> Planificator alimentar săptămânal</h3><p>Organizează mesele pe zile și setează mementouri.</p></div></div>
   <div className="planner-week"><button className="outline-button" onClick={()=>setWeek(d=>new Date(d.getTime()-7*86400000))}>‹</button><strong>{weekDays[0].toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – {weekDays[6].toLocaleDateString('ro-RO',{day:'numeric',month:'short'})}</strong><button className="outline-button" onClick={()=>setWeek(d=>new Date(d.getTime()+7*86400000))}>›</button><button className="outline-button" onClick={()=>setWeek(startOfWeek())}>Săptămâna curentă</button></div>
   <div className="planner-days">{weekDays.map(d=><button key={roDate(d)} className={day===roDate(d)?'selected':''} onClick={()=>setDay(roDate(d))}><span>{d.toLocaleDateString('ro-RO',{weekday:'short'})}</span><strong>{d.getDate()}</strong></button>)}</div>
   <div className="planner-form">
    <label>Data și ora<input type="datetime-local" value={when} onChange={e=>{setWhen(e.target.value);setDay(e.target.value.slice(0,10))}}/></label>
    <label>Tipul mesei<select value={slot} onChange={e=>chooseSlot(e.target.value)}>{(slots.length?slots.map(x=>x.slot_label):['Mic dejun','Prânz','Cină','Gustare']).map(name=><option key={name}>{name}</option>)}</select></label>
    <label className="planner-meal-name">Masă planificată<input value={meal} onChange={e=>setMeal(e.target.value)} placeholder="Ex.: Ovăz cu iaurt și fructe"/></label>
    <label className="planner-check"><input type="checkbox" checked={reminder} onChange={e=>setReminder(e.target.checked)}/> Activează mementoul</label>
    <button className="save-meal-button" onClick={()=>void addPlan()}>{editingId?<><Check size={16}/> Salvează modificările</>:<><Plus size={16}/> Adaugă în plan</>}</button>
    {editingId&&<button type="button" className="outline-button" onClick={cancelEdit}>Anulează editarea</button>}
   </div>
   <details className="custom-food-editor"><summary>Personalizează mesele zilei</summary><div className="slot-form"><input value={newSlotLabel} onChange={e=>setNewSlotLabel(e.target.value)} placeholder="Ex.: Gustare de seară" maxLength={80} aria-label="Numele mesei"/><input type="time" value={newSlotTime} onChange={e=>setNewSlotTime(e.target.value)} aria-label="Ora mesei"/><button type="button" className="outline-button" onClick={()=>void addSlot()}><Plus size={15}/> Adaugă masa</button>{!slots.length&&<button type="button" className="outline-button" onClick={()=>void addDefaultSlots()}>Folosește mesele implicite</button>}</div>{slots.map(x=><div className="custom-food-row" key={x.id}><span>{x.slot_label} · {x.slot_time.slice(0,5)}</span><button type="button" onClick={()=>void removeSlot(x.id)}>Șterge</button></div>)}</details>
   <div className="planner-list">{plans.filter(p=>roDate(new Date(p.planned_for))===day).map(p=><article className="planner-item" key={p.id}><div><strong>{p.slot_name} · {new Date(p.planned_for).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</strong><span>{p.meal_name}</span><small>{p.eaten_at?'Marcată ca efectuată':p.reminder_enabled?'Memento activ':'Fără memento'}</small></div><div className="planner-actions"><button title="Editează masa" aria-label="Editează masa" onClick={()=>editPlan(p)}><Pencil size={15}/></button>{!p.eaten_at&&<button title="Marchează efectuată" onClick={()=>void markDone(p)}><Check size={15}/></button>}{p.reminder_enabled&&!p.eaten_at&&<button title="Amână 10 minute" onClick={()=>void snooze(p)}><Clock3 size={15}/></button>}<button title="Șterge din plan" onClick={()=>void remove(p)}><Trash2 size={15}/></button></div></article>)}{!plans.some(p=>roDate(new Date(p.planned_for))===day)&&<p className="empty-logs">Nu ai mese planificate pentru această zi.</p>}</div>
   <div className="planner-reminders"><Bell size={17}/><span>Permisiune notificări: <strong>{permission}</strong>. Mementourile din această versiune apar cât timp aplicația este deschisă în browser.</span><button className="outline-button" onClick={()=>void askPermission()}>Mementouri în aplicație</button><button className="outline-button" onClick={()=>void enablePushNotifications()}>Activează push în fundal</button><button className="outline-button" onClick={()=>void disablePushNotifications()}>Dezactivează push</button></div>
  </section>
  <section className="panel planner-panel">
   <div className="panel-heading"><div><h3><RefreshCw size={19}/> Sugestii după 14 zile</h3><p>Analiză bazată pe înregistrările tale, nu pe valori presupuse.</p></div></div>
   <button className="save-meal-button" disabled={busy} onClick={()=>void generateSuggestions()}>{busy?'Se analizează…':'Analizează ultimele 14 zile'}</button>
   {suggestions.map(s=><article className="progress-suggestion" key={s.id}><small>{new Date(s.created_at).toLocaleDateString('ro-RO')} · {s.suggestion_type}</small><p>{s.reason}</p><strong>{s.status==='pending'?'În așteptare':s.status==='dismissed'?'Respinsă':s.status==='accepted'?'Acceptată':'Modificată'}</strong>{s.status==='pending'&&<div className="planner-actions"><button onClick={()=>void resolveSuggestion(s,'accepted')}>Accept</button><button onClick={()=>beginSuggestionEdit(s)}>Editează valoarea</button><button onClick={()=>void resolveSuggestion(s,'dismissed')}>Respinge</button></div>}
   {editingSuggestionId===s.id&&<div className="suggestion-edit"><label>Valoare propusă<input type="number" min="0" step="any" value={editedSuggestionValue} onChange={e=>setEditedSuggestionValue(e.target.value)} placeholder="Introdu valoarea"/></label><div className="planner-actions"><button onClick={()=>void saveSuggestionEdit(s)}>Salvează valoarea</button><button onClick={()=>setEditingSuggestionId(null)}>Anulează</button></div></div>}
   {s.current_value!==null&&<small>Valoare curentă: {s.current_value} · propusă: {s.suggested_value??'—'}</small>}</article>)}
   {!suggestions.length&&<p className="empty-logs">Nu există sugestii generate încă.</p>}
   <p className="calorie-disclaimer">Sugestiile sunt orientative, nu recomandări medicale. Obiectivele se modifică numai dacă accepți sau editezi o sugestie, iar istoricul rămâne neschimbat; sugestiile pot fi respinse. Analiza are nevoie de date reale înregistrate în cont în ultimele 14 zile.</p>
  </section>
  {message&&<p className="calorie-message planner-message" role="status">{message}</p>}
 </div>
}
