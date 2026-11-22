import { useState } from 'react'
import type { FormEvent } from 'react'
import { Leaf, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthProvider'

export default function AuthPanel() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'signup') await signUp(email, password, displayName.trim())
      else await signIn(email, password)
      setMessage(mode === 'signup'
        ? 'Cont creat. Verifică e-mailul pentru confirmare, dacă aceasta este activată.'
        : 'Autentificare reușită.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A apărut o eroare. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span><Leaf size={24} /></span><div><strong>HealthyLife AI</strong><small>WELLNESS COMPANION</small></div></div>
      <h1>{mode === 'signin' ? 'Bine ai revenit!' : 'Creează-ți profilul'}</h1>
      <p className="auth-subtitle">{mode === 'signin' ? 'Autentifică-te pentru a accesa datele profilului tău.' : 'Un cont separat pentru progresul și istoricul tău.'}</p>
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <label>Nume afișat<input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" required maxLength={80} /></label>}
        <label>Adresă de e-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Parolă<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required /></label>
        <button type="submit" disabled={busy}>{busy ? 'Se procesează…' : mode === 'signin' ? 'Autentificare' : 'Creează cont'}</button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>
        {mode === 'signin' ? 'Nu ai cont? Creează unul' : 'Ai deja cont? Autentifică-te'}
      </button>
      <div className="auth-privacy"><ShieldCheck size={16} /> Datele fiecărui profil sunt izolate prin politici Row Level Security.</div>
    </section>
  </main>
}
