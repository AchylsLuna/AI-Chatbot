export type TriageSummary = {
  department: string
  priority: 'Low' | 'Routine' | 'High'
  confidence: number
  summary: string
  symptoms: string
  disclaimer: string
  source?: 'ai' | 'rules' | 'decision_tree'
  proof?: {
    version: 'v1'
    issuedAt: number
    expiresAt: number
    nonce: string
    signature: string
  }
}
