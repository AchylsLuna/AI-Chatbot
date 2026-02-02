const PRIORITIES = ['Low', 'Routine', 'High']

const normalizePriority = (value, fallback) => {
  if (typeof value !== 'string') return fallback
  const normalized = value.toLowerCase()
  if (normalized.startsWith('low')) return 'Low'
  if (normalized.startsWith('routine') || normalized.startsWith('medium')) return 'Routine'
  if (normalized.startsWith('high') || normalized.startsWith('urgent')) return 'High'
  return fallback
}

const normalizeConfidence = (value, fallback) => {
  const number = Number(value)
  if (Number.isNaN(number)) return fallback
  if (number > 1 && number <= 100) return Math.round(number) / 100
  return Math.min(1, Math.max(0, number))
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

const inferDepartment = (text) => {
  const content = text.toLowerCase()
  if (content.match(/chest|breath|palpitation|cardio/)) {
    return { department: 'Cardiology', priority: 'Routine', confidence: 0.78 }
  }
  if (content.match(/rash|skin|itch/)) {
    return { department: 'Dermatology', priority: 'Low', confidence: 0.74 }
  }
  if (content.match(/stomach|abdominal|nausea|vomit/)) {
    return { department: 'Gastroenterology', priority: 'Routine', confidence: 0.71 }
  }
  if (content.match(/headache|migraine|dizzy|neuro/)) {
    return { department: 'Neurology', priority: 'Routine', confidence: 0.7 }
  }
  if (content.match(/injury|sprain|fracture|bone|joint/)) {
    return { department: 'Orthopedics', priority: 'Routine', confidence: 0.69 }
  }
  if (content.match(/fever|flu|cough|sore throat/)) {
    return { department: 'General Medicine', priority: 'Routine', confidence: 0.66 }
  }
  return { department: 'General Medicine', priority: 'Low', confidence: 0.62 }
}

const buildFallbackSummary = (symptomsText) => {
  const { department, priority, confidence } = inferDepartment(symptomsText)
  const cleanedSymptoms = symptomsText?.trim()
  const symptoms = cleanedSymptoms || 'No symptoms provided yet.'
  const summary = cleanedSymptoms
    ? `Route to ${department} with ${priority.toLowerCase()} priority based on reported symptoms.`
    : 'No symptoms provided yet.'
  return {
    department,
    priority,
    confidence,
    summary,
    symptoms,
    source: 'rules',
  }
}

const buildPrompt = (symptoms) => {
  return [
    'You are a clinical triage assistant for outpatient scheduling.',
    'Return JSON with keys: department, priority, confidence, summary, symptoms.',
    'priority must be one of: Low, Routine, High.',
    'confidence must be between 0 and 1.',
    'summary should be 1-2 sentences, advice-only, no diagnosis.',
    `Symptoms: ${symptoms}`,
  ].join('\n')
}

export const generateTriageSummary = async (symptomsText) => {
  const fallback = buildFallbackSummary(symptomsText)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallback

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  const response = await fetch(`${baseUrl}/chat/completions`, {
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
          content: buildPrompt(symptomsText),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const parsed = safeParseJson(content)
  if (!parsed) return fallback

  const department =
    typeof parsed.department === 'string' && parsed.department.trim()
      ? parsed.department.trim()
      : fallback.department
  const priority = normalizePriority(parsed.priority, fallback.priority)
  const confidence = normalizeConfidence(parsed.confidence, fallback.confidence)
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : fallback.summary
  const symptoms =
    typeof parsed.symptoms === 'string' && parsed.symptoms.trim()
      ? parsed.symptoms.trim()
      : fallback.symptoms

  return {
    department,
    priority: PRIORITIES.includes(priority) ? priority : fallback.priority,
    confidence,
    summary,
    symptoms,
    source: 'ai',
  }
}

export const getFallbackSummary = (symptomsText) => buildFallbackSummary(symptomsText)
