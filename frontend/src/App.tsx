import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, CalendarDays, LayoutDashboard, Moon, Plus, Sun } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { useEffect, useMemo, useState } from 'react'

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
  pinned?: boolean
  archived?: boolean
  archivedAt?: string | null
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
  pinned: list.pinned ?? false,
  archived: list.archived ?? false,
  archivedAt: list.archivedAt ?? null,
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
  readOnly: boolean
  isArchiveView: boolean
}
const isDueToday = (deadline: string | null) => {
  if (!deadline) return false

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD

  return deadline === todayStr
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
  readOnly,
  isArchiveView,
}: SortableItemProps) => {
  const combinedDragDisabled = dragDisabled || readOnly
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { listId },
    disabled: combinedDragDisabled,
  })
  const deadlineLabel = item.deadline ? formatDeadline(item.deadline) : 'No deadline'
  const isToday = isDueToday(item.deadline)

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
        className={`cursor-grab text-slate-400 ${combinedDragDisabled ? 'opacity-30' : ''}`}
        {...listeners}
        {...attributes}
        aria-label="Reorder item"
        disabled={combinedDragDisabled}
      >
        <span className="h-4 w-4">≡</span>
      </button>
      <label className="flex flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={item.done}
          onChange={() => onToggle(listId, item.id)}
          className={checkboxClass}
          disabled={readOnly}
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
      
        <span
  className={
    isToday
      ? 'text-red-500'
      : item.deadline
        ? (isDarkMode ? 'text-emerald-200' : 'text-sky-600')
        : isDarkMode
          ? 'text-slate-400'
          : 'text-slate-500'
  }
>
  {deadlineLabel}
</span>

        {!isArchiveView && (
          <>
            <button
              type="button"
              onClick={() => onStartDeadlineEdit(listId, item.id)}
              className={`rounded-lg border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                isDarkMode
                  ? 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
              disabled={readOnly}
            >
              {item.deadline ? 'Edit' : 'Add'}
            </button>
            {item.deadline && (
              <button
              type="button"
              onClick={() => onClearDeadline(listId, item.id)}
              className={removeButtonClass}
              disabled={readOnly}
            >
              clear
            </button>
            )}
          </>
        )}
      </div>
      {!isArchiveView && (
        <button type="button" onClick={() => onRemove(listId, item.id)} className={removeButtonClass} disabled={readOnly}>
          remove
        </button>
      )}
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
  const [route, setRoute] = useState<'home' | 'archive'>(() => {
    if (typeof window === 'undefined') return 'home'
    return window.location.pathname.startsWith('/archive') ? 'archive' : 'home'
  })
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => {
      setRoute(window.location.pathname.startsWith('/archive') ? 'archive' : 'home')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const isDarkMode = theme === 'dark'

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = theme
    }
    document.body.style.overflow = openDeadlineKey || showCreateModal ? 'hidden' : ''
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [theme, openDeadlineKey, showCreateModal])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists))
  }, [checklists])

  const [archiveNotice, setArchiveNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!archiveNotice) return
    const timer = window.setTimeout(() => setArchiveNotice(null), 3000)
    return () => window.clearTimeout(timer)
  }, [archiveNotice])

  const navigate = (target: 'home' | 'archive') => {
    if (typeof window === 'undefined') return
    const pathname = target === 'archive' ? '/archive' : '/'
    if (window.location.pathname !== pathname) {
      window.history.pushState({}, '', pathname)
    }
    setRoute(target)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const activeLists = useMemo(
    () => checklists.filter((list) => !(list.archived ?? false) && !list.archivedAt),
    [checklists],
  )
  const archivedLists = useMemo(
    () => checklists.filter((list) => (list.archived ?? false) || !!list.archivedAt),
    [checklists],
  )

  const stats = useMemo(() => {
    const source = route === 'archive' ? archivedLists : activeLists
    const totalItems = source.reduce((sum, list) => sum + list.items.length, 0)
    const completedItems = source.reduce(
      (sum, list) => sum + list.items.filter((item) => item.done).length,
      0,
    )
    return { totalItems, completedItems, listCount: source.length }
  }, [activeLists, archivedLists, route])
  const isArchiveRoute = route === 'archive'

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  const isArchivedList = (listId: string) => {
    const target = checklists.find((list) => list.id === listId)
    return (target?.archived ?? false) || !!target?.archivedAt
  }
  const isListCollapsed = (listId: string) => collapsedLists[listId] ?? (route === 'archive')
  const toggleCollapsed = (listId: string) =>
    setCollapsedLists((prev) => ({ ...prev, [listId]: !isListCollapsed(listId) }))

  const handleCreateChecklist = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    const items = prefillItems
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ id: makeId(), text, done: false, deadline: null }))
    const nextChecklist: Checklist = {
      id: makeId(),
      title,
      items,
      sortMode: 'manual',
      pinned: false,
      archived: false,
      archivedAt: null,
    }
    setChecklists((prev) => [nextChecklist, ...prev])
    setNewTitle('')
    setPrefillItems('')
    setShowCreateModal(false)
  }

  const handleAddItem = (listId: string) => {
    if (isArchivedList(listId)) return
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
    if (isArchivedList(listId)) return
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
    if (isArchivedList(listId)) return
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
    if (isArchivedList(listId)) return
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId ? { ...list, items: list.items.filter((item) => !item.done) } : list,
      ),
    )
  }

  const handleArchiveChecklist = (listId: string) => {
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? { ...list, archived: true, archivedAt: new Date().toISOString(), pinned: false }
          : list,
      ),
    )
    setCollapsedLists((prev) => ({ ...prev, [listId]: true }))
    const title = checklists.find((list) => list.id === listId)?.title
    if (title) setArchiveNotice(`“${title}” was archived`)
  }

  const handleUnarchiveChecklist = (listId: string) => {
    setChecklists((prev) =>
      prev.map((list) =>
        list.id === listId ? { ...list, archived: false, archivedAt: null } : list,
      ),
    )
  }

  const getDeadlineKey = (listId: string, itemId: string) => `${listId}:${itemId}`

  const handleStartDeadlineEdit = (listId: string, itemId: string) => {
    if (isArchivedList(listId)) return
    const current = checklists
      .find((list) => list.id === listId)
      ?.items.find((item) => item.id === itemId)?.deadline
    const key = getDeadlineKey(listId, itemId)
    setDeadlineDrafts((prev) => ({ ...prev, [key]: current ?? '' }))
    setOpenDeadlineKey(key)
  }

  const handleDeadlineDraftChange = (listId: string, itemId: string, value: string) => {
    if (isArchivedList(listId)) return
    const key = getDeadlineKey(listId, itemId)
    setDeadlineDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const handleCancelDeadlineEdit = () => {
    setOpenDeadlineKey(null)
  }

  const handleSaveDeadline = (listId: string, itemId: string) => {
    if (isArchivedList(listId)) return
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
    if (isArchivedList(listId)) return
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
    if (isArchivedList(listId)) return
    setChecklists((prev) =>
      prev.map((list) => (list.id === listId ? { ...list, sortMode: mode } : list)),
    )
  }

  const handleDragEnd = (event: DragEndEvent, listId: string) => {
    if (isArchivedList(listId)) return
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
      ? 'border-emerald-300/25 bg-slate-950/75 text-emerald-50 backdrop-blur-[32px]'
      : 'border-sky-200 bg-white/95 text-slate-900 backdrop-blur-[16px] shadow-lg shadow-sky-200/40'
  } ${isArchiveRoute ? (isDarkMode ? 'ring-2 ring-emerald-300/40' : 'ring-2 ring-sky-500/70') : ''}`
  const pageBackgroundClass = isDarkMode
    ? 'bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-900'
    : 'bg-gradient-to-br from-sky-200 via-sky-100 to-sky-600'
  const badgeClass = `inline-flex items-center gap-3 rounded-full px-5 py-2 text-sm ring-1 ${
    isDarkMode ? 'bg-slate-900/70 text-emerald-100 ring-emerald-300/30' : 'bg-sky-100 text-sky-800 ring-sky-400/70 shadow-sm shadow-sky-200/70'
  }`
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500'
  const secondaryText = isDarkMode ? 'text-slate-300' : 'text-slate-600'
  const labelText = isDarkMode ? 'text-slate-200' : 'text-slate-700'
  const emptyStateClass = `rounded-3xl border border-dashed p-10 text-center ${
    isDarkMode ? 'border-emerald-300/25 bg-slate-900/70 text-emerald-100' : 'border-sky-200 bg-sky-50 text-sky-700'
  }`
  const checklistCardClass = `relative overflow-hidden rounded-3xl border p-6 shadow-glass ${
    isDarkMode ? 'border-slate-800/60 bg-slate-900/70' : 'border-sky-200 bg-white shadow-md shadow-sky-100/60'
  }`
  const inputClass = `mt-2 w-full rounded-2xl border px-4 py-3 text-base focus:outline-none focus:ring-2 ${
    isDarkMode
      ? 'border-emerald-300/30 bg-slate-900/60 text-emerald-50 placeholder:text-slate-400 focus:border-emerald-200 focus:ring-emerald-300/60'
      : 'border-sky-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-sky-500 focus:ring-sky-400/70'
  }`
  const addInputClass = `flex-1 min-w-0 rounded-2xl border px-4 py-3 text-base focus:outline-none focus:ring-2 ${
    isDarkMode
      ? 'border-emerald-300/30 bg-slate-900/60 text-emerald-50 placeholder:text-emerald-200/70 focus:border-emerald-200 focus:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-60'
      : 'border-sky-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60'
  }`
  const addButtonClass = `rounded-2xl border px-5 text-sm font-medium transition ${
    isDarkMode
      ? 'bg-emerald-500 border-emerald-200/30 text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-800/40 disabled:text-emerald-200'
      : 'border-sky-400 bg-sky-500 text-white hover:bg-sky-600 shadow-sm shadow-sky-200/70 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500'
  }`
  const checkboxClass = `h-4 w-4 rounded border text-emerald-300 accent-emerald-300 ${
    isDarkMode
      ? 'border-white/30 bg-transparent disabled:cursor-not-allowed disabled:opacity-60'
      : 'border-sky-200 bg-white text-sky-500 accent-sky-500 disabled:cursor-not-allowed disabled:opacity-60'
  }`
  const removeButtonClass = `text-xs uppercase tracking-wide transition ${
    isDarkMode
      ? 'text-slate-400 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50'
      : 'text-slate-500 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50'
  }`
  const clearButtonClass = `mt-3 text-xs uppercase tracking-[0.3em] underline-offset-4 ${
    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-sky-600'
  }`
  const pillButtonClass = `rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
    isDarkMode
      ? 'border-white/10 bg-white/5 text-slate-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
      : 'border-slate-900/10 bg-white text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
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
  const modalPrimaryButtonClass = `flex-[1.2] w-full rounded-2xl px-5 py-3 text-base font-semibold uppercase tracking-wide text-white shadow-glass transition ${
    isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-500 hover:bg-sky-400'
  }`
  const modalCancelButtonClass = `flex-1 w-full rounded-2xl border px-5 py-3 text-base font-semibold uppercase tracking-wide transition ${
    isDarkMode
      ? 'border-white/15 text-slate-100 hover:bg-white/10'
      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
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
  const renderChecklistCard = (list: Checklist) => {
    const completed = list.items.filter((item) => item.done).length
    const total = list.items.length
    const sortMode = list.sortMode ?? 'manual'
    const sortedItems = sortItems(list.items, sortMode)
    const isArchived = (list.archived ?? false) || !!list.archivedAt
    const dragDisabled = sortMode !== 'manual' || isArchived
    const collapsed = isListCollapsed(list.id)

    return (
      <article
        key={list.id}
        className={`${checklistCardClass} w-full ${
          isArchiveRoute
            ? isDarkMode
              ? 'border-emerald-300/40 bg-emerald-900/30'
              : 'border-sky-400 bg-sky-50/95 shadow-sky-200/60'
            : ''
        }`}
      >
        <header className="relative flex flex-wrap items-start gap-4 sm:flex-nowrap sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-xs uppercase tracking-[0.4em] ${mutedText}`}>checklist</p>
              {isArchived && (
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    isDarkMode
                      ? 'bg-white/10 text-slate-200 ring-1 ring-white/15'
                      : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  Archived
                </span>
              )}
            </div>
            <h2
              className={`mt-1 text-2xl font-semibold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {list.title}
            </h2>
            <p className={`text-xs ${mutedText}`}>
              {total === 1 ? '1 item' : `${total} items`} • {completed}/{total} done
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => toggleCollapsed(list.id)}
              className={`${pillButtonClass} ${
                collapsed
                  ? isDarkMode
                    ? 'border-white/30 text-white'
                    : 'border-slate-900/20 text-slate-900'
                  : ''
              }`}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${list.title}`}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
            {isArchiveRoute ? (
              <>
                <button
                  type="button"
                  onClick={() => handleUnarchiveChecklist(list.id)}
                  className={`${pillButtonClass} ${
                    isDarkMode
                      ? 'border-emerald-300/60 text-emerald-100 hover:border-emerald-200 hover:text-emerald-50'
                      : 'border-sky-400 text-sky-700 hover:border-sky-500'
                  }`}
                  aria-label={`Restore ${list.title}`}
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteChecklist(list.id, list.title)}
                  className="rounded-full border px-3 py-1 text-xs uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:bg-rose-50"
                  aria-label={`Delete ${list.title} permanently`}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleArchiveChecklist(list.id)}
                className={`${pillButtonClass} ${
                  isDarkMode
                    ? 'border-emerald-300/60 text-emerald-100 hover:border-emerald-200 hover:text-emerald-50'
                    : 'border-sky-400 text-sky-700 hover:border-sky-500'
                }`}
                aria-label={`Archive ${list.title}`}
              >
                Archive
              </button>
            )}
          </div>
        </header>

        {isArchived && (
          <p className={`mt-3 text-sm ${mutedText}`}>Archived lists are read-only. Unarchive to make changes.</p>
        )}

        {!collapsed && (
          <>
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
                    } ${isArchived ? 'opacity-60' : ''}`}
                    disabled={isArchived}
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
                      {isArchiveRoute ? 'This archived list has no items.' : 'Nothing here yet — add your first step below.'}
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
                        readOnly={isArchived}
                        isArchiveView={isArchiveRoute}
                      />
                    )
                  })}
                </ul>
              </SortableContext>
            </DndContext>

            {!isArchiveRoute && (
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
                    disabled={isArchived}
                  />
                  <button type="button" onClick={() => handleAddItem(list.id)} className={addButtonClass} disabled={isArchived}>
                    Add
                  </button>
                </div>
                {!isArchived && list.items.some((item) => item.done) && (
                  <button type="button" onClick={() => handleClearCompleted(list.id)} className={clearButtonClass}>
                    Clear completed
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </article>
    )
  }

  return (
    <>
      <div className={`relative min-h-screen w-full px-4 py-12 transition-colors duration-700 md:py-16 ${pageBackgroundClass}`}>
        <div className={shellClass}>
          <div className="flex flex-col gap-8">
            <div className="flex w-full justify-end">
              <button type="button" className={toggleButtonClass} onClick={toggleTheme} aria-label="Toggle color mode">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <header
              className={`rounded-3xl border px-6 py-5 text-center shadow-glass ${
                isArchiveRoute
                  ? isDarkMode
                    ? 'border-emerald-400/40 bg-emerald-900/40'
                    : 'border-sky-300 bg-sky-50/95 shadow-lg shadow-sky-200/80'
                  : isDarkMode
                    ? 'border-white/10 bg-white/5'
                    : 'border-slate-200 bg-white/95'
              }`}
            >
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                    isArchiveRoute
                      ? isDarkMode
                        ? 'bg-emerald-500/20 text-emerald-50 ring-1 ring-emerald-300/40'
                        : 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'
                      : isDarkMode
                        ? 'bg-white/10 text-slate-200 ring-1 ring-white/15'
                        : 'bg-sky-50 text-sky-700 ring-1 ring-sky-100'
                  }`}
                >
                  {isArchiveRoute ? <Archive className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
                  {isArchiveRoute ? 'Archive' : 'Workspace'}
                </div>
              </div>
              <h1
                className={`mt-3 text-4xl font-semibold tracking-tight md:text-5xl ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {isArchiveRoute ? 'Archive' : 'Checklister'}
              </h1>
              <p className={`mt-2 text-sm ${secondaryText}`}>
                {isArchiveRoute ? 'Archived lists are stored here. Restore them when you are ready to work again.' : 'Organize checklists and track progress across your work.'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <div className={badgeClass}>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {stats.completedItems}/{stats.totalItems}
                  </span>
                  <span className={mutedText}>items</span>
                </div>
                <div className={badgeClass}>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {stats.listCount}
                  </span>
                  <span className={mutedText}>{isArchiveRoute ? 'archived' : 'lists'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(isArchiveRoute ? 'home' : 'archive')}
                  className={`${badgeClass} ${
                    isDarkMode
                      ? 'hover:ring-white/30 disabled:opacity-50 disabled:hover:ring-white/10'
                      : 'hover:ring-sky-200 disabled:opacity-50 disabled:hover:ring-sky-100'
                  }`}
                  aria-pressed={isArchiveRoute}
                >
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {isArchiveRoute ? '← Back to lists' : 'Go to archive →'}
                  </span>
                  <span className={mutedText}>{isArchiveRoute ? activeLists.length : archivedLists.length}</span>
                </button>
              </div>
            </header>

            {isArchiveRoute ? (
              <main className="flex w-full flex-col items-center gap-6">
                <section className="w-full max-w-3xl space-y-6">
                  {archivedLists.length === 0 ? (
                    <div className={emptyStateClass}>
                      <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No archived lists</p>
                      <p className={`mt-2 text-sm ${secondaryText}`}>Archive a list to see it here.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <p className={`text-xs uppercase tracking-[0.3em] ${mutedText}`}>Archived</p>
                        {archivedLists.map(renderChecklistCard)}
                      </div>
                    </>
                  )}
                </section>
              </main>
            ) : (
              <main className="flex w-full flex-col items-center gap-6">
                <div className="flex w-full max-w-3xl justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition ${
                      isDarkMode
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-sky-500 text-white hover:bg-sky-400'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    New checklist
                  </button>
                </div>
                <section className="w-full max-w-3xl space-y-6">
                  {activeLists.length === 0 ? (
                    <div className={emptyStateClass}>
                      <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No active checklists</p>
                      <p className={`mt-2 text-sm ${secondaryText}`}>
                        Capture the steps to your next project and check items off as you go.
                      </p>
                    </div>
                  ) : (
                    <>
                      {activeLists.length > 0 && (
                        <div className="space-y-3">
                          <p className={`text-xs uppercase tracking-[0.3em] ${mutedText}`}>Active</p>
                          {activeLists.map(renderChecklistCard)}
                        </div>
                      )}
                    </>
                  )}
                </section>
              </main>
            )}
          </div>
        </div>
      </div>

      {archiveNotice && (
        <div className="fixed bottom-6 left-1/2 z-30 w-full max-w-md -translate-x-1/2 px-4">
          <div
            className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm shadow-lg transition ${
              isDarkMode ? 'border-white/15 bg-slate-800/90 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <span>{archiveNotice}</span>
            <button
              type="button"
              onClick={() => setArchiveNotice(null)}
              className={`text-xs uppercase tracking-wide ${
                isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 backdrop-blur-md px-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
              isDarkMode ? 'border-white/10 bg-slate-900/95 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
                <Plus className="h-4 w-4" />
                New checklist
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className={`text-xs uppercase tracking-wide ${
                  isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                close
              </button>
            </div>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                handleCreateChecklist(event)
              }}
            >
              <label className={`block text-sm font-medium ${labelText}`}>
                Title
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Deep work, packing list, release steps…"
                  className={inputClass}
                  required
                  autoFocus
                />
              </label>
              <label className={`block text-sm font-medium ${labelText}`}>
                Prefill tasks (optional)
                <textarea
                  value={prefillItems}
                  onChange={(event) => setPrefillItems(event.target.value)}
                  placeholder="Each line becomes an item"
                  rows={4}
                  className={inputClass}
                />
              </label>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={modalCancelButtonClass}
                >
                  Cancel
                </button>
                <button type="submit" className={modalPrimaryButtonClass}>
                  Save checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </>
  )
}

export default App
