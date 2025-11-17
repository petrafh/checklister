import 'dotenv/config'
import cors from 'cors'
import express, { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const PORT = Number(process.env.PORT) || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-prod'
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',').map((value) => value.trim())

const app = express()
app.use(
  cors({
    origin: CORS_ORIGIN && CORS_ORIGIN.length > 0 ? CORS_ORIGIN : '*',
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

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

type UserAccount = {
  id: string
  name: string
  email: string
  passwordHash: string
  checklists: Checklist[]
  createdAt: string
  updatedAt: string
  syncCode: string
}

type PublicUser = Pick<UserAccount, 'id' | 'name' | 'email' | 'createdAt' | 'updatedAt' | 'syncCode'>

type AuthedRequest = Request & { user?: UserAccount }

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

const users = new Map<string, UserAccount>()
const usersByEmail = new Map<string, UserAccount>()

const checklistItemSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().min(1),
  done: z.boolean().optional(),
})

const checklistSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  items: z.array(checklistItemSchema).optional(),
})

const signUpSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const checklistUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  items: z.array(checklistItemSchema).optional(),
})

const profileUpdateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

const bulkChecklistSchema = z.array(checklistSchema)

const createId = () => randomUUID()

const generateSyncCode = () =>
  `CHK-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`

const cloneDefaultLists = (): Checklist[] =>
  defaultLists.map((list) => ({
    id: createId(),
    title: list.title,
    items: list.items.map((item) => ({
      id: createId(),
      text: item.text,
      done: false,
    })),
  }))

const sanitizeChecklist = (incoming: z.infer<typeof checklistSchema>): Checklist => ({
  id: incoming.id || createId(),
  title: incoming.title.trim(),
  items: (incoming.items || []).map((item) => ({
    id: item.id || createId(),
    text: item.text.trim(),
    done: Boolean(item.done),
  })),
})

const sanitizeChecklistUpdate = (incoming: z.infer<typeof checklistUpdateSchema>): Partial<Checklist> => ({
  ...(incoming.title ? { title: incoming.title.trim() } : {}),
  ...(incoming.items
    ? {
        items: incoming.items.map((item) => ({
          id: item.id || createId(),
          text: item.text.trim(),
          done: Boolean(item.done),
        })),
      }
    : {}),
})

const toPublicUser = (user: UserAccount): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  syncCode: user.syncCode,
})

const issueToken = (user: UserAccount) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  )

const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }
  const [, token] = header.split(' ')
  if (!token) {
    return res.status(401).json({ error: 'Invalid Authorization header' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string }
    const user = users.get(payload.sub)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }
    req.user = user
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

app.post('/auth/signup', async (req, res, next) => {
  try {
    const body = signUpSchema.parse(req.body)
    const normalizedEmail = body.email.toLowerCase()
    if (usersByEmail.has(normalizedEmail)) {
      return res.status(409).json({ error: 'Email already registered' })
    }
    const passwordHash = await bcrypt.hash(body.password, 10)
    const timestamp = new Date().toISOString()
    const user: UserAccount = {
      id: createId(),
      name: body.name.trim(),
      email: normalizedEmail,
      passwordHash,
      checklists: cloneDefaultLists(),
      createdAt: timestamp,
      updatedAt: timestamp,
      syncCode: generateSyncCode(),
    }
    users.set(user.id, user)
    usersByEmail.set(normalizedEmail, user)
    const token = issueToken(user)
    res.status(201).json({ token, user: toPublicUser(user), checklists: user.checklists })
  } catch (error) {
    next(error)
  }
})

app.post('/auth/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body)
    const normalizedEmail = body.email.toLowerCase()
    const existing = usersByEmail.get(normalizedEmail)
    if (!existing) {
      return res.status(404).json({ error: 'Account not found' })
    }
    const matches = await bcrypt.compare(body.password, existing.passwordHash)
    if (!matches) {
      return res.status(401).json({ error: 'Incorrect password' })
    }
    const token = issueToken(existing)
    res.json({ token, user: toPublicUser(existing), checklists: existing.checklists })
  } catch (error) {
    next(error)
  }
})

app.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: toPublicUser(req.user!), checklists: req.user!.checklists })
})

app.put('/me', requireAuth, (req: AuthedRequest, res, next) => {
  try {
    const body = profileUpdateSchema.parse(req.body)
    const normalizedEmail = body.email.toLowerCase()
    const user = req.user!
    if (user.email !== normalizedEmail && usersByEmail.has(normalizedEmail)) {
      return res.status(409).json({ error: 'Email already in use' })
    }
    usersByEmail.delete(user.email)
    user.name = body.name.trim()
    user.email = normalizedEmail
    user.updatedAt = new Date().toISOString()
    usersByEmail.set(normalizedEmail, user)
    res.json({ user: toPublicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.get('/checklists', requireAuth, (req: AuthedRequest, res) => {
  res.json({ checklists: req.user!.checklists })
})

app.post('/checklists', requireAuth, (req: AuthedRequest, res, next) => {
  try {
    const parsed = checklistSchema.parse(req.body)
    const newChecklist = sanitizeChecklist(parsed)
    const user = req.user!
    user.checklists.unshift(newChecklist)
    user.updatedAt = new Date().toISOString()
    res.status(201).json({ checklist: newChecklist })
  } catch (error) {
    next(error)
  }
})

app.put('/checklists', requireAuth, (req: AuthedRequest, res, next) => {
  try {
    const parsed = bulkChecklistSchema.parse(req.body)
    const sanitized = parsed.map(sanitizeChecklist)
    const user = req.user!
    user.checklists = sanitized
    user.updatedAt = new Date().toISOString()
    res.json({ checklists: user.checklists })
  } catch (error) {
    next(error)
  }
})

app.put('/checklists/:id', requireAuth, (req: AuthedRequest, res, next) => {
  try {
    const updates = checklistUpdateSchema.parse(req.body)
    const user = req.user!
    const listIndex = user.checklists.findIndex((list) => list.id === req.params.id)
    if (listIndex === -1) {
      return res.status(404).json({ error: 'Checklist not found' })
    }
    const sanitized = sanitizeChecklistUpdate(updates)
    user.checklists[listIndex] = { ...user.checklists[listIndex], ...sanitized }
    user.updatedAt = new Date().toISOString()
    res.json({ checklist: user.checklists[listIndex] })
  } catch (error) {
    next(error)
  }
})

app.delete('/checklists/:id', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!
  const existingLength = user.checklists.length
  user.checklists = user.checklists.filter((list) => list.id !== req.params.id)
  if (user.checklists.length === existingLength) {
    return res.status(404).json({ error: 'Checklist not found' })
  }
  user.updatedAt = new Date().toISOString()
  res.status(204).send()
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation failed', issues: error.flatten() })
  }
  console.error(error)
  return res.status(500).json({ error: 'Unexpected server error' })
})

app.listen(PORT, () => {
  console.log(`Checklister backend listening on http://localhost:${PORT}`)
})
