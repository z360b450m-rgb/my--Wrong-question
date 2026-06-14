export interface Notebook {
  id: string
  name: string
  description: string
  instructions: string
  sortOrder?: number
  createdAt: number
  updatedAt: number
}

export interface NoteEntry {
  id: string
  notebookId: string
  title: string
  question: string
  wrongAnswer: string
  correctAnswer: string
  subject: string
  source: string
  tags: string[]
  sortOrder?: number
  createdAt: number
  updatedAt: number
  // SRS fields
  reviewCount?: number
  consecutivePasses?: number
  masteryLevel?: number
  easeFactor?: number
  interval?: number
  lastReviewDate?: number
  nextReviewDate?: number
}

export interface ReviewLog {
  id: string
  entryId: string
  timestamp: number
  quality: number | string
}
