const ALLOWED_DEPARTMENTS = [
  'Cardiology',
  'Dermatology',
  'Gastroenterology',
  'Neurology',
  'Orthopedics',
  'General Medicine',
]
const SYMPTOM_KEYWORDS = [
  'chest',
  'breath',
  'palpitation',
  'cardio',
  'rash',
  'skin',
  'itch',
  'stomach',
  'abdominal',
  'nausea',
  'vomit',
  'headache',
  'migraine',
  'dizzy',
  'neuro',
  'injury',
  'sprain',
  'fracture',
  'bone',
  'joint',
  'fever',
  'flu',
  'cough',
  'sore throat',
]
const DISCLAIMER =
  'This recommendation is guidance only. Not a medical diagnosis. For emergencies, contact local services.'
const TAG_REGEX = /<[^>]*>/g

export const normalizeDepartment = (value, fallback) => {
  if (typeof value !== 'string') return fallback
  const cleaned = value.trim()
  if (!cleaned) return fallback
  const match = ALLOWED_DEPARTMENTS.find(
    (department) => department.toLowerCase() === cleaned.toLowerCase()
  )
  return match || fallback
}

export const isValidSymptoms = (value) => {
  if (typeof value !== 'string') return false
  const cleaned = value.trim()
  if (!cleaned) return false
  const lower = cleaned.toLowerCase()
  const letters = (lower.match(/[a-z]/g) || []).length
  if (letters < 3) return false
  const hasKeyword = SYMPTOM_KEYWORDS.some((keyword) => lower.includes(keyword))
  if (hasKeyword) return true
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length
  if (wordCount < 2) return false
  if (cleaned.length < 8) return false
  return true
}

const removeControlChars = (value) =>
  [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      const isAsciiControl = code <= 31 || code === 127
      const isC1Control = code >= 128 && code <= 159
      return !isAsciiControl && !isC1Control
    })
    .join('')

const sanitizeText = (value) => {
  if (typeof value !== 'string') return ''
  const normalized = removeControlChars(value).replace(TAG_REGEX, '').trim()
  return normalized
}

const safeParseJson = (value) => {
  if (!value || typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch (error) {
    const match = value.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch (innerError) {
      return null
    }
  }
}

const urgentKeywords = [
  'severe',
  'unbearable',
  'faint',
  'fainting',
  'unconscious',
  'difficulty breathing',
  'shortness of breath',
  'chest pain',
  'heavy bleeding',
]

const decisionTree = {
  id: 'cardio',
  keywords: ['chest', 'breath', 'palpitation', 'cardio'],
  yes: { department: 'Cardiology', priority: 'Routine', confidence: 0.82 },
  no: {
    id: 'derm',
    keywords: ['rash', 'skin', 'itch'],
    yes: { department: 'Dermatology', priority: 'Low', confidence: 0.75 },
    no: {
      id: 'gastro',
      keywords: ['stomach', 'abdominal', 'nausea', 'vomit'],
      yes: { department: 'Gastroenterology', priority: 'Routine', confidence: 0.72 },
      no: {
        id: 'neuro',
        keywords: ['headache', 'migraine', 'dizzy', 'neuro'],
        yes: { department: 'Neurology', priority: 'Routine', confidence: 0.7 },
        no: {
          id: 'ortho',
          keywords: ['injury', 'sprain', 'fracture', 'bone', 'joint'],
          yes: { department: 'Orthopedics', priority: 'Routine', confidence: 0.69 },
          no: {
            id: 'general',
            keywords: ['fever', 'flu', 'cough', 'sore throat'],
            yes: { department: 'General Medicine', priority: 'Routine', confidence: 0.66 },
            no: { department: 'General Medicine', priority: 'Low', confidence: 0.62 },
          },
        },
      },
    },
  },
}

const collectMatches = (text, keywords) => keywords.filter((keyword) => text.includes(keyword))
const isOutcome = (node) => !node.keywords

const upgradePriority = (priority, text) => {
  if (priority === 'High') return priority
  const urgent = urgentKeywords.some((keyword) => text.includes(keyword))
  return urgent ? 'High' : priority
}

const decisionTreeTriage = (text) => {
  const normalized = text.toLowerCase()
  const walk = (node) => {
    const matched = collectMatches(normalized, node.keywords)
    const branch = matched.length ? node.yes : node.no
    if (isOutcome(branch)) {
      return { outcome: branch, matched }
    }
    const next = walk(branch)
    return { outcome: next.outcome, matched: [...matched, ...next.matched] }
  }

  const { outcome, matched } = walk(decisionTree)
  return {
    department: outcome.department,
    priority: upgradePriority(outcome.priority, normalized),
    confidence: outcome.confidence,
    matchedKeywords: matched,
  }
}

const buildFallbackSummary = (symptomsText, decision) => {
  const resolvedDecision = decision || decisionTreeTriage(symptomsText)
  const cleanedSymptoms = sanitizeText(symptomsText)
  const symptoms = cleanedSymptoms || 'No symptoms provided yet.'
  const keywordHint = resolvedDecision.matchedKeywords?.length
    ? ` based on ${resolvedDecision.matchedKeywords.slice(0, 3).join(', ')}`
    : ''
  const summary = cleanedSymptoms
    ? `Decision Tree (MedQuad-informed) recommends ${resolvedDecision.department}${keywordHint}.`
    : 'No symptoms provided yet.'
  return {
    department: normalizeDepartment(resolvedDecision.department, 'General Medicine'),
    priority: resolvedDecision.priority,
    confidence: resolvedDecision.confidence,
    summary,
    symptoms,
    disclaimer: DISCLAIMER,
    source: 'decision_tree',
  }
}

const buildPrompt = (symptoms) => {
  return [
    'You are a clinical triage assistant for outpatient scheduling.',
    'Use a MedQuad-informed Decision Tree to determine the department and priority.',
    'Return JSON with keys: department, priority, confidence, summary, symptoms.',
    `department must be one of: ${ALLOWED_DEPARTMENTS.join(', ')}.`,
    'priority must be one of: Low, Routine, High.',
    'confidence must be between 0 and 1.',
    'summary should be 1-2 sentences, advice-only, no diagnosis.',
    `Symptoms: ${symptoms}`,
  ].join('\n')
}

export const generateTriageSummary = async (symptomsText) => {
  const safeSymptomsInput = sanitizeText(symptomsText)
  const decision = decisionTreeTriage(safeSymptomsInput)
  const fallback = buildFallbackSummary(safeSymptomsInput, decision)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallback

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const timeoutMs = Math.min(Number(process.env.OPENAI_TIMEOUT_MS) || 4500, 5000)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a cautious triage assistant. Output JSON only.',
          },
          {
            role: 'user',
            content: buildPrompt(safeSymptomsInput),
          },
        ],
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const parsed = safeParseJson(content)
  if (!parsed) return fallback

  const summaryRaw =
    typeof parsed.summary === 'string' && sanitizeText(parsed.summary)
      ? sanitizeText(parsed.summary)
      : fallback.summary
  const symptoms =
    typeof parsed.symptoms === 'string' && sanitizeText(parsed.symptoms)
      ? sanitizeText(parsed.symptoms)
      : fallback.symptoms
  const summary = summaryRaw.includes('Decision Tree')
    ? summaryRaw
    : `${summaryRaw} Decision Tree (MedQuad-informed) recommendation.`

  return {
    department: decision.department,
    priority: decision.priority,
    confidence: decision.confidence,
    summary,
    symptoms,
    disclaimer: DISCLAIMER,
    source: 'ai',
  }
}

export const getFallbackSummary = (symptomsText) => buildFallbackSummary(symptomsText)
