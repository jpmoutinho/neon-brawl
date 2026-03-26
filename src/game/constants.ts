export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 600;

export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 5;
export const PLAYER_ACCEL = 1.2;
export const PLAYER_FRICTION = 0.82;

export const BOOMERANG_RADIUS = 10;
export const BOOMERANG_THROW_SPEED = 21.6;
export const BOOMERANG_RETURN_ACCEL = 0.8;
export const BOOMERANG_MAX_BOUNCES = 3;
export const BOOMERANG_ROTATION_SPEED = 0.3;
export const BOOMERANG_FRICTION = 0.99;

export const SLASH_COOLDOWN = 20; // frames
export const SLASH_DURATION = 10; // frames
export const SLASH_RANGE = 45;
export const SLASH_ANGLE = Math.PI / 1.5;

export const COLORS = {
  PLAYER1: '#00FFFF', // Neon Teal/Cyan
  PLAYER2: '#FF3131', // Neon Red
  DAGGER: '#39FF14',  // Neon Green
  WALL: '#1A0033',    // Dark Purple
  BACKGROUND: '#050505', // Deep Black
  GLOW: '#FFFFFF',
  ENV: '#FF00FF',     // Neon Pink
};

export const NEON_PALETTE = [
  '#FF00FF', // Pink
  '#00FFFF', // Cyan
  '#39FF14', // Green
  '#FFFF00', // Yellow
  '#FF3131', // Red
  '#FF5E00', // Orange
  '#BC13FE', // Purple
  '#0FF0FC', // Electric Blue
  '#83EEFF', // Sky Blue
  '#FF007F', // Rose
];

export type Point = { x: number; y: number };
export type Vector = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
