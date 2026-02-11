import * as triageService from '../services/triageService.js'

export const getSummary = async (req, res) => {
  const { symptoms } = req.body || {}
  
  // Validation
  if (!symptoms || typeof symptoms !== 'string') {
    return res.status(400).json({ error: 'Describe symptoms.' })
  }
  const cleaned = symptoms.trim()
  if (!triageService.isValidSymptoms(cleaned)) {
    return res.status(400).json({ error: 'Enter clear symptoms.' })
  }

  const start = Date.now()
  try {
    const summary = await triageService.generateTriageSummary(cleaned)
    res.json({ summary, elapsedMs: Date.now() - start })
  } catch (error) {
    console.error('AI Failed, using fallback', error)
    const summary = triageService.getFallbackSummary(cleaned)
    res.json({ summary, elapsedMs: Date.now() - start })
  }
}