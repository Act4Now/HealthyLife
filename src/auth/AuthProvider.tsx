import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Profile = {
  id: string
  display_name: string | null
  locale: string
  timezone: string
  onboarding_completed_at: string | null
  onboarding_skipped_at: string | null
  has_daily_targets: boolean
  preferences?: {
    locale?: string
    theme?: 'light' | 'dark' | 'auto'
    text_size?: 'normal' | 'large'
    weight_unit?: 'kg' | 'lb'
    height_unit?: 'cm' | 'ft'
    dashboard_widgets?: string[]
  } | null
}

type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function refreshProfile() {
    if (!supabase?.auth.getUser) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, locale, timezone, onboarding_completed_at, onboarding_skipped_at, preferences')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!data) { setProfile(null); return }
    const { data: targetRows, error: targetsError } = await supabase
      .from('daily_targets')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
    setProfile({ ...(data as Omit<Profile, 'has_daily_targets'>), has_daily_targets: !targetsError && (targetRows?.length ?? 0) > 0 })
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) {
        try { await refreshProfile() } catch (error) { console.error('Profile load failed', error) }
      }
      if (active) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setProfile(null)
      else queueMicrotask(() => { void refreshProfile().catch(error => console.error('Profile load failed', error)) })
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    profile,
    signIn: async (email, password) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signUp: async (email, password, displayName) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw error
    },
    signOut: async () => {
      if (!supabase) return
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    refreshProfile,
  }), [loading, session, profile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
