import { Sun, Moon } from 'lucide-react'
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

const STORAGE_KEY = 'checklister:v1'
const THEME_KEY = 'checklister:theme'

const defaultLists: Checklist[] = [
  {
    id: 'am-start',
    title: 'Morning reset',
    items: [
      { id: 'water', text: 'Drink a glass of water', done: false },
      { id: 'plan', text: 'Review today’s plan', done: false },
      { id: 'inbox', text: 'Empty inbox/follow-ups', done: false },
    ],
  },
  {
    id: 'ship',
    title: 'Ship it checklist',
    items: [
      { id: 'tests', text: 'Run automated tests', done: false },
      { id: 'notes', text: 'Capture release notes', done: false },
      { id: 'demo', text: 'Record a quick walkthrough', done: false },
    ],
  },
]

const createId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`

const loadInitialData = (): Checklist[] => {
  if (typeof window === 'undefined') {
    return defaultLists
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return defaultLists
  }

  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return defaultLists
  } catch {
    return defaultLists
  }
}

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

function App() {
  const [checklists, setChecklists] = useState<Checklist[]>(loadInitialData)
  const [newTitle, setNewTitle] = useState('')
  const [prefillItems, setPrefillItems] = useState('')
  const [draftItems, setDraftItems] = useState<Record<string, string>>({})
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists))
  }, [checklists])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = theme
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme)
    }
  }, [theme])

  const stats = useMemo(() => {
    const totalItems = checklists.reduce((sum, list) => sum + list.items.length, 0)
    const completedItems = checklists.reduce(
      (sum, list) => sum + list.items.filter((item) => item.done).length,
      0,
    )
    return { totalItems, completedItems }
  }, [checklists])

  const handleCreateChecklist = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title) return

    const items = prefillItems
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ id: createId(), text, done: false }))

    const newChecklist: Checklist = {
      id: createId(),
      title,
      items,
    }

    setChecklists((previous) => [newChecklist, ...previous])
    setNewTitle('')
    setPrefillItems('')
  }

  const handleAddItem = (listId: string) => {
    const text = draftItems[listId]?.trim()
    if (!text) return

    setChecklists((previous) =>
      previous.map((list) =>
        list.id === listId
          ? { ...list, items: [...list.items, { id: createId(), text, done: false }] }
          : list,
      ),
    )
    setDraftItems((prev) => ({ ...prev, [listId]: '' }))
  }

  const handleToggleItem = (listId: string, itemId: string) => {
    setChecklists((previous) =>
      previous.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item,
              ),
            }
          : list,
      ),
    )
  }

  const handleDeleteItem = (listId: string, itemId: string) => {
    setChecklists((previous) =>
      previous.map((list) =>
        list.id === listId
          ? { ...list, items: list.items.filter((item) => item.id !== itemId) }
          : list,
      ),
    )
  }

  const handleDeleteChecklist = (listId: string) => {
    setChecklists((previous) => previous.filter((list) => list.id !== listId))
    setDraftItems((prev) => {
      const next = { ...prev }
      delete next[listId]
      return next
    })
  }

  const handleClearCompleted = (listId: string) => {
    setChecklists((previous) =>
      previous.map((list) =>
        list.id === listId
          ? { ...list, items: list.items.filter((item) => !item.done) }
          : list,
      ),
    )
  }

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const isDarkMode = theme === 'dark'
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
  const toggleButtonClass = `rounded-full border p-2 text-xs font-semibold uppercase tracking-wide transition ${
    isDarkMode
      ? 'border-white/15 text-slate-100 hover:bg-white/10'
      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
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
      <div className="relative z-10 min-h-screen w-full px-4 py-12 md:py-16 transition-colors duration-700">
        <div className={shellClass}>
          <div className="flex flex-col gap-8">
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
            <p className={`text-xs uppercase tracking-[0.6em] ${mutedText}`}>Checklister</p>
            <h1
              className={`mt-3 text-4xl font-semibold tracking-tight md:text-5xl ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Minimal checklists, zero noise
            </h1>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <div className={`${badgeClass} inline-flex items-center gap-3`}>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {stats.completedItems}/{stats.totalItems}
                </span>
                <span className={mutedText}>done today</span>
              </div>
            </div>
          </header>

          <main className="grid w-full gap-6 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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
                <button
                  type="submit"
                  className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-center text-base font-semibold text-white shadow-glass transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                >
                  Save checklist
                </button>
              </form>

            </section>

            <section className="w-full space-y-6">
              {checklists.length === 0 ? (
                <div className={emptyStateClass}>
                  <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No checklists yet</p>
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
                          <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
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
                            <button type="button" onClick={() => handleDeleteItem(list.id, item.id)} className={removeButtonClass}>
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
      </div>
      </div>
    </>
  )
}

export default App
