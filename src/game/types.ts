export type PlayStyle = 'arcade' | 'practice' | 'echo'
export type Challenge = 'country' | 'capital' | 'neighbors'

/**
 * Game phases. HOME = no active session; CAMERA_TRANSITION = flying to the next target
 * (submissions are ignored); GUESSING = input enabled; ANSWER_REVEAL = feedback card;
 * GAME_OVER = results screen.
 */
export type Phase = 'HOME' | 'CAMERA_TRANSITION' | 'GUESSING' | 'ANSWER_REVEAL' | 'GAME_OVER'

/** A word of a letter pattern; null = hidden letter. Non-letters are always shown. */
export type PatternWord = (string | null)[]

export interface Hint {
  level: number
  label: string
  text: string
  /** Countries to highlight on the globe (never labelled during guessing). */
  highlight?: string[]
  pattern?: PatternWord[]
}

export type Outcome = 'correct' | 'wrong' | 'revealed'

export interface RoundResult {
  outcome: Outcome
  input: string
  /** What the player's answer was understood as (country name, capital…). */
  guessLabel: string
  guessCode?: string
  typoOf?: string
  note?: string
  base: number
  multiplier: number
  points: number
  streakAfter: number
  lifeLost: boolean
}

export interface Round {
  id: number
  code: string
  challenge: Challenge
  ladder: Hint[]
  hintsUsed: number
  result: RoundResult | null
}

export interface Session {
  style: PlayStyle
  challenge: Challenge
  /** null = unlimited (practice / echo). */
  lives: number | null
  maxLives: number | null
  score: number
  streak: number
  bestStreak: number
  bestMultiplier: number
  correct: number
  incorrect: number
  hintsUsed: number
  rounds: number
  missed: string[]
  identified: string[]
  over: boolean
}

export type NoticeKind = 'empty' | 'ambiguous' | 'unknown' | 'partOf' | 'self'

export interface Notice {
  id: number
  kind: NoticeKind
  text: string
}

export interface GameState {
  phase: Phase
  session: Session | null
  round: Round | null
  notice: Notice | null
  nextId: number
}
