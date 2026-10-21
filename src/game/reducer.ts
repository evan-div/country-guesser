import { buildHintLadder } from './hints'
import { evaluate } from './challenges'
import { MAX_HINTS, scoreCorrect } from './scoring'
import type { Challenge, GameState, PlayStyle, Round, RoundResult, Session } from './types'

export const ARCADE_LIVES = 5

export type GameAction =
  | { type: 'START'; style: PlayStyle; challenge: Challenge; code: string; seed: number }
  | { type: 'ARRIVED'; roundId: number }
  | { type: 'HINT'; roundId: number }
  | { type: 'SUBMIT'; roundId: number; input: string }
  | { type: 'REVEAL'; roundId: number }
  | { type: 'NEXT'; code: string; seed: number }
  | { type: 'FINISH' }
  | { type: 'QUIT' }
  | { type: 'DISMISS_NOTICE' }

export const initialGameState: GameState = {
  phase: 'HOME',
  session: null,
  round: null,
  notice: null,
  nextId: 1,
}

function newSession(style: PlayStyle, challenge: Challenge): Session {
  const lives = style === 'arcade' ? ARCADE_LIVES : null
  return {
    style,
    challenge,
    lives,
    maxLives: lives,
    score: 0,
    streak: 0,
    bestStreak: 0,
    bestMultiplier: 1,
    correct: 0,
    incorrect: 0,
    hintsUsed: 0,
    rounds: 0,
    missed: [],
    identified: [],
    over: false,
  }
}

function newRound(id: number, challenge: Challenge, code: string, seed: number): Round {
  return { id, code, challenge, ladder: buildHintLadder(challenge, code, seed), hintsUsed: 0, result: null }
}

const pushUnique = (list: string[], code: string) => (list.includes(code) ? list : [...list, code])

/** Pure state machine for a game session. Every action is guarded by phase and round id. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  const { session, round } = state
  switch (action.type) {
    case 'START': {
      const id = state.nextId
      return {
        phase: 'CAMERA_TRANSITION',
        session: newSession(action.style, action.challenge),
        round: newRound(id, action.challenge, action.code, action.seed),
        notice: null,
        nextId: id + 1,
      }
    }

    case 'ARRIVED':
      if (state.phase !== 'CAMERA_TRANSITION' || round?.id !== action.roundId) return state
      return { ...state, phase: 'GUESSING' }

    case 'HINT': {
      if (state.phase !== 'GUESSING' || !round || !session || round.id !== action.roundId) return state
      if (round.hintsUsed >= MAX_HINTS) return state
      return {
        ...state,
        round: { ...round, hintsUsed: round.hintsUsed + 1 },
        session: { ...session, hintsUsed: session.hintsUsed + 1 },
      }
    }

    case 'SUBMIT': {
      if (state.phase !== 'GUESSING' || !round || !session || round.id !== action.roundId || round.result)
        return state
      const ev = evaluate(round.challenge, round.code, action.input)
      if (ev.kind === 'notice') {
        return { ...state, notice: { id: state.nextId, kind: ev.notice, text: ev.text }, nextId: state.nextId + 1 }
      }
      const arcade = session.style === 'arcade'
      if (ev.correct) {
        const award = scoreCorrect(session.streak, round.hintsUsed, arcade)
        const result: RoundResult = {
          outcome: 'correct',
          input: action.input,
          guessLabel: ev.guessLabel,
          guessCode: ev.guessCode,
          typoOf: ev.typoOf,
          note: ev.note,
          base: award.base,
          multiplier: award.multiplier,
          points: arcade ? award.points : 0,
          streakAfter: award.streak,
          lifeLost: false,
        }
        return {
          ...state,
          phase: 'ANSWER_REVEAL',
          notice: null,
          round: { ...round, result },
          session: {
            ...session,
            score: session.score + result.points,
            streak: award.streak,
            bestStreak: Math.max(session.bestStreak, award.streak),
            bestMultiplier: Math.max(session.bestMultiplier, award.multiplier),
            correct: session.correct + 1,
            rounds: session.rounds + 1,
            identified: pushUnique(session.identified, round.code),
          },
        }
      }
      return applyMiss(state, session, round, {
        outcome: 'wrong',
        input: action.input,
        guessLabel: ev.guessLabel,
        guessCode: ev.guessCode,
        typoOf: ev.typoOf,
        note: ev.note,
      })
    }

    case 'REVEAL': {
      if (state.phase !== 'GUESSING' || !round || !session || round.id !== action.roundId || round.result)
        return state
      if (session.style === 'arcade') return state
      return applyMiss(state, session, round, { outcome: 'revealed', input: '', guessLabel: '' })
    }

    case 'NEXT': {
      if (state.phase !== 'ANSWER_REVEAL' || !session || session.over) return state
      const id = state.nextId
      return {
        ...state,
        phase: 'CAMERA_TRANSITION',
        round: newRound(id, session.challenge, action.code, action.seed),
        notice: null,
        nextId: id + 1,
      }
    }

    case 'FINISH':
      if (!session || state.phase === 'HOME' || state.phase === 'GAME_OVER') return state
      return { ...state, phase: 'GAME_OVER', notice: null, session: { ...session, over: true } }

    case 'QUIT':
      return { ...initialGameState, nextId: state.nextId }

    case 'DISMISS_NOTICE':
      return state.notice ? { ...state, notice: null } : state
  }
}

function applyMiss(
  state: GameState,
  session: Session,
  round: Round,
  partial: Pick<RoundResult, 'outcome' | 'input' | 'guessLabel' | 'guessCode' | 'typoOf' | 'note'>,
): GameState {
  const lives = session.lives === null ? null : Math.max(0, session.lives - 1)
  const result: RoundResult = {
    ...partial,
    base: 0,
    multiplier: 1,
    points: 0,
    streakAfter: 0,
    lifeLost: session.lives !== null,
  }
  return {
    ...state,
    phase: 'ANSWER_REVEAL',
    notice: null,
    round: { ...round, result },
    session: {
      ...session,
      lives,
      streak: 0,
      incorrect: session.incorrect + 1,
      rounds: session.rounds + 1,
      missed: pushUnique(session.missed, round.code),
      over: lives === 0,
    },
  }
}
