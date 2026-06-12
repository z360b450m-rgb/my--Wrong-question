export interface NoteEntry {
  id: string
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
  // SRS fields (SM-2 algorithm)
  reviewCount?: number
  easeFactor?: number
  interval?: number
  lastReviewDate?: number
  nextReviewDate?: number
}
