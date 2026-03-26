import { Point, Vector } from './constants';

export enum GameState {
  LOBBY,
  PLAYING,
  GAME_OVER,
}

export interface Entity {
  id: string;
  pos: Point;
  vel: Vector;
  radius: number;
  color: string;
  update: (dt: number) => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
}
