import type { Timestamp } from 'firebase/firestore';

export type FeedbackRating = 'good' | 'average' | 'poor';

export type ViewMode = 'submit' | 'dashboard';

export interface FeedbackRecord {
  id: string;
  type: FeedbackRating;
  sessionName: string;
  learningPoints: string;
  suggestions: string;
  userId: string;
  timestamp: Timestamp | Date | null;
}

export interface FeedbackCounts {
  total: number;
  good: number;
  average: number;
  poor: number;
}
