import { useMemo, useState } from 'react'
import {
  Activity, Bell, CalendarDays, Check, ChevronRight, CircleHelp, Droplets,
  Heart, Languages, Leaf, Plus, Salad, Settings, ShieldCheck, Sparkles,
  Target, TrendingDown, Utensils, Weight
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useAuth } from './auth/AuthProvider'
import AuthPanel from './auth/AuthPanel'
import MealCalorieTracker from './meals/MealCalorieTracker'
import WellnessTracker from './wellness/WellnessTracker'
import HistoryTracker from './history/HistoryTracker'
import RecipeGenerator from './recipes/RecipeGenerator'
import PersonalGoals from './goals/PersonalGoals'
import UserPreferences from './settings/UserPreferences'

type Language = 'ro' | 'en'
type Task = { id: number; label: string; time: string; done: boolean; kind: 'medicine' | 'meal' }

const copy = {
  ro: {
    greeting: 'Bună dimineața!', subtitle: 'Pași mici. Obiceiuri mai bune. Progres real.',
    today: 'Astăzi', overview: 'Rezumatul zilei', progress: 'Progres zilnic',
    medication: 'Medicamente', hydration: 'Hidratare', meals: 'Mesele mele',
    weight: 'Greutate', history: 'Istoric', recipes: 'Rețete AI',
    waterGoal: 'Obiectiv zilnic', nextMeal: 'Următoarea masă', quick: 'Adaugă rapid',
    tipTitle: 'Inspirația zilei', tip: 'Alege consecvența, nu perfecțiunea. O alegere bună contează.',
    weightChange: 'față de ultima înregistrare',
    demo: 'Demo interactiv — nu introduce date medicale reale.',
    nav: 'Meniu', settings: 'Setări', help: 'Ajutor', greetingName: 'Prieten',
    lunch: 'Prânz',
  },
  en: {
    greeting: 'Good morning!', subtitle: 'Small steps. Better habits. Real progress.',
    today: 'Today', overview: 'Today at a glance', progress: 'Daily progress',
    medication: 'Medication', hydration: 'Hydration', meals: 'My meals',
    weight: 'Weight', history: 'History', recipes: 'AI Recipes',
    waterGoal: 'Daily goal', nextMeal: 'Next meal', quick: 'Quick add',
    tipTitle: 'Daily inspiration', tip: 'Choose consistency over perfection. One good choice matters.',
    weightChange: 'since last entry',
    demo: 'Interactive demo — do not enter real health data.',
    nav: 'Menu', settings: 'Settings', help: 'Help', greetingName: 'Friend',
    lunch: 'Lunch',
  },
}

const initialTasks: Task[] = [
  { id: 1, label: 'Vitamin D · 1 tablet', time: '08:00', done: true, kind: 'medicine' },
  { id: 2, label: 'Breakfast', time: '08:30', done: true, kind: 'meal' },
  { id: 3, label: 'Medication · prescribed dose', time: '12:00', done: false, kind: 'medicine' },
  { id: 4, label: 'Lunch', time: '13:00', done: false, kind: 'meal' },
]

function Dashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [lang, setLang] = useState<Language>('ro')
  const [water, setWater] = useState(1250)
  const [tasks, setTasks] = useState(initialTasks)
  const [active, setActive] = useState('dashboard')
  const t = copy[lang]
  const completed = tasks.filter(task => task.done).length
  const progress = Math.round((completed / tasks.length) * 100)
  const waterPercent = Math.min(100, Math.round((water / 2000) * 100))
  const date = useMemo(
    () => new Intl.DateTimeFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date()),
    [lang],
  )

  const nav = [
    { id: 'dashboard', label: t.overview, icon: Activity },
    { id: 'medication', label: t.medication, icon: Heart },
    { id: 'hydration', label: t.hydration, icon: Droplets },
    { id: 'meals', label: t.meals, icon: Utensils },
    { id: 'recipes', label: t.recipes, icon: Salad },
    { id: 'weight', label: t.weight, icon: TrendingDown },
    { id: 'history', label: t.history, icon: CalendarDays },
  ]
  const selectedTitle = nav.find(item => item.id === active)?.label ?? t.overview

  function toggleTask(id: number) {
    setTasks(current => current.map(task => task.id === id ? { ...task, done: !task.done } : task))
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#dashboard" onClick={() => setActive('dashboard')}>
        <span className="brand-mark"><Leaf size={22} /></span>
        <span><strong>HealthyLife</strong><small>WELLNESS COMPANION</small></span>
      </a>
      <div className="profile-mini">
        <div className="avatar">A</div>
        <div><strong>{auth.profile?.display_name || t.greetingName}</strong><small>{auth.configured ? auth.user?.email : 'Demo profile'}</small></div>
        <button className="icon-button" aria-label={t.settings} title={t.settings} onClick={() => setActive("settings")}><Settings size={17} /></button>
      </div>
      <p className="nav-label">{t.nav}</p>
      <nav className="side-nav">
        {nav.map(item => {
          const Icon = item.icon
          return <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item.id)}>
            <Icon size={18} /><span>{item.label}</span>{active === item.id && <ChevronRight size={16} />}
          </button>
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className="support-card" type="button" onClick={() => setActive("help")}><CircleHelp size={18} /><strong>{t.help}</strong><span>?</span></button>
        <div className="privacy-note"><ShieldCheck size={16} /><span>{lang === 'ro' ? 'Demo fără date personale' : 'Demo — no personal data'}</span></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><Leaf size={20} /> HealthyLife</div>
        <div className="date-label"><CalendarDays size={16} />{date}</div>
        <div className="top-actions">
          {!auth.configured && <span className="demo-pill"><span /> DEMO</span>}
          <button className="language-button" onClick={() => setLang(lang === 'ro' ? 'en' : 'ro')}><Languages size={17} />{lang.toUpperCase()}</button>
          <button className="icon-button notification-button" aria-label="Medicamente" title="Medicamente" onClick={() => setActive("medication")}><Bell size={18} /></button>
          {auth.configured && auth.user ? <button className="language-button" onClick={() => void auth.signOut()}>Ieșire</button> : <div className="avatar small">A</div>}
        </div>
      </header>

      <section className="welcome">
        <div><p className="eyebrow">{t.today} · {date}</p><h1>{t.greeting} <span>✦</span></h1><p>{t.subtitle}</p></div>
        <div className="welcome-art"><div className="sun-orb" /><div className="leaf-shape one" /><div className="leaf-shape two" /><div className="art-caption">one day at a time</div></div>
      </section>

      <div className="section-heading">
        <div><h2>{active === 'dashboard' ? t.overview : selectedTitle}</h2><p>{t.progress}</p></div>
        <button className="outline-button" onClick={() => setActive("history")}><CalendarDays size={16} />{t.history}</button>
      </div>

      {active === 'dashboard' ? <>
        <section className="stats-grid">
          <article className="stat-card progress-card">
            <div className="stat-top"><span>{t.progress}</span><Target size={18} /></div>
            <div className="progress-layout">
              <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><strong>{progress}%</strong></div>
              <div><strong className="stat-number">{completed}<small>/{tasks.length}</small></strong><p>{lang === 'ro' ? 'obiective bifate' : 'tasks completed'}</p></div>
            </div>
            <div className="progress-foot"><span>{lang === 'ro' ? 'Continuă în ritmul tău' : 'Keep your own pace'}</span><Sparkles size={15} /></div>
          </article>
          <article className="stat-card">
            <div className="stat-top"><span>{t.hydration}</span><Droplets size={18} /></div>
            <strong className="stat-number">{(water / 1000).toFixed(2)}<small> L</small></strong>
            <p>{t.waterGoal}: 2.00 L</p>
            <div className="bar"><span style={{ width: `${waterPercent}%` }} /></div>
            <small className="muted">{waterPercent}% · {Math.max(0, 2000 - water)} ml {lang === 'ro' ? 'rămași' : 'left'}</small>
          </article>
          <article className="stat-card">
            <div className="stat-top"><span>{t.medication}</span><Heart size={18} /></div>
            <strong className="stat-number">{tasks.filter(x => x.kind === 'medicine' && x.done).length}<small>/2</small></strong>
            <p>{lang === 'ro' ? 'administrări confirmate' : 'doses confirmed'}</p>
            <div className="mini-status"><span className="status-dot" />{lang === 'ro' ? 'Următoarea: 12:00' : 'Next: 12:00'}</div>
          </article>
          <article className="stat-card">
            <div className="stat-top"><span>{t.weight}</span><Weight size={18} /></div>
            <strong className="stat-number">74.8<small> kg</small></strong>
            <p>{lang === 'ro' ? 'Ultima înregistrare · demo' : 'Last entry · demo'}</p>
            <div className="mini-status positive"><TrendingDown size={15} />−0.4 kg {t.weightChange}</div>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel routine-panel">
            <div className="panel-heading">
              <div><h3>{lang === 'ro' ? 'Rutina de astăzi' : "Today's routine"}</h3><p>{lang === 'ro' ? 'Medicamente și mese programate' : 'Scheduled medication and meals'}</p></div>
              <button className="text-button" onClick={() => setActive('medication')}>{lang === 'ro' ? 'Vezi tot' : 'View all'} <ChevronRight size={16} /></button>
            </div>
            <div className="task-list">
              {tasks.map(task => <div className={task.done ? 'task-row task-done' : 'task-row'} key={task.id}>
                <div className={task.kind === 'medicine' ? 'task-icon medicine-icon' : 'task-icon meal-icon'}>{task.kind === 'medicine' ? <Heart size={17} /> : <Utensils size={17} />}</div>
                <div className="task-info"><strong>{task.label}</strong><small>{task.time} · {task.kind === 'medicine' ? t.medication : t.meals}</small></div>
                <button className={task.done ? 'check-button checked' : 'check-button'} onClick={() => toggleTask(task.id)} aria-label={task.done ? 'Undo' : 'Complete'}>{task.done ? <Check size={17} /> : <Plus size={17} />}</button>
              </div>)}
            </div>
          </article>
          <article className="panel water-panel">
            <div className="panel-heading"><div><h3>{t.hydration}</h3><p>{lang === 'ro' ? 'Fiecare pahar contează' : 'Every glass counts'}</p></div><Droplets size={20} className="water-color" /></div>
            <div className="water-visual">
              <div className="water-glass"><div className="water-fill" style={{ height: `${waterPercent}%` }} /><Droplets size={29} /></div>
              <div><strong>{water.toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB')} <small>ml</small></strong><p>{lang === 'ro' ? 'din 2.000 ml' : 'of 2,000 ml'}</p></div>
            </div>
            <div className="water-actions"><span>{t.quick}</span><div>{[150, 250, 500].map(amount => <button key={amount} onClick={() => setWater(v => v + amount)}>+{amount} ml</button>)}</div></div>
          </article>
        </section>

        <section className="bottom-grid">
          <article className="panel meal-panel">
            <div className="panel-heading"><div><h3>{t.nextMeal}</h3><p>{lang === 'ro' ? 'Planifică mese echilibrate' : 'Plan balanced meals'}</p></div><Utensils size={19} /></div>
            <div className="meal-feature"><div className="meal-emoji">🥗</div><div><span className="meal-time">13:00 · {t.lunch}</span><strong>{lang === 'ro' ? 'Bol mediteranean cu năut' : 'Mediterranean chickpea bowl'}</strong><small>{lang === 'ro' ? 'Năut · legume · dressing de iaurt' : 'Chickpeas · vegetables · yogurt dressing'}</small></div><ChevronRight size={18} /></div>
            <button className="full-button" onClick={() => setActive('recipes')}><Sparkles size={16} />{lang === 'ro' ? 'Descoperă rețete' : 'Explore recipes'}</button>
          </article>
          <article className="inspiration-card"><div className="inspiration-icon"><Leaf size={20} /></div><p>{t.tipTitle}</p><h3>“{t.tip}”</h3><span>— HealthyLife</span><div className="inspiration-decoration">✳</div></article>
        </section>
      </> : active === 'meals' ? <MealCalorieTracker userId={auth.user?.id} /> : active === 'history' ? <HistoryTracker userId={auth.user?.id} /> : active === 'recipes' ? <RecipeGenerator /> : active === 'hydration' || active === 'medication' || active === 'weight' ? <WellnessTracker module={active as 'hydration' | 'medication' | 'weight'} userId={auth.user?.id} /> : active === 'settings' ? <><UserPreferences userId={auth.user?.id} email={auth.user?.email ?? ''} onLanguageChange={setLang} language={lang}/><PersonalGoals userId={auth.user?.id}/></> : active === 'help' ? <section className="panel placeholder-panel"><div className="placeholder-icon"><CircleHelp size={25}/></div><h3>{t.help}</h3><p>{lang === 'ro' ? 'Alege un modul din meniul lateral. Folosește Istoric pentru a selecta o zi și a consulta înregistrările salvate în profil. Pentru date personale, autentifică-te.' : 'Choose a module from the sidebar. Use History to select a day and review entries saved to your profile. Sign in to use personal data.'}</p><button className="outline-button" onClick={() => setActive('history')}><CalendarDays size={16}/>{t.history}</button></section> : <section className="panel placeholder-panel">
        <div className="placeholder-icon"><Sparkles size={25} /></div><h3>{selectedTitle}</h3>
        <p>{lang === 'ro' ? 'Acest modul este inclus în planul MVP și va fi dezvoltat în următoarea etapă.' : 'This module is included in the MVP plan and will be developed in the next iteration.'}</p>
        <span className="coming-soon">{lang === 'ro' ? 'În dezvoltare' : 'Coming next'}</span>
      </section>}

      <footer className="footer-note"><ShieldCheck size={15} />{t.demo}<span>HealthyLife · v2.0.0</span></footer>
    </main>
  </div>
}


export default function App() {
  const auth = useAuth()
  if (auth.loading) return <main className="auth-screen"><div className="auth-card">Se încarcă profilul…</div></main>
  if (auth.configured && !auth.user) return <AuthPanel />
  return <Dashboard auth={auth} />
}
