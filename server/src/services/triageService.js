import OpenAI from 'openai'

// --- 1. Constants & Helper Functions (These were missing) ---

export const ALLOWED_DEPARTMENTS = [
  'Cardiology',
  'Dermatology',
  'Gastroenterology',
  'Neurology',
  'Orthopedics',
  'General Medicine',
]

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
  return cleaned.length >= 3 && cleaned.length <= 1000
}

export const getFallbackSummary = (symptoms) => ({
  department: 'General Medicine',
  priority: 'Routine',
  confidence: 0.5,
  summary: `Manual review required for: ${symptoms}`,
  symptoms,
})

// --- 2. Main Service Logic ---

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const generateTriageSummary = async (symptoms) => {
  if (!process.env.OPENAI_API_KEY) {
    return getFallbackSummary(symptoms)
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // or 'gpt-4'
      messages: [
        {
          role: 'system',
          content: `You are a medical triage assistant. 
          Analyze the symptoms and output valid JSON.
          Fields: 
          - department (Must be one of: ${ALLOWED_DEPARTMENTS.join(', ')})
          - priority (Low, Medium, High, Critical)
          - confidence (0.0 to 1.0)
          - summary (Short explanation)
          - symptoms (Cleaned up symptom text)`
        },
        { role: 'user', content: symptoms }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    })

    const content = response.choices[0].message.content
    const result = JSON.parse(content)

    // Validate the output
    const department = normalizeDepartment(result.department, 'General Medicine')
    
    return {
      department,
      priority: result.priority || 'Medium',
      confidence: result.confidence || 0.7,
      summary: result.summary || 'AI Analysis completed.',
      symptoms: result.symptoms || symptoms
    }
  } catch (error) {
    console.error('Triage AI Error:', error)
    return getFallbackSummary(symptoms)
  }
}