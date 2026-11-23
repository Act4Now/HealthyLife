import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, CircleHelp, Droplets, Heart, Languages, Leaf, Salad, Settings, ShieldCheck, TrendingDown, Utensils } from 'lucide-react'
import { useAuth } from './auth/AuthProvider'
import AuthPanel from './auth/AuthPanel'
import MealCalorieTracker from './meals/MealCalorieTracker'
import WellnessTracker from './wellness/WellnessTracker'
import HistoryTracker from './history/HistoryTracker'
import RecipeGenerator from './recipes/RecipeGenerator'
import PersonalGoals from './goals/PersonalGoals'
import UserPreferences from './settings/UserPreferences'
import PlannerAndProgress from './planner/PlannerAndProgress'
import VoiceAssistant from './VoiceAssistant'
import TodayOverview from './dashboard/TodayOverview'
import { supabase } from './lib/supabase'

type Language = 'ro' | 'en'

const copy = {
  ro: {
    overview: 'Rezumatul zilei', medication: 'Medicamente', hydration: 'Hidratare',
    meals: 'Mesele mele', weight: 'Greutate', history: 'Istoric', recipes: 'Rețete', planner: 'Planificator',
    settings: 'Setări', help: 'Ajutor', menu: 'Meniu',
    welcome: 'Bun venit la HealthyLife', subtitle: 'Datele tale vor apărea aici după ce înregistrezi primele activități.',
    emptyTitle: 'Nu există încă înregistrări pentru astăzi',
    emptyText: 'Nu afișăm valori demonstrative. Adaugă apă, mese, medicamente sau măsurători în modulele de mai jos, iar rezumatul va reflecta doar datele salvate în contul tău.',
    privacy: 'Datele personale sunt afișate doar după autentificare.',
    helpText: 'Alege un modul din meniul lateral. Înregistrările salvate în cont vor apărea în Istoric.',
    footer: 'HealthyLife · v2.1.0',
    offline: 'Ești offline. Poți vedea aplicația, dar datele nu se pot încărca sau salva până revii online.',
  },
  en: {
    overview: "Today's overview", medication: 'Medication', hydration: 'Hydration',
    meals: 'My meals', weight: 'Weight', history: 'History', recipes: 'Recipes', planner: 'Planner',
    settings: 'Settings', help: 'Help', menu: 'Menu',
    welcome: 'Welcome to HealthyLife', subtitle: 'Your data will appear here after you record your first activities.',
    emptyTitle: 'No entries recorded for today yet',
    emptyText: 'We do not show demonstration values. Add water, meals, medication or measurements in the modules below; the overview will reflect only data saved to your account.',
    privacy: 'Personal data is shown only after you sign in.',
    helpText: 'Choose a module from the sidebar. Entries saved to your account will appear in History.',
    footer: 'HealthyLife · v2.1.0',
    offline: 'You are offline. You can open the app, but data cannot load or save until you are back online.',
  },
}

function Dashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [lang, setLang] = useState<Language>((auth.profile?.locale === 'en' ? 'en' : 'ro'))
  const [active, setActive] = useState('dashboard')
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const t = copy[lang]

  // Re-apply saved theme, text size and language every time the profile loads.
  useEffect(() => {
    const prefs = auth.profile?.preferences
    if (!prefs) return
    document.documentElement.dataset.theme = prefs.theme ?? 'auto'
    document.documentElement.dataset.textSize = prefs.text_size ?? 'normal'
    if (prefs.locale === 'en' || prefs.locale === 'ro') setLang(prefs.locale)
  }, [auth.profile?.preferences])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Persist the language chosen with the header button so it survives a reload.
  async function changeLanguage(next: Language) {
    setLang(next)
    if (!supabase || !auth.user) return
    const merged = { ...(auth.profile?.preferences ?? {}), locale: next }
    await supabase.from('profiles').update({ locale: next, preferences: merged }).eq('id', auth.user.id)
  }
  const date = useMemo(() => new Intl.DateTimeFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date()), [lang])

  const nav = [
    { id: 'dashboard', label: t.overview, icon: Activity },
    { id: 'medication', label: t.medication, icon: Heart },
    { id: 'hydration', label: t.hydration, icon: Droplets },
    { id: 'meals', label: t.meals, icon: Utensils },
    { id: 'recipes', label: t.recipes, icon: Salad },
    { id: 'planner', label: t.planner, icon: CalendarDays },
    { id: 'weight', label: t.weight, icon: TrendingDown },
    { id: 'history', label: t.history, icon: CalendarDays },
  ]
  const selectedTitle = nav.find(item => item.id === active)?.label ?? t.overview

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#dashboard" onClick={() => setActive('dashboard')}>
        <span className="brand-mark"><Leaf size={22} /></span>
        <span><strong>HealthyLife</strong><small>WELLNESS COMPANION</small></span>
      </a>
      <div className="profile-mini">
        <div className="avatar"><Leaf size={17} /></div>
        <div><strong>{auth.profile?.display_name || 'HealthyLife'}</strong><small>{auth.user?.email || t.privacy}</small></div>
        <button className="icon-button" aria-label={t.settings} title={t.settings} onClick={() => setActive('settings')}><Settings size={17} /></button>
      </div>
      <p className="nav-label">{t.menu}</p>
      <nav className="side-nav">
        {nav.map(item => {
          const Icon = item.icon
          return <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item.id)}>
            <Icon size={18} /><span>{item.label}</span>
          </button>
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className="support-card" type="button" onClick={() => setActive('help')}><CircleHelp size={18} /><strong>{t.help}</strong></button>
        <div className="privacy-note"><ShieldCheck size={16} /><span>{t.privacy}</span></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><Leaf size={20} /> HealthyLife</div>
        <div className="date-label"><CalendarDays size={16} />{date}</div>
        <div className="top-actions">
          <button className="language-button" onClick={() => void changeLanguage(lang === 'ro' ? 'en' : 'ro')}><Languages size={17} />{lang.toUpperCase()}</button>
          {auth.user && <button className="language-button" onClick={() => void auth.signOut()}>{lang === 'ro' ? 'Ieșire' : 'Sign out'}</button>}
        </div>
      </header>

      {!online && <p className="offline-banner" role="status">{t.offline}</p>}

      <section className="welcome">
        <div><p className="eyebrow">{date}</p><h1>{t.welcome}</h1><p>{t.subtitle}</p></div>
      </section>

      {auth.user && auth.profile && (!auth.profile.onboarding_completed_at || !auth.profile.has_daily_targets) && !auth.profile.onboarding_skipped_at && <PersonalGoals userId={auth.user.id} onboarding onComplete={() => void auth.refreshProfile()} onSkip={() => void auth.refreshProfile()} />}

      <div className="section-heading">
        <div><h2>{active === 'dashboard' ? t.overview : selectedTitle}</h2><p>{date}</p></div>
        <button className="outline-button" onClick={() => setActive('history')}><CalendarDays size={16}/>{t.history}</button>
      </div>

      {active === 'dashboard' ? <><VoiceAssistant userId={auth.user?.id} language={lang}/><TodayOverview userId={auth.user?.id} language={lang} widgets={auth.profile?.preferences?.dashboard_widgets} weightUnit={auth.profile?.preferences?.weight_unit} onNavigate={setActive}/></> : active === 'meals' ? <MealCalorieTracker userId={auth.user?.id}/> : active === 'history' ? <HistoryTracker userId={auth.user?.id}/> : active === 'recipes' ? <RecipeGenerator/> : active === 'planner' ? <PlannerAndProgress userId={auth.user?.id}/> : active === 'hydration' || active === 'medication' || active === 'weight' ? <WellnessTracker module={active as 'hydration'|'medication'|'weight'} userId={auth.user?.id}/> : active === 'settings' ? <><UserPreferences userId={auth.user?.id} email={auth.user?.email ?? ''} onLanguageChange={setLang} onSaved={() => void auth.refreshProfile()} language={lang}/><PersonalGoals userId={auth.user?.id} onComplete={() => void auth.refreshProfile()}/></> : <section className="panel placeholder-panel"><div className="placeholder-icon"><CircleHelp size={25}/></div><h3>{t.help}</h3><p>{t.helpText}</p></section>}

      <footer className="footer-note"><ShieldCheck size={15}/>{t.privacy}<span>{t.footer}</span></footer>
    </main>
  </div>
}

export default function App() {
  const auth = useAuth()
  if (auth.loading) return <main className="auth-screen"><div className="auth-card">Se încarcă profilul…</div></main>
  if (auth.configured && !auth.user) return <AuthPanel/>
  return <Dashboard auth={auth}/>
}
