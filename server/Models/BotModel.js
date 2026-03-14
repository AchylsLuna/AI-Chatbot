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

const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ||
    process.env.GENERATIVE_AI_API_KEY ||
    ''

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    process.env.GEMINI_MODEL_FAST ||
    'gemini-2.5-flash-lite'

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

const callGemini = async ({ userMessage, context, grounding }) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key is not configured.')
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_MODEL
    )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`

    const datasetContext = grounding.datasetMatches.length
        ? grounding.datasetMatches
                .map((entry) => `- ${entry.disease} | matched symptoms: ${entry.matchedSymptoms.join(', ')}`)
                .join('\n')
        : '- No close disease match found from dataset.'

    const triageContext = grounding.urgencyOutcome
        ? `${grounding.urgencyOutcome.title}: ${grounding.urgencyOutcome.text}`
        : 'General guidance: gather symptoms, duration, and severity.'

    const systemInstruction = [
        'You are AI Health Care Assistant for appointment and symptom triage guidance.',
        'Use the provided dataset grounding and triage guidance as the primary source of truth.',
        'Do not present outputs as a definitive diagnosis.',
        'Be concise, structured, and action-oriented.',
        'Always include a safety note when symptoms appear severe.',
    ].join(' ')

    const userPrompt = [
        `User role: ${context?.userRole || 'guest'}`,
        `Signed in: ${Boolean(context?.isIdentified)}`,
        `User message: ${userMessage}`,
        'Grounding from symptoms dataset:',
        datasetContext,
        `Triage guidance: ${triageContext}`,
        'Respond with: summary, possible conditions (if any), suggested next step, and safety note.',
    ].join('\n\n')

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [{ text: userPrompt }],
                },
            ],
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }],
            },
            generationConfig: {
                temperature: 0.35,
                topP: 0.9,
                maxOutputTokens: 420,
            },
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`Gemini API error (${response.status}): ${errorText || 'Unknown error'}`)
    }

    const payload = await response.json()
    const text =
        payload?.candidates?.[0]?.content?.parts
            ?.map((part) => part?.text || '')
            .join('')
            .trim() || ''

    if (!text) {
        throw new Error('Gemini returned an empty response.')
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
        const reply = await callGemini({
            userMessage: safeMessage,
            context,
            grounding,
        })

        return {
            reply,
            meta: {
                model: GEMINI_MODEL,
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
                model: GEMINI_MODEL,
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
                fallbackReason: error instanceof Error ? error.message : 'Unknown Gemini error',
            },
        }
    }
}