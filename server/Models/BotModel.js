import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')

const DATASET_CANDIDATE_PATHS = [
    path.join(REPO_ROOT, 'dataset', 'symptoms_cleaned.csv'),
    path.join(REPO_ROOT, 'server', 'dataset', 'symptoms_cleaned.csv'),
]

const TRIAGE_TREE_CANDIDATE_PATHS = [
    path.join(REPO_ROOT, 'dataset', 'triage_tree.json'),
    path.join(REPO_ROOT, 'server', 'dataset', 'triage_tree.json'),
]

const FASTAPI_BASE_URL = String(
    process.env.FASTAPI_BASE_URL || process.env.FASTAPI_URL || 'http://127.0.0.1:8000'
).trim()

const FASTAPI_CHAT_PATH = String(process.env.FASTAPI_CHAT_PATH || '/chat').trim() || '/chat'

const FASTAPI_TIMEOUT_MS = (() => {
    const parsed = Number(process.env.FASTAPI_TIMEOUT_MS || 15000)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000
})()

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'from',
    'i', 'im', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that',
    'have', 'has', 'had', 'my', 'me', 'you', 'your', 'we', 'our', 'they', 'their',
    'about', 'how', 'what', 'when', 'where', 'why', 'can', 'could', 'should', 'would',
    'please', 'help', 'need', 'want', 'just', 'today', 'yesterday', 'tomorrow',
])

const ALERT_KEYWORDS = [
    'chest pain',
    'shortness of breath',
    'difficulty breathing',
    'fainting',
    'confusion',
    'seizure',
    'severe bleeding',
    'blood in vomit',
    'black stool',
    'vision loss',
    'weakness',
]

let cachedDataset = null
let cachedTriageTree = null

const findExistingPath = (candidates) => candidates.find((candidate) => fs.existsSync(candidate)) || null

const splitCsvRow = (line) => {
    const cells = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        if (char === '"') {
            const next = line[i + 1]
            if (inQuotes && next === '"') {
                current += '"'
                i += 1
            } else {
                inQuotes = !inQuotes
            }
            continue
        }

        if (char === ',' && !inQuotes) {
            cells.push(current.trim())
            current = ''
            continue
        }

        current += char
    }

    cells.push(current.trim())
    return cells
}

const parseSymptomsDataset = () => {
    if (cachedDataset) return cachedDataset

    const datasetPath = findExistingPath(DATASET_CANDIDATE_PATHS)
    if (!datasetPath) {
        cachedDataset = {
            datasetPath: null,
            records: [],
            diseaseIndex: [],
        }
        return cachedDataset
    }

    const raw = fs.readFileSync(datasetPath, 'utf8')
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    if (lines.length <= 1) {
        cachedDataset = {
            datasetPath,
            records: [],
            diseaseIndex: [],
        }
        return cachedDataset
    }

    const records = []
    const diseaseMap = new Map()

    for (let i = 1; i < lines.length; i += 1) {
        const row = splitCsvRow(lines[i])
        const disease = String(row[0] || '').trim()
        if (!disease) continue

        const symptoms = row
            .slice(1)
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)

        if (!symptoms.length) continue

        records.push({ disease, symptoms })

        const existing = diseaseMap.get(disease) || new Set()
        symptoms.forEach((symptom) => existing.add(symptom))
        diseaseMap.set(disease, existing)
    }

    const diseaseIndex = Array.from(diseaseMap.entries()).map(([disease, symptomSet]) => ({
        disease,
        symptoms: Array.from(symptomSet),
    }))

    cachedDataset = {
        datasetPath,
        records,
        diseaseIndex,
    }

    return cachedDataset
}

const parseTriageTree = () => {
    if (cachedTriageTree) return cachedTriageTree

    const triagePath = findExistingPath(TRIAGE_TREE_CANDIDATE_PATHS)
    if (!triagePath) {
        cachedTriageTree = {
            triagePath: null,
            outcomes: {},
        }
        return cachedTriageTree
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(triagePath, 'utf8'))
        cachedTriageTree = {
            triagePath,
            outcomes: parsed?.outcomes || {},
        }
    } catch {
        cachedTriageTree = {
            triagePath,
            outcomes: {},
        }
    }

    return cachedTriageTree
}

const normalizeText = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const toTokens = (value) =>
    normalizeText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token))

const classifyUrgency = (input) => {
    const normalized = normalizeText(input)
    if (!normalized) return 'OUT_GENERAL_GUIDANCE'

    if (ALERT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
        return 'OUT_URGENT_TODAY'
    }
    if (/\b(severe|worse|worsening|cannot breathe|can t breathe|unbearable)\b/.test(normalized)) {
        return 'OUT_URGENT_TODAY'
    }
    if (/\b(chest|breath|faint|seizure|blood|stroke|confusion)\b/.test(normalized)) {
        return 'OUT_APPOINTMENT_SOON'
    }
    if (/\b(fever|cough|vomit|diarrhea|rash|pain|headache|dizzy|nausea)\b/.test(normalized)) {
        return 'OUT_APPOINTMENT_SOON'
    }

    return 'OUT_GENERAL_GUIDANCE'
}

const searchDataset = (input, maxResults = 3) => {
    const { diseaseIndex } = parseSymptomsDataset()
    if (!diseaseIndex.length) return []

    const tokens = toTokens(input)
    if (!tokens.length) return []

    const scored = diseaseIndex
        .map((entry) => {
            const matchedSymptoms = entry.symptoms.filter((symptom) =>
                tokens.some((token) => symptom.includes(token) || token.includes(symptom))
            )

            const overlap = matchedSymptoms.length
            const normalizedScore = overlap / Math.max(3, entry.symptoms.length)
            return {
                disease: entry.disease,
                score: Number((overlap + normalizedScore).toFixed(4)),
                matchedSymptoms,
            }
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)

    return scored
}

const buildGrounding = (userMessage) => {
    const datasetMatches = searchDataset(userMessage)
    const urgencyCode = classifyUrgency(userMessage)
    const { outcomes, triagePath } = parseTriageTree()
    const urgencyOutcome = outcomes?.[urgencyCode] || null

    return {
        datasetSource: parseSymptomsDataset().datasetPath,
        triageSource: triagePath,
        urgencyCode,
        urgencyOutcome,
        datasetMatches,
    }
}

const formatFallbackReply = (userMessage, context) => {
    const grounding = buildGrounding(userMessage)
    const roleLine = context?.userRole ? `Role context: ${context.userRole}.` : 'Role context: guest.'
    const matchLines = grounding.datasetMatches.length
        ? grounding.datasetMatches
                .map((entry, index) => {
                    const symptoms = entry.matchedSymptoms.slice(0, 4).join(', ')
                    return `${index + 1}) ${entry.disease}${symptoms ? ` (matched: ${symptoms})` : ''}`
                })
                .join(' ')
        : 'No close disease match found from dataset yet.'

    const triageSummary = grounding.urgencyOutcome
        ? `${grounding.urgencyOutcome.title}: ${grounding.urgencyOutcome.text}`
        : 'General guidance: describe symptoms, duration, and severity.'

    return [
        'I can still help even when live AI is unavailable.',
        roleLine,
        `Dataset check: ${matchLines}`,
        `Triage suggestion: ${triageSummary}`,
        'This is informational only, not a diagnosis. If symptoms are severe or worsening, seek urgent care now.',
    ].join(' ')
}

const extractFastApiReply = (payload) => {
    if (!payload) return ''
    if (typeof payload === 'string') return payload.trim()

    const direct =
        payload.reply ||
        payload.response ||
        payload.message ||
        payload.text ||
        payload.answer ||
        payload.output ||
        payload.result ||
        payload?.data?.reply ||
        payload?.data?.response

    if (typeof direct === 'string') return direct.trim()

    const nested =
        payload?.choices?.[0]?.message?.content ||
        payload?.choices?.[0]?.text ||
        payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('')

    return typeof nested === 'string' ? nested.trim() : ''
}

const callFastApi = async ({ userMessage, context, grounding }) => {
    if (!FASTAPI_BASE_URL) {
        throw new Error('FastAPI base URL is not configured.')
    }

    let endpoint
    try {
        endpoint = new URL(FASTAPI_CHAT_PATH, FASTAPI_BASE_URL).toString()
    } catch (error) {
        throw new Error(`FastAPI URL is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FASTAPI_TIMEOUT_MS)

    let response
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userMessage,
                context,
                grounding,
            }),
            signal: controller.signal,
        })
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('FastAPI request timed out.')
        }
        throw error
    } finally {
        clearTimeout(timeout)
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`FastAPI error (${response.status}): ${errorText || 'Unknown error'}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text()

    const text = extractFastApiReply(payload)
    if (!text) {
        throw new Error('FastAPI returned an empty response.')
    }

    return text
}

export const fetchBotResponse = async (userMessage, context = {}) => {
    const safeMessage = String(userMessage || '').trim()
    if (!safeMessage) {
        throw new Error('Message is required')
    }

    const grounding = buildGrounding(safeMessage)

    try {
        const reply = await callFastApi({
            userMessage: safeMessage,
            context,
            grounding,
        })

        return {
            reply,
            meta: {
                model: 'fastapi-local',
                dataSources: {
                    symptomsDataset: grounding.datasetSource,
                    triageTree: grounding.triageSource,
                },
                triage: {
                    code: grounding.urgencyCode,
                    outcome: grounding.urgencyOutcome || null,
                },
                matches: grounding.datasetMatches,
                usedFallback: false,
            },
        }
    } catch (error) {
        const fallbackReply = formatFallbackReply(safeMessage, context)
        return {
            reply: fallbackReply,
            meta: {
                model: 'fastapi-local',
                dataSources: {
                    symptomsDataset: grounding.datasetSource,
                    triageTree: grounding.triageSource,
                },
                triage: {
                    code: grounding.urgencyCode,
                    outcome: grounding.urgencyOutcome || null,
                },
                matches: grounding.datasetMatches,
                usedFallback: true,
                fallbackReason: error instanceof Error ? error.message : 'Unknown FastAPI error',
            },
        }
    }
}
