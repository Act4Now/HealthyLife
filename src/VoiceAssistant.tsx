import { useEffect, useRef, useState } from 'react'
import { Mic, Check, Pencil, X, Undo2, Type } from 'lucide-react'
import { supabase } from './lib/supabase'

type Intent = 'meal' | 'water' | 'medication'
type Draft = {
  id: string
  intent: Intent
  item: string
  amount: string
  time: string
  date: string
  repeat?: string
  dose?: string
  options?: string[]
  uncertain?: string
}
type Saved = { table: 'meal_logs' | 'hydration_logs' | 'medications'; id: string; label: string }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence?: number } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }

const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
const normalize = (s:string) => s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/[^a-z0-9: ]/g,' ').replace(/\s+/g,' ').trim()
const parseTime = (s:string) => {
  const t=normalize(s)
  const words:Record<string,number>={unu:1,una:1,doi:2,doua:2,trei:3,patru:4,cinci:5,sase:6,sapte:7,opt:8,noua:9,zece:10,unsprezece:11,douasprezece:12}
  const word=Object.keys(words).find(k=>t.split(/\\s+/).includes(k))
  if(word&&/(seara|dupa amiaza|pm)/.test(t))return String((words[word]%12)+12).padStart(2,'0')+':00'
  if(word&&/(dimineata|am)/.test(t))return String(words[word]%12).padStart(2,'0')+':00'
  const m=t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || t.match(/\b(?:ora\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:si)?\s*(dimineata|dupa amiaza|seara|noaptea)\b/) || t.match(/\b(\d{1,2})(?::(\d{2}))?\b/)
  if(!m)return ''
  let h=Number(m[1]), min=Number(m[2]??0)
  const suffix=m[3]
  if(suffix==='pm'||suffix==='seara'||suffix==='dupa amiaza'){if(h<12)h+=12}
  if((suffix==='am'||suffix==='dimineata')&&h===12)h=0
  if(h>23||min>59)return ''
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
}
function parseTranscript(raw:string, language:'ro'|'en'):Draft[]{
  const text=normalize(raw)
  const parts=text.split(/\s+(?:si|and)\s+/).filter(Boolean)
  const drafts:Draft[]=[]
  for(const part of parts){
    const future=/(remind|reminder|set|schedule|aminteste|seteaza|programeaza|pastila|medicament)/.test(part)&&/(remind|reminder|set|schedule|aminteste|seteaza|programeaza)/.test(part)
    const drank=/(drank|drink|had|beau|baut|ba ut|am baut|apa|water)/.test(part)&&/(glass|pahar|water|apa|drank|beau|baut)/.test(part)
    const mealVerb=/(ate|had|eaten|mancat|mananc|consumat|am mancat)/.test(part)
    if(future){
      const time=parseTime(part)
      const name=/(pill|pills|medication|medicine|pastila|pastile|medicament)/.test(part)?(language==='ro'?'Medicament':'Medication'):''
      const duration=/(week|saptamana|sapte zile|7 zile)/.test(part)?7:/(3 zile|three days)/.test(part)?3:1
      drafts.push({id:makeId(),intent:'medication',item:name,amount:'1 doză',dose:'1 comprimat',time,date:today(),repeat:`Zilnic, ${duration} ${language==='ro'?'zile':'days'}`,uncertain:!time?'Am nevoie de ora administrării.':undefined})
    }else if(drank){
      drafts.push({id:makeId(),intent:'water',item:language==='ro'?'Apă':'Water',amount:language==='ro'?'1 pahar':'1 glass',time:new Date().toTimeString().slice(0,5),date:today()})
    }else if(mealVerb){
      const known=['pie','cake','pizza','apple','banana','sandwich','salad','soup','plăcintă','placinta','prăjitură','prajitura','măr','mar','banană','banana','sandviș','sandvis','salată','salata','supă','supa']
      const matched=known.filter(x=>part.includes(normalize(x))).sort((a,b)=>b.length-a.length)[0]
      const item=matched??''
      const ambiguous=['pie','plăcintă','placinta','cake','prăjitură','prajitura'].includes(item)
      const opts=ambiguous?(language==='ro'?['Plăcintă cu mere','Plăcintă cu brânză','Plăcintă cu dovleac']:['Apple pie','Cheese pie','Pumpkin pie']):undefined
      const amount=/(piece|felie|bucata)/.test(part)?(language==='ro'?'1 bucată':'1 piece'):'1 porție'
      drafts.push({id:makeId(),intent:'meal',item:item?item:'',amount,time:new Date().toTimeString().slice(0,5),date:today(),options:opts,uncertain:!item?'Nu am identificat alimentul. Alege o variantă sau editează numele.':undefined})
    }
  }
  return drafts
}

export default function VoiceAssistant({userId,language}:{userId?:string;language:'ro'|'en'}){
 const [listening,setListening]=useState(false)
 const [transcript,setTranscript]=useState('')
 const [drafts,setDrafts]=useState<Draft[]>([])
 const [editing,setEditing]=useState<string|null>(null)
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [glassMl,setGlassMl]=useState(250)
 const [typed,setTyped]=useState(false)
 const [saved,setSaved]=useState<Saved[]>([])
 const recognizer=useRef<Recognition|null>(null)
 useEffect(()=>{
  if(!supabase||!userId)return
  void supabase.from('wellness_goals').select('glass_size_ml').eq('user_id',userId).maybeSingle().then(({data})=>{if(data?.glass_size_ml)setGlassMl(Number(data.glass_size_ml))})
 },[userId])
 useEffect(()=>()=>{recognizer.current?.abort()},[])
 function start(){
  const w=window as RecognitionWindow
  const API=w.SpeechRecognition??w.webkitSpeechRecognition
  if(!API){setMessage(language==='ro'?'Recunoașterea vocală nu este disponibilă în acest browser. Poți introduce textul manual.':'Speech recognition is not supported in this browser. You can type instead.');return}
  if(!userId){setMessage(language==='ro'?'Autentifică-te pentru a folosi jurnalul vocal.':'Sign in to use voice logging.');return}
  try{
   const rec=new API();recognizer.current=rec;rec.lang=language==='ro'?'ro-RO':'en-US';rec.interimResults=true;rec.continuous=false
   rec.onresult=(event)=>{
    let finalText='',live='',lowConfidence=false
    for(let i=event.resultIndex;i<event.results.length;i++){const item=event.results[i];if(item.isFinal){finalText+=item[0].transcript+' ';if(typeof item[0].confidence==='number'&&item[0].confidence<0.55)lowConfidence=true}else live+=item[0].transcript}
    setTranscript((finalText||'')+live)
    if(finalText.trim()){
     if(lowConfidence){setMessage(language==='ro'?'Recunoașterea nu este suficient de sigură. Repetă mai clar sau scrie comanda.':'Recognition confidence is low. Please retry clearly or type the command.');return}
     const parsed=parseTranscript(finalText,language)
     if(parsed.length){setDrafts(current=>[...current,...parsed]);setMessage('')}
     else setMessage(language==='ro'?'Nu am înțeles comanda. Încearcă din nou sau scrie ce dorești.':'I did not understand. Try again or type what you want.')
    }
   }
   rec.onerror=(event)=>{setListening(false);setMessage(event.error==='not-allowed'?(language==='ro'?'Accesul la microfon este blocat. Activează permisiunea din setările browserului.':'Microphone access is blocked. Enable it in browser settings.'):(language==='ro'?'Nu am putut recunoaște vocea. Încearcă din nou sau tastează comanda.':'Voice recognition failed. Retry or type your command.'))}
   rec.onend=()=>setListening(false)
   rec.start();setListening(true);setTranscript('');setMessage('')
  }catch{setListening(false);setMessage(language==='ro'?'Nu am putut porni microfonul. Verifică permisiunea browserului.':'Could not start microphone. Check browser permission.')}
 }
 function updateDraft(id:string,patch:Partial<Draft>){setDrafts(current=>current.map(d=>d.id===id?{...d,...patch,uncertain:undefined}:d))}
 async function saveGlassSize(){
  if(!supabase||!userId)return
  if(!Number.isInteger(glassMl)||glassMl<50||glassMl>2000){setMessage(language==='ro'?'Volumul paharului trebuie să fie între 50 și 2.000 ml.':'Glass size must be between 50 and 2,000 ml.');return}
  const {error}=await supabase.from('wellness_goals').upsert({user_id:userId,glass_size_ml:glassMl},{onConflict:'user_id'})
  setMessage(error?(error as Error).message:(language==='ro'?'Volumul paharului a fost salvat.':'Glass size saved.'))
 }
 async function confirm(d:Draft){
  if(!supabase||!userId)return
  if(d.uncertain||!d.item.trim()||!d.amount.trim()||(d.intent==='medication'&&!d.time)){setMessage(language==='ro'?'Completează elementele marcate înainte de confirmare.':'Complete the missing fields before confirming.');return}
  setBusy(true);setMessage('')
  try{
   let result: {data:{id:string}|null;error:Error|null}
   let entry:Saved
   if(d.intent==='meal'){
    const {data,error}=await supabase.from('meal_logs').insert({user_id:userId,description:`${d.item} · ${d.amount}`,calories_kcal:0,protein_g:0,carbohydrates_g:0,fat_g:0,ingredients:[]}).select('id').single()
    result={data,error};entry={table:'meal_logs',id:data?.id??'',label:d.item}
   }else if(d.intent==='water'){
    const explicitMl=d.amount.match(/(\\d+(?:[.,]\\d+)?)\\s*ml/i)
    const countMatch=d.amount.match(/(\\d+(?:[.,]\\d+)?)/)
    const amountMl=explicitMl?Math.round(Number(explicitMl[1].replace(',','.'))):Math.round(glassMl*(countMatch?Number(countMatch[1].replace(',','.')):1))
    if(!Number.isFinite(amountMl)||amountMl<1||amountMl>5000)throw new Error(language==='ro'?'Cantitatea de apă trebuie să fie între 1 și 5.000 ml.':'Water amount must be between 1 and 5,000 ml.')
    const {data,error}=await supabase.from('hydration_logs').insert({user_id:userId,amount_ml:amountMl}).select('id').single()
    result={data,error};entry={table:'hydration_logs',id:data?.id??'',label:`${amountMl} ml`}
   }else{
    const {data,error}=await supabase.from('medications').insert({user_id:userId,name:d.item,dose:d.dose||d.amount,schedule:d.time,notes:`Voice assistant · ${d.repeat}`,starts_on:d.date,ends_on:new Date(new Date(d.date+'T12:00:00').getTime()+(Math.max(1,Number(d.repeat?.match(/\d+/)?.[0]??1))-1)*86400000).toISOString().slice(0,10)}).select('id').single()
    result={data,error};entry={table:'medications',id:data?.id??'',label:d.item}
   }
   if(result.error)throw result.error
   setSaved(current=>[...current,entry]);setDrafts(current=>current.filter(x=>x.id!==d.id));setEditing(null)
   setMessage(language==='ro'?'Adăugat. Poți anula în următoarele 8 secunde.':'Added. You can undo for the next 8 seconds.')
   window.setTimeout(()=>setSaved(current=>current.filter(x=>x.id!==entry.id)),8000)
  }catch(e){setMessage(e instanceof Error?e.message:(language==='ro'?'Salvarea a eșuat.':'Save failed.'))}finally{setBusy(false)}
 }
 async function undo(entry:Saved){
  if(!supabase||!userId)return
  const {error}=await supabase.from(entry.table).delete().eq('id',entry.id).eq('user_id',userId)
  if(error){setMessage(error.message);return}
  setSaved(current=>current.filter(x=>x.id!==entry.id));setMessage(language==='ro'?'Ultima adăugare a fost anulată.':'The last addition was undone.')
 }
 function cancel(id:string){setDrafts(current=>current.filter(d=>d.id!==id));if(editing===id)setEditing(null)}
 function addTyped(){
  const parsed=parseTranscript(transcript,language)
  if(!parsed.length){setMessage(language==='ro'?'Nu am identificat o comandă. Încearcă „am băut un pahar cu apă” sau „am mâncat o plăcintă”.':'No command recognized. Try “I drank a glass of water” or “I had a piece of pie”.');return}
  setDrafts(current=>[...current,...parsed]);setTyped(false);setMessage('')
 }
 return <section className="panel voice-panel">
  <div className="voice-head"><div><h3>{language==='ro'?'Comenzi vocale':'Voice commands'}</h3><p>{language==='ro'?'Spune ce ai mâncat, câtă apă ai băut sau ce medicament vrei să programezi.':'Log a meal, water or schedule a medication by speaking.'}</p></div><button type="button" className={listening?'voice-mic listening':'voice-mic'} onClick={()=>listening?recognizer.current?.stop():start()} aria-label={listening?(language==='ro'?'Oprește ascultarea':'Stop listening'):(language==='ro'?'Pornește microfonul':'Start microphone')}><Mic size={19}/>{listening?(language==='ro'?'Ascult…':'Listening…'):(language==='ro'?'Vorbește':'Speak')}</button></div>
  <div className="voice-glass-setting"><label>{language==='ro'?'Volumul paharului tău (ml)':'Your glass size (ml)'}<input type="number" min="50" max="2000" step="10" value={glassMl} onChange={e=>setGlassMl(Number(e.target.value))}/></label><button type="button" className="outline-button" onClick={()=>void saveGlassSize()}>{language==='ro'?'Salvează':'Save'}</button></div>
  <p className="voice-transcript" aria-live="polite">{transcript|| (language==='ro'?'Transcrierea va apărea aici.':'Your live transcript will appear here.')}</p>
  <div className="voice-typed"><button type="button" className="outline-button" onClick={()=>setTyped(x=>!x)}><Type size={15}/>{language==='ro'?'Scrie comanda':'Type command'}</button>{typed&&<div><input value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder={language==='ro'?'Ex.: Am băut un pahar cu apă':'e.g. I drank a glass of water'}/><button type="button" className="outline-button" onClick={addTyped}>{language==='ro'?'Interpretează':'Parse'}</button></div>}</div>
  {drafts.map(d=><article className="voice-draft" key={d.id}><div className="voice-draft-head"><strong>{language==='ro'?'Verifică înainte de salvare':'Review before saving'} · {d.intent==='meal'?(language==='ro'?'Masă':'Meal'):d.intent==='water'?(language==='ro'?'Hidratare':'Water'):(language==='ro'?'Medicament':'Medication')}</strong><button type="button" onClick={()=>cancel(d.id)} aria-label="Cancel"><X size={16}/></button></div>
   {d.options&&<div className="voice-options"><p>{language==='ro'?'Alege alimentul potrivit:':'Choose the matching food:'}</p>{d.options.map(o=><button type="button" key={o} onClick={()=>updateDraft(d.id,{item:o,options:undefined})}>{o}</button>)}</div>}
   {d.uncertain&&<p className="voice-warning">{d.uncertain}</p>}
   {editing===d.id?<div className="voice-edit"><label>{language==='ro'?'Element':'Item'}<input value={d.item} onChange={e=>updateDraft(d.id,{item:e.target.value})}/></label><label>{language==='ro'?'Cantitate':'Amount'}<input value={d.amount} onChange={e=>updateDraft(d.id,{amount:e.target.value})}/></label>{d.intent==='medication'&&<><label>{language==='ro'?'Doză':'Dose'}<input value={d.dose} onChange={e=>updateDraft(d.id,{dose:e.target.value})}/></label><label>{language==='ro'?'Ora':'Time'}<input type="time" value={d.time} onChange={e=>updateDraft(d.id,{time:e.target.value})}/></label><label>{language==='ro'?'Repetare':'Repeat'}<input value={d.repeat} onChange={e=>updateDraft(d.id,{repeat:e.target.value})}/></label><label>{language==='ro'?'Data de început':'Start date'}<input type="date" value={d.date} onChange={e=>updateDraft(d.id,{date:e.target.value})}/></label></>}</div>:<dl><dt>{language==='ro'?'Element':'Item'}</dt><dd>{d.item||'—'}</dd><dt>{language==='ro'?'Cantitate':'Amount'}</dt><dd>{d.amount}</dd><dt>{language==='ro'?'Ora și data':'Time and date'}</dt><dd>{d.time} · {d.date}</dd><dt>{language==='ro'?'Repetare':'Repeat'}</dt><dd>{d.repeat||'O singură înregistrare'}</dd></dl>}
   <div className="voice-card-actions"><button type="button" onClick={()=>setEditing(editing===d.id?null:d.id)}><Pencil size={15}/>{language==='ro'?'Editează':'Edit'}</button><button type="button" disabled={busy||!!d.uncertain||!d.item||!d.amount||(d.intent==='medication'&&!d.time)} onClick={()=>void confirm(d)}><Check size={15}/>{language==='ro'?'Confirmă':'Confirm'}</button><button type="button" onClick={()=>cancel(d.id)}><X size={15}/>{language==='ro'?'Anulează':'Cancel'}</button></div>
  </article>)}
  {saved.map(s=><div className="voice-added" key={s.id}><span>{language==='ro'?'Adăugat: ':'Added: '}{s.label}</span><button type="button" onClick={()=>void undo(s)}><Undo2 size={15}/>Undo</button></div>)}
  {message&&<p className="calorie-message" role="status">{message}</p>}
 </section>
}
