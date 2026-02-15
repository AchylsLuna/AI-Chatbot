type DecisionTreeResult = {
  department: string
  priority: 'Low' | 'Routine' | 'High'
  confidence: number
  matchedKeywords: string[]
  dataset: 'MedQuad'
  model: 'DecisionTree'
}

type DecisionOutcome = Omit<DecisionTreeResult, 'matchedKeywords' | 'dataset' | 'model'>

type DecisionNode = {
  id: string
  keywords: string[]
  yes: DecisionNode | DecisionOutcome
  no: DecisionNode | DecisionOutcome
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

const decisionTree: DecisionNode = {
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

const hasKeyword = (text: string, keyword: string) => text.includes(keyword)

const collectMatches = (text: string, keywords: string[]) =>
  keywords.filter((keyword) => hasKeyword(text, keyword))

const isOutcome = (node: DecisionNode | DecisionOutcome): node is DecisionOutcome =>
  !('keywords' in node)

const upgradePriority = (priority: DecisionOutcome['priority'], text: string) => {
  if (priority === 'High') return priority
  const isUrgent = urgentKeywords.some((keyword) => text.includes(keyword))
  return isUrgent ? 'High' : priority
}

export const decisionTreeTriage = (symptomsText: string): DecisionTreeResult => {
  const normalized = symptomsText.toLowerCase()

  const walk = (node: DecisionNode): { outcome: DecisionOutcome; matched: string[] } => {
    const matched = collectMatches(normalized, node.keywords)
    const branch = matched.length > 0 ? node.yes : node.no
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
    dataset: 'MedQuad',
    model: 'DecisionTree',
  }
}
