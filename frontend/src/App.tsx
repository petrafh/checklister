import { Copy, Download, LogOut, Moon, Sun, Upload, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import darkBackground from './assets/darkmode-background.jpg'
import lightBackground from './assets/lightmode-background.jpg'

type ChecklistItem = {
  id: string
  text: string
  done: boolean
}

type Checklist = {
  id: string
  title: string
  items: ChecklistItem[]
}

type ChecklistItemPayload = {
  id?: string
  text: string
  done: boolean
}

type UserAccount = {
  id: string
  name: string
  email: string
  createdAt: string
  updatedAt: string
  syncCode: string
}

const THEME_KEY = 'checklister:theme'
const TOKEN_KEY = 'checklister:token'
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

const computeTheme = (): 'dark' | 'light' => {
  const hour = new Date().getHours()
  return hour >= 17 || hour < 8 ? 'dark' : 'light'
}

const loadTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') {
    return computeTheme()
  }
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') {
    return stored
  }
  return computeTheme()
}

const parseError = async (response: Response) => {
  try {
    const data = await response.json()
    if (data?.error) {
      return data.error as string
    }
  } catch {
    /* ignore */
  }
  return response.statusText || 'Request failed'
}

function App() {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null,
  )
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [prefillItems, setPrefillItems] = useState('')
  const [draftItems, setDraftItems] = useState<Record<string, string>>({})
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [syncCopied, setSyncCopied] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isDarkMode = theme === 'dark'

  const buildUrl = (path: string) => `${API_BASE_URL}${path}`

  const callApi = async <T,>(path: string, options: RequestInit = {}, requiresAuth = false) => {
    if (requiresAuth && !token) {
      throw new Error('Please sign in to continue.')
    }
    const headers = new Headers(options.headers)
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    headers.set('Accept', 'application/json')
    if (requiresAuth && token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    const response = await fetch(buildUrl(path), {
      ...options,
      headers,
    })
    if (!response.ok) {
      throw new Error(await parseError(response))
    }
    if (response.status === 204) {
      return null as T
    }
    return (await response.json()) as T
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = theme
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme)
    }
  }, [theme])

  useEffect(() => {
    if (!token) {
      setSessionReady(true)
      return
    }
    setSessionReady(false)
    let cancelled = false
    const fetchProfile = async () => {
      try {
        const data = await callApi<{ user: UserAccount; checklists: Checklist[] }>(
          '/me',
          { method: 'GET' },
          true,
        )
        if (!cancelled) {
          setCurrentUser(data.user)
          setChecklists(data.checklists ?? [])
          setActionError(null)
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setCurrentUser(null)
          setChecklists([])
          setToken(null)
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(TOKEN_KEY)
          }
        }
      } finally {
        if (!cancelled) {
          setSessionReady(true)
        }
      }
    }
    fetchProfile()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!currentUser) return
    setProfileForm({ name: currentUser.name, email: currentUser.email })
  }, [currentUser])

  const stats = useMemo(() => {
    const totalItems = checklists.reduce((sum, list) => sum + list.items.length, 0)
    const completedItems = checklists.reduce(
      (sum, list) => sum + list.items.filter((item) => item.done).length,
      0,
    )
    return { totalItems, completedItems }
  }, [checklists])

  const accountStats = useMemo(() => {
    const totalLists = checklists.length
    const completedLists = checklists.filter((list) => list.items.every((item) => item.done)).length
    return { totalLists, completedLists }
  }, [checklists])

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError(null)
    try {
      const email = authForm.email.trim().toLowerCase()
      const password = authForm.password.trim()
      if (!email || !password) {
        setAuthError('Email and password are required.')
        return
      }
      const body =
        authMode === 'signup'
          ? { name: authForm.name.trim() || 'New teammate', email, password }
          : { email, password }
      const data = await callApi<{ token: string; user: UserAccount; checklists: Checklist[] }>(
        authMode === 'login' ? '/auth/login' : '/auth/signup',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      )
      setToken(data.token)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_KEY, data.token)
      }
      setCurrentUser(data.user)
      setChecklists(data.checklists ?? [])
      setAuthForm({ name: '', email: '', password: '' })
      setActionError(null)
    } catch (error) {
      console.error(error)
      setAuthError(error instanceof Error ? error.message : 'Unable to authenticate.')
    }
  }

  const handleCreateChecklist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUser) return
    const title = newTitle.trim()
    if (!title) return
    const items = prefillItems
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: false }))
    try {
      const data = await callApi<{ checklist: Checklist }>(
        '/checklists',
        {
          method: 'POST',
          body: JSON.stringify({ title, items }),
        },
        true,
      )
      setChecklists((previous) => [data.checklist, ...previous])
      setNewTitle('')
      setPrefillItems('')
      setActionError(null)
    } catch (error) {
      console.error(error)
      setActionError(error instanceof Error ? error.message : 'Unable to save checklist.')
    }
  }

  const updateChecklistItems = async (listId: string, items: ChecklistItemPayload[]) => {
    try {
      const data = await callApi<{ checklist: Checklist }>(
        `/checklists/${listId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ items }),
        },
        true,
      )
      setChecklists((previous) => previous.map((list) => (list.id === listId ? data.checklist : list)))
      setActionError(null)
    } catch (error) {
      console.error(error)
      setActionError(error instanceof Error ? error.message : 'Update failed.')
    }
  }

  const handleAddItem = async (listId: string) => {
    if (!currentUser) return
    const text = draftItems[listId]?.trim()
    if (!text) return
    const target = checklists.find((list) => list.id === listId)
    if (!target) return
    const nextItems: ChecklistItemPayload[] = [
      ...target.items.map((item) => ({ id: item.id, text: item.text, done: item.done })),
      { text, done: false },
    ]
    await updateChecklistItems(listId, nextItems)
    setDraftItems((prev) => ({ ...prev, [listId]: '' }))
  }

  const handleToggleItem = async (listId: string, itemId: string) => {
    if (!currentUser) return
    const target = checklists.find((list) => list.id === listId)
    if (!target) return
    const nextItems: ChecklistItemPayload[] = target.items.map((item) => ({
      id: item.id,
      text: item.text,
      done: item.id === itemId ? !item.done : item.done,
    }))
    await updateChecklistItems(listId, nextItems)
  }

  const handleDeleteItem = async (listId: string, itemId: string) => {
    if (!currentUser) return
    const target = checklists.find((list) => list.id === listId)
    if (!target) return
    const nextItems: ChecklistItemPayload[] = target.items
      .filter((item) => item.id !== itemId)
      .map((item) => ({ id: item.id, text: item.text, done: item.done }))
    await updateChecklistItems(listId, nextItems)
  }

  const handleDeleteChecklist = async (listId: string) => {
    if (!currentUser) return
    try {
      await callApi(`/checklists/${listId}`, { method: 'DELETE' }, true)
      setChecklists((previous) => previous.filter((list) => list.id !== listId))
      setActionError(null)
    } catch (error) {
      console.error(error)
      setActionError(error instanceof Error ? error.message : 'Unable to delete checklist.')
    }
  }

  const handleClearCompleted = async (listId: string) => {
    if (!currentUser) return
    const target = checklists.find((list) => list.id === listId)
    if (!target) return
    const nextItems: ChecklistItemPayload[] = target.items
      .filter((item) => !item.done)
      .map((item) => ({ id: item.id, text: item.text, done: item.done }))
    await updateChecklistItems(listId, nextItems)
  }

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUser) return
    try {
      const payload = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim().toLowerCase(),
      }
      const data = await callApi<{ user: UserAccount }>(
        '/me',
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
        true,
      )
      setCurrentUser(data.user)
      setProfileMessage('Profile updated')
      setTimeout(() => setProfileMessage(null), 2000)
    } catch (error) {
      console.error(error)
      setProfileMessage(error instanceof Error ? error.message : 'Unable to update profile.')
    }
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY)
    }
    setToken(null)
    setCurrentUser(null)
    setChecklists([])
    setNewTitle('')
    setPrefillItems('')
    setDraftItems({})
    setProfileOpen(false)
  }

  const syncPayload = currentUser
    ? JSON.stringify(
        {
          version: 2,
          exportedAt: new Date().toISOString(),
          user: currentUser,
          checklists,
        },
        null,
        2,
      )
    : ''

  const handleCopySync = async () => {
    if (!syncPayload) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(syncPayload)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = syncPayload
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setSyncCopied(true)
      window.setTimeout(() => setSyncCopied(false), 2000)
    } catch {
      setImportError('Copy failed. Manually select the text below.')
    }
  }

  const handleDownloadBackup = () => {
    if (!syncPayload || typeof window === 'undefined') return
    const blob = new Blob([syncPayload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `checklister-${(currentUser?.name || 'workspace').toLowerCase().replace(/\s+/g, '-')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImportData = async () => {
    if (!currentUser) return
    setImportError(null)
    if (!importValue.trim()) {
      setImportError('Paste a backup JSON payload first.')
      return
    }
    try {
      const parsed = JSON.parse(importValue)
      const payload = Array.isArray(parsed)
        ? parsed
        : parsed.checklists ?? parsed.user?.checklists ?? []
      if (!Array.isArray(payload)) {
        throw new Error('Invalid payload')
      }
      const data = await callApi<{ checklists: Checklist[] }>(
        '/checklists',
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
        true,
      )
      setChecklists(data.checklists ?? [])
      setImportValue('')
      setProfileMessage('Lists imported')
      setTimeout(() => setProfileMessage(null), 2000)
    } catch (error) {
      console.error(error)
      setImportError(error instanceof Error ? error.message : 'Backup could not be parsed.')
    }
  }

  const shellClass = `mx-auto w-full max-w-5xl rounded-[40px] border p-4 shadow-glass sm:p-10 ${
    isDarkMode
      ? 'border-white/15 bg-slate-900/70 text-slate-100 backdrop-blur-[36px]'
      : 'border-slate-900/10 bg-white/80 text-slate-900 backdrop-blur-[16px]'
  }`
  const badgeClass = `inline-flex items-center gap-3 rounded-full px-5 py-2 text-sm ring-1 ${
    isDarkMode ? 'bg-white/5 text-slate-200 ring-white/10' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  }`
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500'
  const secondaryText = isDarkMode ? 'text-slate-300' : 'text-slate-600'
  const labelText = isDarkMode ? 'text-slate-200' : 'text-slate-700'
  const panelClass = `rounded-3xl border p-6 shadow-glass ${
    isDarkMode ? 'border-white/10 bg-white/10' : 'border-slate-900/10 bg-white/90'
  }`
  const emptyStateClass = `rounded-3xl border border-dashed p-10 text-center ${
    isDarkMode ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-900/15 bg-white/85 text-slate-500'
  }`
  const checklistCardClass = `relative overflow-hidden rounded-3xl border p-6 shadow-glass ${
    isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-900/10 bg-white/90'
  }`
  const listItemClass = `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
    isDarkMode ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-900/5 bg-white text-slate-800'
  }`
  const inputClass = `mt-2 w-full rounded-2xl border px-4 py-3 text-base focus:outline-none focus:ring-2 ${
    isDarkMode
      ? 'border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:ring-emerald-400/40'
      : 'border-slate-900/10 bg-white text-slate-900 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-emerald-400/40'
  }`
  const addInputClass = `flex-1 min-w-0 rounded-2xl border px-4 py-3 text-base focus:outline-none focus:ring-2 ${
    isDarkMode
      ? 'border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-300 focus:ring-sky-300/40'
      : 'border-slate-900/10 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-300/50'
  }`
  const addButtonClass = `rounded-2xl border px-5 text-sm font-medium transition ${
    isDarkMode
      ? 'border-white/10 bg-white/10 text-white hover:bg-white/20'
      : 'border-emerald-500/20 bg-emerald-500/90 text-white hover:bg-emerald-500'
  }`
  const checkboxClass = `h-4 w-4 rounded border text-emerald-300 accent-emerald-300 ${
    isDarkMode ? 'border-white/30 bg-transparent' : 'border-emerald-200 bg-white text-emerald-500 accent-emerald-500'
  }`
  const removeButtonClass = `text-xs uppercase tracking-wide transition ${
    isDarkMode ? 'text-slate-400 hover:text-rose-200' : 'text-slate-500 hover:text-rose-500'
  }`
  const clearButtonClass = `mt-3 text-xs uppercase tracking-[0.3em] underline-offset-4 ${
    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-emerald-600'
  }`
  const progressTrackClass = `h-2 rounded-full ${
    isDarkMode ? 'bg-white/10' : 'bg-emerald-50'
  }`
  const progressFillClass = `h-full rounded-full transition-all ${
    isDarkMode ? 'bg-emerald-300' : 'bg-emerald-500'
  }`
  const toggleButtonClass = `rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
    isDarkMode
      ? 'border-white/15 text-slate-100 hover:bg-white/10'
      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
  }`
  const primaryButtonClass = `mt-6 w-full rounded-2xl px-4 py-3 text-base font-semibold text-white shadow-glass transition ${
    isDarkMode ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-emerald-500 hover:bg-emerald-400'
  }`

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img
          src={darkBackground}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            isDarkMode ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <img
          src={lightBackground}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            isDarkMode ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </div>
      <div className="relative z-10 min-h-screen w-full px-4 py-12 transition-colors duration-700 md:py-16">
        <div className={shellClass}>
          {!sessionReady ? (
            <div className="flex min-h-[400px] items-center justify-center text-center">
              <p className={`text-sm uppercase tracking-[0.4em] ${mutedText}`}>Preparing your workspace…</p>
            </div>
          ) : currentUser ? (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-xs uppercase tracking-[0.6em] ${mutedText}`}>Checklister Cloud</p>
                  <p className={`mt-1 text-sm ${secondaryText}`}>Welcome back, {currentUser.name}.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
                    onClick={() => setProfileOpen(true)}
                    aria-label="Open account panel"
                  >
                    <UserRound className="h-4 w-4" />
                    <span className="hidden sm:inline">Profile</span>
                  </button>
                  <button
                    type="button"
                    className={toggleButtonClass}
                    onClick={toggleTheme}
                    aria-label="Toggle color mode"
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <header className="text-center">
                <h1
                  className={`text-4xl font-semibold tracking-tight md:text-5xl ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Lists that travel with you
                </h1>
                <p className={`mx-auto mt-3 max-w-2xl text-base ${secondaryText}`}>
                  Sign in once and pick up your rituals anywhere. Every checklist stays synced to your account, so
                  shipping, packing, and planning follow you on every device.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <div className={badgeClass}>
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {stats.completedItems}/{stats.totalItems}
                    </span>
                    <span className={mutedText}>items today</span>
                  </div>
                  <div className={badgeClass}>
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {accountStats.completedLists}/{accountStats.totalLists}
                    </span>
                    <span className={mutedText}>lists complete</span>
                  </div>
                </div>
                {actionError && <p className="mt-4 text-sm text-rose-400">{actionError}</p>}
              </header>

              <main className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <section className="w-full space-y-6">
                  <form onSubmit={handleCreateChecklist} className={`${panelClass} w-full`}>
                    <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.3em] ${mutedText}`}>
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      new checklist
                    </div>
                    <label className={`mt-6 block text-sm font-medium ${labelText}`}>
                      Title
                      <input
                        value={newTitle}
                        onChange={(event) => setNewTitle(event.target.value)}
                        placeholder="Deep work, packing list, release steps…"
                        className={inputClass}
                        required
                      />
                    </label>
                    <label className={`mt-4 block text-sm font-medium ${labelText}`}>
                      Prefill tasks (optional)
                      <textarea
                        value={prefillItems}
                        onChange={(event) => setPrefillItems(event.target.value)}
                        placeholder="Each line becomes an item"
                        rows={4}
                        className={inputClass}
                      />
                    </label>
                    <button type="submit" className={primaryButtonClass}>
                      Save checklist
                    </button>
                  </form>
                </section>

                <section className="w-full space-y-6">
                  {checklists.length === 0 ? (
                    <div className={emptyStateClass}>
                      <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        No checklists yet
                      </p>
                      <p className={`mt-2 text-sm ${secondaryText}`}>
                        Capture the steps to your next project and check items off as you go.
                      </p>
                    </div>
                  ) : (
                    checklists.map((list) => {
                      const completed = list.items.filter((item) => item.done).length
                      const total = list.items.length

                      return (
                        <article key={list.id} className={`${checklistCardClass} w-full`}>
                          <header className="relative flex flex-wrap items-start gap-4 sm:flex-nowrap sm:justify-between">
                            <div>
                              <p className={`text-xs uppercase tracking-[0.4em] ${mutedText}`}>checklist</p>
                              <h2 className={`mt-1 text-2xl font-semibold ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                              >
                                {list.title}
                              </h2>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklist(list.id)}
                              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
                                isDarkMode
                                  ? 'border-white/10 bg-white/5 text-slate-300 hover:text-rose-200'
                                  : 'border-slate-900/10 bg-white text-slate-500 hover:text-rose-500'
                              }`}
                              aria-label={`Delete ${list.title}`}
                            >
                              delete
                            </button>
                          </header>

                          <div className="relative mt-5">
                            <div className={`mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] ${mutedText}`}>
                              <span>progress</span>
                              <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>
                                {completed}/{total}
                              </span>
                            </div>
                            <div className={progressTrackClass}>
                              <div
                                className={progressFillClass}
                                style={{
                                  width: `${total === 0 ? 0 : (completed / total) * 100}%`,
                                }}
                              />
                            </div>
                          </div>

                          <ul className="relative mt-6 space-y-3">
                            {list.items.length === 0 && (
                              <li
                                className={`rounded-2xl border border-dashed px-4 py-3 text-sm ${
                                  isDarkMode ? 'border-white/15 text-slate-400' : 'border-slate-900/15 text-slate-500'
                                }`}
                              >
                                Nothing here yet — add your first step below.
                              </li>
                            )}
                            {list.items.map((item) => (
                              <li key={item.id} className={listItemClass}>
                                <label className="flex flex-1 cursor-pointer items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={item.done}
                                    onChange={() => handleToggleItem(list.id, item.id)}
                                    className={checkboxClass}
                                  />
                                  <span
                                    className={`text-base ${
                                      item.done
                                        ? 'text-slate-400 line-through'
                                        : isDarkMode
                                          ? 'text-white'
                                          : 'text-slate-900'
                                    }`}
                                  >
                                    {item.text}
                                  </span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(list.id, item.id)}
                                  className={removeButtonClass}
                                >
                                  remove
                                </button>
                              </li>
                            ))}
                          </ul>

                          <div className="relative mt-5">
                            <div className="flex flex-wrap gap-3 sm:flex-nowrap">
                              <input
                                value={draftItems[list.id] ?? ''}
                                onChange={(event) =>
                                  setDraftItems((prev) => ({ ...prev, [list.id]: event.target.value }))
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    handleAddItem(list.id)
                                  }
                                }}
                                placeholder="Add a task"
                                className={addInputClass}
                              />
                              <button type="button" onClick={() => handleAddItem(list.id)} className={addButtonClass}>
                                Add
                              </button>
                            </div>
                            {list.items.some((item) => item.done) && (
                              <button type="button" onClick={() => handleClearCompleted(list.id)} className={clearButtonClass}>
                                Clear completed
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })
                  )}
                </section>
              </main>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              <div className="flex w-full justify-end">
                <button
                  type="button"
                  className={toggleButtonClass}
                  onClick={toggleTheme}
                  aria-label="Toggle color mode"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>
              <header className="text-center">
                <p className={`text-xs uppercase tracking-[0.6em] ${mutedText}`}>Checklister Cloud</p>
                <h1
                  className={`mt-3 text-4xl font-semibold tracking-tight md:text-5xl ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Save rituals across every device
                </h1>
                <p className={`mx-auto mt-4 max-w-2xl text-base ${secondaryText}`}>
                  Create an account to store unlimited checklists and pick them up from any browser. Everything lives on
                  your connected API now, so you can sign in anywhere and continue where you left off.
                </p>
              </header>

              <form onSubmit={handleAuthSubmit} className={`${panelClass} space-y-4`}>
                {authMode === 'signup' && (
                  <label className={`block text-sm font-medium ${labelText}`}>
                    Name
                    <input
                      value={authForm.name}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Alex Productive"
                      className={inputClass}
                    />
                  </label>
                )}
                <label className={`block text-sm font-medium ${labelText}`}>
                  Email
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="you@email.com"
                    className={inputClass}
                    required
                  />
                </label>
                <label className={`block text-sm font-medium ${labelText}`}>
                  Password
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="At least 6 characters"
                    className={inputClass}
                    minLength={6}
                    required
                  />
                </label>
                {authError && <p className="text-sm text-rose-400">{authError}</p>}
                <button type="submit" className={primaryButtonClass}>
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null)
                    setAuthMode((mode) => (mode === 'login' ? 'signup' : 'login'))
                  }}
                  className={`w-full text-center text-sm font-medium underline-offset-4 ${
                    isDarkMode ? 'text-slate-200 underline' : 'text-emerald-700 underline'
                  }`}
                >
                  {authMode === 'login' ? 'Need an account? Create one.' : 'Already have an account? Sign in.'}
                </button>
              </form>

              <section className="grid gap-4 sm:grid-cols-2">
                <div className={panelClass}>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    What you get
                  </p>
                  <ul className={`mt-3 space-y-2 text-sm ${secondaryText}`}>
                    <li>• Unlimited checklists tied to your account</li>
                    <li>• Cloud-ready backups with copy & download</li>
                    <li>• Secure auth powered by your chosen API</li>
                  </ul>
                </div>
                <div className={panelClass}>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Bring your data anywhere
                  </p>
                  <p className={`mt-3 text-sm ${secondaryText}`}>
                    Sign in to sync automatically, or export a JSON backup once in a while for offline peace of mind.
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {profileOpen && currentUser && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/60 px-4 py-10">
          <div className={`relative w-full max-w-2xl ${panelClass}`}>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border p-2"
              onClick={() => setProfileOpen(false)}
              aria-label="Close profile"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-6">
              <div>
                <p className={`text-xs uppercase tracking-[0.4em] ${mutedText}`}>Account</p>
                <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.name}
                </h2>
                <p className={`text-sm ${secondaryText}`}>Sync code: {currentUser.syncCode}</p>
                <p className={`text-xs ${mutedText}`}>
                  Last saved {new Date(currentUser.updatedAt).toLocaleString()}
                </p>
              </div>

              <form onSubmit={handleProfileSave} className="grid gap-4 sm:grid-cols-2">
                <label className={`text-sm font-medium ${labelText}`}>
                  Display name
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className={`text-sm font-medium ${labelText}`}>
                  Email
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                    className={inputClass}
                  />
                </label>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <button type="submit" className={primaryButtonClass}>
                    Save profile
                  </button>
                  {profileMessage && <span className={`text-sm ${secondaryText}`}>{profileMessage}</span>}
                </div>
              </form>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className={panelClass}>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Backup</p>
                  <p className={`mt-2 text-xs ${mutedText}`}>
                    Copy or download this JSON payload to move your lists to another environment or keep an offline
                    snapshot.
                  </p>
                  <textarea readOnly value={syncPayload} className={`${inputClass} mt-3 h-32`} />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" onClick={handleCopySync} className={addButtonClass}>
                      <Copy className="mr-2 h-4 w-4" /> {syncCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button type="button" onClick={handleDownloadBackup} className={addButtonClass}>
                      <Download className="mr-2 h-4 w-4" /> Download
                    </button>
                  </div>
                </div>
                <div className={panelClass}>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Restore</p>
                  <p className={`mt-2 text-xs ${mutedText}`}>
                    Paste a backup JSON payload below and click Import. This overwrites your current lists with the
                    backup contents on the server.
                  </p>
                  <textarea
                    value={importValue}
                    onChange={(event) => setImportValue(event.target.value)}
                    placeholder="Paste backup JSON here"
                    className={`${inputClass} mt-3 h-32`}
                  />
                  {importError && <p className="text-xs text-rose-400">{importError}</p>}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" onClick={handleImportData} className={addButtonClass}>
                      <Upload className="mr-2 h-4 w-4" /> Import
                    </button>
                    <button type="button" onClick={handleLogout} className={addButtonClass}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
