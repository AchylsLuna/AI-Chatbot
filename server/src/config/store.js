import crypto from 'node:crypto'

let storeState

const clone = (value) => structuredClone(value)

const matchesFilter = (doc, filter = {}) => {
  const entries = Object.entries(filter || {})
  if (entries.length === 0) return true
  return entries.every(([key, value]) => doc?.[key] === value)
}

class InMemoryCursor {
  constructor(docs, collection) {
    this.docs = docs
    this.collection = collection
    this.max = null
  }

  sort(spec = {}) {
    const [field, direction = 1] = Object.entries(spec)[0] || []
    if (!field) return this

    this.docs.sort((a, b) => {
      const left = a?.[field]
      const right = b?.[field]
      if (left === right) return 0
      if (left == null) return 1
      if (right == null) return -1
      return left > right ? direction : -direction
    })
    return this
  }

  limit(count) {
    this.max = Number.isFinite(count) ? Math.max(0, count) : null
    return this
  }

  async toArray() {
    this.collection.purgeExpired()
    const output = this.max === null ? this.docs : this.docs.slice(0, this.max)
    return output.map(clone)
  }
}

class InMemoryCollection {
  constructor(name) {
    this.name = name
    this.docs = []
    this.uniqueFields = new Set()
    this.ttlField = null
  }

  purgeExpired() {
    if (!this.ttlField) return
    const now = Date.now()
    this.docs = this.docs.filter((doc) => {
      const raw = doc?.[this.ttlField]
      if (!raw) return true
      const expiresAt = new Date(raw).getTime()
      return Number.isNaN(expiresAt) || expiresAt > now
    })
  }

  async createIndex(spec = {}, options = {}) {
    const field = Object.keys(spec)[0]
    if (!field) return field
    if (options.unique) {
      this.uniqueFields.add(field)
    }
    if (typeof options.expireAfterSeconds === 'number') {
      this.ttlField = field
      this.purgeExpired()
    }
    return field
  }

  ensureUnique(nextDoc, currentIndex = -1) {
    for (const field of this.uniqueFields) {
      const value = nextDoc?.[field]
      if (value === undefined) continue
      const duplicate = this.docs.findIndex(
        (doc, index) => index !== currentIndex && doc?.[field] === value
      )
      if (duplicate !== -1) {
        throw new Error(
          `E11000 duplicate key error collection: ${this.name} index: ${field}_1 dup key`
        )
      }
    }
  }

  async countDocuments(filter = {}) {
    this.purgeExpired()
    return this.docs.filter((doc) => matchesFilter(doc, filter)).length
  }

  find(filter = {}) {
    this.purgeExpired()
    const docs = this.docs.filter((doc) => matchesFilter(doc, filter))
    return new InMemoryCursor(docs, this)
  }

  async findOne(filter = {}) {
    this.purgeExpired()
    const found = this.docs.find((doc) => matchesFilter(doc, filter))
    return found ? clone(found) : null
  }

  async insertOne(doc) {
    this.purgeExpired()
    const payload = clone(doc)
    if (payload._id === undefined || payload._id === null) {
      payload._id = `${this.name}-${crypto.randomUUID()}`
    }
    this.ensureUnique(payload)
    this.docs.push(payload)
    return { acknowledged: true, insertedId: payload._id }
  }

  async insertMany(items = []) {
    for (const item of items) {
      await this.insertOne(item)
    }
    return { acknowledged: true, insertedCount: items.length }
  }

  async updateOne(filter = {}, update = {}) {
    this.purgeExpired()
    const index = this.docs.findIndex((doc) => matchesFilter(doc, filter))
    if (index === -1) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
    }

    const current = this.docs[index]
    const patch = update && typeof update === 'object' && '$set' in update ? update.$set : {}
    const next = { ...current, ...clone(patch || {}) }
    this.ensureUnique(next, index)
    this.docs[index] = next
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
  }

  async deleteMany(filter = {}) {
    this.purgeExpired()
    const before = this.docs.length
    this.docs = this.docs.filter((doc) => !matchesFilter(doc, filter))
    return { acknowledged: true, deletedCount: before - this.docs.length }
  }
}

class InMemoryStore {
  constructor() {
    this.collections = new Map()
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new InMemoryCollection(name))
    }
    return this.collections.get(name)
  }
}

const initializeStore = async () => {
  await Promise.all([
    storeState.collection('reservations').createIndex({ id: 1 }, { unique: true }),
    storeState.collection('ledger').createIndex({ reservationId: 1 }, { unique: true }),
    storeState.collection('users').createIndex({ username: 1 }, { unique: true }),
    storeState.collection('audit_logs').createIndex({ createdAt: -1 }),
    storeState.collection('otp_challenges').createIndex({ id: 1 }, { unique: true }),
    storeState.collection('otp_challenges').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ])
}

export const initStore = async () => {
  if (storeState) return storeState
  storeState = new InMemoryStore()
  await initializeStore()
  console.log('Using in-memory store only.')
  return storeState
}

export const getStore = () => {
  if (!storeState) {
    throw new Error('Store not initialized')
  }
  return storeState
}

export const resetStore = async () => {
  storeState = null
}
