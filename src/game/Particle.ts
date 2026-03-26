import { Point, Vector } from './constants';

export class Particle {
  pos: Point;
  vel: Vector;
  life: number = 1.0;
  color: string;
  size: number;

  constructor(x: number, y: number, color: string) {
    this.pos = { x, y };
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    this.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    this.color = color;
    this.size = Math.random() * 4 + 2;
  }

  update() {
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.vel.x *= 0.95;
    this.vel.y *= 0.95;
    this.life -= 0.02;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
