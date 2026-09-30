/**
 * Core game states defined in GAME_SPEC.md Section 12.
 */
export type GameStateType =
  | 'MENU'
  | 'PLAYING'
  | 'WAVE_COMPLETE'
  | 'BOSS'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'SUBMITTING_SCORE'
  | 'SCORE_SUBMITTED';
