import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Moon, Sun } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { useEffect, useMemo, useState } from 'react'
import darkBackground from './assets/darkmode-background.jpg'
import lightBackground from './assets/lightmode.jpg'

type SortMode = 'manual' | 'deadline-asc' | 'deadline-desc'

type ChecklistItem = {
  id: string
  text: string
  done: boolean
  deadline: string | null
}

type Checklist = {
  id: string
  title: string
  items: ChecklistItem[]
  sortMode?: SortMode
}

const THEME_KEY = 'checklister:theme'
const STORAGE_KEY = 'checklister:lists'

const computeTheme = (): 'dark' | 'light' => {
  const hour = new Date().getHours()
  return hour >= 17 || hour < 8 ? 'dark' : 'light'
}

const loadTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return computeTheme()
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return computeTheme()
}

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

const normalizeChecklistItem = (item: ChecklistItem): ChecklistItem => ({
  ...item,
  deadline: item.deadline ?? null,
})

const normalizeChecklist = (list: Checklist): Checklist => ({
  ...list,
  sortMode: list.sortMode ?? 'manual',
  items: Array.isArray(list.items) ? list.items.map(normalizeChecklistItem) : [],
})

const sortItems = (items: ChecklistItem[], mode: SortMode) => {
  if (mode === 'manual') return items
  const withDeadline = items.filter((item) => item.deadline)
  const withoutDeadline = items.filter((item) => !item.deadline)
  withDeadline.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
  if (mode === 'deadline-desc') withDeadline.reverse()
  return [...withDeadline, ...withoutDeadline]
}

const formatDeadline = (deadline: string | null) => {
  if (!deadline) return ''
  const date = new Date(`${deadline}T00:00:00`)
  return Number.isNaN(date.getTime()) ? deadline : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const parseDeadlineDraft = (value: string) => {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if ([year, month, day].some((part) => Number.isNaN(part))) return undefined
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? undefined : date
}

const toDeadlineString = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const loadChecklists = (): Checklist[] => {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeChecklist) : []
  } catch {
    return []
  }
}

type SortableItemProps = {
  item: ChecklistItem
  listId: string
  checkboxClass: string
  removeButtonClass: string
  isDarkMode: boolean
  onToggle: (listId: string, itemId: string) => void
  onRemove: (listId: string, itemId: string) => void
  onStartDeadlineEdit: (listId: string, itemId: string) => void
  onClearDeadline: (listId: string, itemId: string) => void
  dragDisabled: boolean
}

const SortableItem = ({
  item,
  listId,
  checkboxClass,
  removeButtonClass,
  isDarkMode,
  onToggle,
  onRemove,
  onStartDeadlineEdit,
  onClearDeadline,
  dragDisabled,
}: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { listId },
    disabled: dragDisabled,
  })
  const deadlineLabel = item.deadline ? formatDeadline(item.deadline) : 'No deadline'

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
        isDarkMode ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-900/5 bg-white text-slate-800'
      } ${isDragging ? 'ring-2 ring-emerald-300/60' : ''}`}
      aria-grabbed={isDragging}
    >
      <button
        type="button"
        className={`cursor-grab text-slate-400 ${dragDisabled ? 'opacity-30' : ''}`}
        {...listeners}
        {...attributes}
        aria-label="Reorder item"
        disabled={dragDisabled}
      >
        <span className="h-4 w-4">≡</span>
      </button>
      <label className="flex flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={item.done}
          onChange={() => onToggle(listId, item.id)}
          className={checkboxClass}
        />
        <span
          className={`text-base ${
            item.done ? 'text-slate-400 line-through' : isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          {item.text}
        </span>
      </label>
      <div className="flex items-center gap-2 text-xs">
        <span className={item.deadline ? (isDarkMode ? 'text-emerald-200' : 'text-sky-600') : isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
          {deadlineLabel}
        </span>
        <button
          type="button"
          onClick={() => onStartDeadlineEdit(listId, item.id)}
          className={`rounded-lg border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
            isDarkMode
              ? 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          }`}
        >
          {item.deadline ? 'Edit' : 'Add'}
        </button>
        {item.deadline && (
          <button
          type="button"
          onClick={() => onClearDeadline(listId, item.id)}
          className={removeButtonClass}
        >
          clear
        </button>
        )}
      </div>
      <button type="button" onClick={() => onRemove(listId, item.id)} className={removeButtonClass}>
        remove
      </button>
    </li>
  )
}

function App() {
  const [checklists, setChecklists] = useState<Checklist[]>(loadChecklists)
  const [newTitle, setNewTitle] = useState('')
  const [prefillItems, setPrefillItems] = useState('')
  const [draftItems, setDraftItems] = useState<Record<string, string>>({})
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({})
  const [openDeadlineKey, setOpenDeadlineKey] = useState<string | null>(null)

  const isDarkMode = theme === 'dark'

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = theme
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme)
    }
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists))
  }, [checklists])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const stats = useMemo(() => {
    const totalItems = checklists.reduce((sum, list) => sum + list.items.length, 0)
    const completedItems = checklists.reduce(
      (sum, list) => sum + list.items.filter((item) => item.done).length,
      0,
    )
    return { totalItems, completedItems }
  }, [checklists])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  const handleCreateChecklist = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    const items = prefillItems
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ id: makeId(), text, done: false, deadline: null }))
    const nextChecklist: Checklist = { id: makeId(), title, items, sortMode: 'manual' }
    setChecklists((prev) => [nextChecklist, ...prev])
    setNewTitle('')
    setPrefillItems('')
  }

  const handleAddItem = (listId: string) => {
    const text = draftItems[listId]?.trim()
    if (!text) return
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? { ...list, items: [...list.items, { id: makeId(), text, done: false, deadline: null }] }
          : list,
      ),
    )
    setDraftItems((prev) => ({ ...prev, [listId]: '' }))
  }

  const handleToggleItem = (listId: string, itemId: string) => {
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
            }
          : list,
      ),
    )
  }

  const handleDeleteItem = (listId: string, itemId: string) => {
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list,
      ),
    )
  }

  const handleDeleteChecklist = (listId: string, title: string) => {
    setPendingDelete({ id: listId, title })
  }

  const confirmDeleteChecklist = () => {
    if (!pendingDelete) return
    setChecklists((prev) => prev.filter((list) => list.id !== pendingDelete.id))
    setPendingDelete(null)
  }

  const cancelDeleteChecklist = () => setPendingDelete(null)

  const handleClearCompleted = (listId: string) => {
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId ? { ...list, items: list.items.filter((item) => !item.done) } : list,
      ),
    )
  }

  const getDeadlineKey = (listId: string, itemId: string) => `${listId}:${itemId}`

  const handleStartDeadlineEdit = (listId: string, itemId: string) => {
    const current = checklists
      .find((list) => list.id === listId)
      ?.items.find((item) => item.id === itemId)?.deadline
    const key = getDeadlineKey(listId, itemId)
    setDeadlineDrafts((prev) => ({ ...prev, [key]: current ?? '' }))
    setOpenDeadlineKey(key)
  }

  const handleDeadlineDraftChange = (listId: string, itemId: string, value: string) => {
    const key = getDeadlineKey(listId, itemId)
    setDeadlineDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const handleCancelDeadlineEdit = () => {
    setOpenDeadlineKey(null)
  }

  const handleSaveDeadline = (listId: string, itemId: string) => {
    const key = getDeadlineKey(listId, itemId)
    const draft = (deadlineDrafts[key] ?? '').trim()
    if (draft && !/^\d{4}-\d{2}-\d{2}$/.test(draft)) {
      window.alert('Please use the YYYY-MM-DD format (YYYY-MM-DD) for deadlines.')
      return
    }
    const value = draft || null
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) => (item.id === itemId ? { ...item, deadline: value } : item)),
            }
          : list,
      ),
    )
    setOpenDeadlineKey(null)
  }

  const handleClearDeadline = (listId: string, itemId: string) => {
    const key = getDeadlineKey(listId, itemId)
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) => (item.id === itemId ? { ...item, deadline: null } : item)),
            }
          : list,
      ),
    )
    if (openDeadlineKey === key) {
      setOpenDeadlineKey(null)
    }
    setDeadlineDrafts((prev) => ({ ...prev, [key]: '' }))
  }

  const handleSortChange = (listId: string, mode: SortMode) => {
    setChecklists((prev) =>
      prev.map((list) => (list.id === listId ? { ...list, sortMode: mode } : list)),
    )
  }

  const handleDragEnd = (event: DragEndEvent, listId: string) => {
    const listSortMode = checklists.find((list) => list.id === listId)?.sortMode ?? 'manual'
    if (listSortMode !== 'manual') return
    const { active, over } = event
    if (!over || active.id === over.id) return

    setChecklists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list
        const oldIndex = list.items.findIndex((item) => item.id === active.id)
        const newIndex = list.items.findIndex((item) => item.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return list
        return { ...list, items: arrayMove(list.items, oldIndex, newIndex) }
      }),
    )
  }

  const shellClass = `mx-auto w-full max-w-5xl rounded-[40px] border p-4 shadow-glass sm:p-10 ${
    isDarkMode
      ? 'border-white/15 bg-slate-900/70 text-slate-100 backdrop-blur-[36px]'
      : 'border-slate-900/10 bg-white/80 text-slate-900 backdrop-blur-[16px]'
  }`
  const badgeClass = `inline-flex items-center gap-3 rounded-full px-5 py-2 text-sm ring-1 ${
    isDarkMode ? 'bg-white/5 text-slate-200 ring-white/10' : 'bg-sky-50 text-sky-700 ring-sky-100'
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
  const inputClass = `mt-2 w-full rounded-2xl border px-4 py-3 text-base focus:outline-none focus:ring-2 ${
    isDarkMode
      ? 'border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:ring-emerald-400/40'
      : 'border-slate-900/10 bg-white text-slate-900 placeholder:text-slate-500 focus:border-sky-400 focus:ring-sky-400/40'
  }`
  const addInputClass = `flex-1 min-w-0 rounded-2xl border px-4 py-3 text-base focus:outline-none focus:ring-2 ${
    isDarkMode
      ? 'border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-300 focus:ring-sky-300/40'
      : 'border-slate-900/10 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-300/50'
  }`
  const addButtonClass = `rounded-2xl border px-5 text-sm font-medium transition ${
    isDarkMode
      ? 'bg-emerald-600 border-white/10 bg-white/10 text-white hover:bg-white/20'
      : 'border-sky-500/20 bg-sky-500/90 text-white hover:bg-sky-500'
  }`
  const checkboxClass = `h-4 w-4 rounded border text-emerald-300 accent-emerald-300 ${
    isDarkMode ? 'border-white/30 bg-transparent' : 'border-sky-200 bg-white text-sky-500 accent-sky-500'
  }`
  const removeButtonClass = `text-xs uppercase tracking-wide transition ${
    isDarkMode ? 'text-slate-400 hover:text-rose-200' : 'text-slate-500 hover:text-rose-500'
  }`
  const clearButtonClass = `mt-3 text-xs uppercase tracking-[0.3em] underline-offset-4 ${
    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-sky-600'
  }`
  const progressTrackClass = `h-2 rounded-full ${
    isDarkMode ? 'bg-white/10' : 'bg-sky-50'
  }`
  const progressFillClass = `h-full rounded-full transition-all ${
    isDarkMode ? 'bg-emerald-300' : 'bg-sky-500'
  }`
  const toggleButtonClass = `rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
    isDarkMode
      ? 'border-white/15 text-slate-100 hover:bg-white/10'
      : 'border-slate-800/20 text-slate-900 hover:bg-slate-900/10'
  }`
  const primaryButtonClass = `mt-6 w-full rounded-2xl px-4 py-3 text-base font-semibold text-white shadow-glass transition ${
    isDarkMode ? 'bg-emerald-600 hover:bg-emerald-300' : 'bg-sky-500 hover:bg-sky-400'
  }`
  const calendarNavButtonClass = `h-8 w-8 rounded-lg border transition ${
    isDarkMode
      ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:border-emerald-300/60 hover:bg-emerald-300/20'
      : 'border-sky-300 bg-white text-sky-700 hover:border-sky-400 hover:bg-sky-50'
  }`
  const calendarDayClass = `h-9 w-9 rounded-lg text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
    isDarkMode
      ? 'text-slate-100 hover:bg-white/10 focus-visible:outline-emerald-300'
      : 'text-slate-800 hover:bg-slate-100 focus-visible:outline-sky-500'
  }`
  const calendarDaySelectedClass = isDarkMode
    ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
    : 'bg-sky-500 text-white hover:bg-sky-400'
  const calendarHeadCellClass = `w-10 pb-1 text-center text-[11px] font-semibold uppercase ${
    isDarkMode ? 'text-slate-300' : 'text-slate-500'
  }`
  const calendarOutsideDayClass = isDarkMode ? 'text-slate-500' : 'text-slate-400'
  const calendarAccentTextClass = isDarkMode ? 'text-emerald-100' : 'text-sky-700'
  const calendarAccentBg = isDarkMode ? '#34d399' : '#0ea5e9'
  const calendarAccentText = isDarkMode ? '#052e16' : '#f8fafc'
  const calendarTodayClass = ''
  const [activeListId, activeItemId] = openDeadlineKey?.split(':') ?? []
  const activeDeadlineDraft = openDeadlineKey ? deadlineDrafts[openDeadlineKey] ?? '' : ''
  const activeTaskLabel =
    openDeadlineKey && activeListId && activeItemId
      ? checklists.find((list) => list.id === activeListId)?.items.find((item) => item.id === activeItemId)?.text ??
        'this task'
      : 'this task'

  return (
    <div className="relative min-h-screen w-full px-4 py-12 transition-colors duration-700 md:py-16">
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
      <div className="relative z-10">
        <div className={shellClass}>
          <div className="flex flex-col gap-8">
            <div className="flex w-full justify-end">
              <button type="button" className={toggleButtonClass} onClick={toggleTheme} aria-label="Toggle color mode">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <header className="text-center">
              <h1
                className={`text-4xl font-semibold tracking-tight md:text-5xl ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Checklister
              </h1>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <div className={badgeClass}>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {stats.completedItems}/{stats.totalItems}
                  </span>
                  <span className={mutedText}>items</span>
                </div>
                <div className={badgeClass}>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {checklists.length}
                  </span>
                  <span className={mutedText}>lists</span>
                </div>
              </div>
            </header>

            <main className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <section className="w-full space-y-6">
                <form onSubmit={handleCreateChecklist} className={`${panelClass} w-full`}>
                  <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.3em] ${mutedText}`}>
                    <span
                      className={`h-2 w-2 rounded-full ${isDarkMode ? 'bg-emerald-400' : 'bg-sky-500'}`}
                    />
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
                    <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No checklists yet</p>
                    <p className={`mt-2 text-sm ${secondaryText}`}>
                      Capture the steps to your next project and check items off as you go.
                    </p>
                  </div>
                ) : (
                  checklists.map((list) => {
                    const completed = list.items.filter((item) => item.done).length
                    const total = list.items.length
                    const sortMode = list.sortMode ?? 'manual'
                    const sortedItems = sortItems(list.items, sortMode)
                    const dragDisabled = sortMode !== 'manual'

                    return (
                      <article key={list.id} className={`${checklistCardClass} w-full`}>
                        <header className="relative flex flex-wrap items-start gap-4 sm:flex-nowrap sm:justify-between">
                          <div>
                            <p className={`text-xs uppercase tracking-[0.4em] ${mutedText}`}>checklist</p>
                            <h2
                              className={`mt-1 text-2xl font-semibold ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {list.title}
                            </h2>
                            <p className={`text-xs ${mutedText}`}>
                              {completed}/{total} done
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklist(list.id, list.title)}
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
                          <div
                            className={`mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] ${mutedText}`}
                          >
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

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.3em] ${mutedText}`}>
                            <CalendarDays className="h-4 w-4" />
                            deadlines
                          </div>
                          <div className="flex gap-2 text-xs font-semibold">
                            {(['manual', 'deadline-asc', 'deadline-desc'] as SortMode[]).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => handleSortChange(list.id, mode)}
                                className={`rounded-xl border px-3 py-1 uppercase tracking-wide transition ${
                                  sortMode === mode
                                    ? isDarkMode
                                      ? 'border-emerald-300/50 bg-emerald-300/20 text-emerald-100'
                                      : 'border-sky-400 bg-sky-50 text-sky-700'
                                    : isDarkMode
                                      ? 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                {mode === 'manual' ? 'Manual' : mode === 'deadline-asc' ? 'Earliest' : 'Latest'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleDragEnd(event, list.id)}
                        >
                          <SortableContext items={sortedItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
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
                              {sortedItems.map((item) => {
                                return (
                                  <SortableItem
                                    key={item.id}
                                    item={item}
                                    listId={list.id}
                                    checkboxClass={checkboxClass}
                                    removeButtonClass={removeButtonClass}
                                    isDarkMode={isDarkMode}
                                    onToggle={handleToggleItem}
                                    onRemove={handleDeleteItem}
                                    onStartDeadlineEdit={handleStartDeadlineEdit}
                                    onClearDeadline={handleClearDeadline}
                                    dragDisabled={dragDisabled}
                                  />
                                )
                              })}
                            </ul>
                          </SortableContext>
                        </DndContext>

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

      {openDeadlineKey && activeListId && activeItemId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 backdrop-blur-md px-4"
          onClick={handleCancelDeadlineEdit}
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-4 shadow-2xl ${
              isDarkMode ? 'border-white/10 bg-slate-900/95 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
                <CalendarDays className="h-4 w-4" />
                deadline
              </div>
              <button
                type="button"
                onClick={handleCancelDeadlineEdit}
                className={`text-xs uppercase tracking-wide ${
                  isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                close
              </button>
            </div>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              Set a deadline for <strong className="font-semibold">{activeTaskLabel}</strong>
            </p>
            <div className="mt-3 rounded-xl border p-3 shadow-sm">
              <DayPicker
                mode="single"
                selected={parseDeadlineDraft(activeDeadlineDraft)}
                onSelect={(date) => {
                  if (!date) return
                  handleDeadlineDraftChange(activeListId, activeItemId, toDeadlineString(date))
                }}
                className="mx-auto w-full"
                showOutsideDays
                fixedWeeks
                weekStartsOn={1}
                styles={{
                  root: {
                    ['--rdp-accent-color' as any]: calendarAccentBg,
                    ['--rdp-accent-text-color' as any]: calendarAccentText,
                    ['--rdp-background-color' as any]: 'transparent',
                  },
                  months: { width: '100%' },
                  month: { width: '100%' },
                  month_grid: { width: '100%' },
                  nav_button: {
                    color: isDarkMode ? '#34d399' : '#0ea5e9',
                    borderColor: isDarkMode ? '#6ee7b7' : '#38bdf8',
                    backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.08)' : 'rgba(14, 165, 233, 0.08)',
                  },
                }}
                modifiersStyles={{
                  selected: {
                    backgroundColor: calendarAccentBg,
                    color: calendarAccentText,
                    borderColor: calendarAccentBg,
                    boxShadow: 'none',
                  },
                  today: {
                    borderColor: 'transparent',
                    color: '#ef4444',
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                    fontWeight: 700,
                  },
                }}
                classNames={{
                  caption: `flex items-center justify-between mb-2 px-1 text-sm font-semibold ${calendarAccentTextClass}`,
                  caption_label: `text-sm font-semibold ${calendarAccentTextClass}`,
                  nav: 'flex items-center gap-1',
                  nav_button: calendarNavButtonClass,
                  nav_button_previous: '',
                  nav_button_next: '',
                  month_grid: 'w-full',
                  table: 'w-full border-collapse',
                  head_row: '',
                  head_cell: calendarHeadCellClass,
                  row: '',
                  cell: 'p-1 text-center align-middle',
                  day: calendarDayClass,
                  day_selected: calendarDaySelectedClass,
                  day_today: calendarTodayClass,
                  day_outside: calendarOutsideDayClass,
                  day_disabled: `${calendarOutsideDayClass} opacity-50`,
                }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSaveDeadline(activeListId, activeItemId)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  isDarkMode ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-sky-500 text-white hover:bg-sky-400'
                }`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => handleClearDeadline(activeListId, activeItemId)}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  isDarkMode
                    ? 'border-white/15 text-slate-100 hover:bg-white/10'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleCancelDeadlineEdit}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  isDarkMode
                    ? 'border-white/15 text-slate-100 hover:bg-white/10'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/70 px-4 py-10">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 shadow-glass ${
              isDarkMode ? 'border-white/10 bg-slate-900/90 text-slate-50' : 'border-slate-200 bg-white'
            }`}
          >
            <h3 className="text-lg font-semibold">Delete checklist?</h3>
            <p className={`mt-2 text-sm ${secondaryText}`}>
              Are you sure you want to delete “{pendingDelete.title}”? This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={cancelDeleteChecklist}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  isDarkMode
                    ? 'border-white/15 text-slate-100 hover:bg-white/10'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteChecklist}
                className="rounded-2xl border border-rose-200 bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
