import { Point, Vector, BOOMERANG_RADIUS, BOOMERANG_THROW_SPEED, BOOMERANG_ROTATION_SPEED, COLORS } from './constants';

export class Boomerang {
  ownerId: string;
  pos: Point;
  vel: Vector;
  radius: number = BOOMERANG_RADIUS;
  isActive: boolean = true;
  isInitialOverlap: boolean = true;
  trail: Point[] = [];
  maxTrailLength: number = 8;
  color: string;
  isReturning: boolean = false;
  angle: number = 0;

  constructor(ownerId: string, x: number, y: number, vx: number, vy: number, color: string = COLORS.DAGGER) {
    this.ownerId = ownerId;
    this.pos = { x, y };
    this.vel = { x: vx * BOOMERANG_THROW_SPEED, y: vy * BOOMERANG_THROW_SPEED };
    this.color = color;
  }

  update() {
    if (!this.isActive) return;

    // Update trail
    this.trail.unshift({ ...this.pos });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.pop();
    }

    const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    
    // Rotation slows down linearly with speed
    this.angle += BOOMERANG_ROTATION_SPEED * (speed / 10);

    // Friction force: stronger deceleration to feel less floaty
    const frictionMultiplier = 0.985;
    const constantDecel = 0.05;

    if (speed > 0) {
      const newSpeed = Math.max(0, speed * frictionMultiplier - constantDecel);
      const ratio = newSpeed / speed;
      this.vel.x *= ratio;
      this.vel.y *= ratio;
    }

    // Stop completely if very slow
    if (speed < 0.2) {
      this.vel.x = 0;
      this.vel.y = 0;
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.isActive) return;

    // Draw trail (Optimized: single path, no shadowBlur)
    if (this.trail.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.2;
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    
    // Laser Hum (vibration)
    const humX = (Math.random() - 0.5) * 1.5;
    const humY = (Math.random() - 0.5) * 1.5;
    ctx.translate(this.pos.x + humX, this.pos.y + humY);
    ctx.rotate(this.angle);

    // Laser Dagger Shape (Sharp glowing triangle)
    const bladeLength = 25;
    const bladeWidth = 10;
    const hiltSize = 6;

    // Blade Flicker
    const flicker = Math.random() * 0.3 + 0.7;
    ctx.globalAlpha = flicker;

    // Outer Glow (Optimized: lower shadowBlur)
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    
    // Blade (Triangle)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(bladeLength, 0); // Tip
    ctx.lineTo(-bladeLength / 2, -bladeWidth / 2); // Bottom left
    ctx.lineTo(-bladeLength / 2, bladeWidth / 2); // Bottom right
    ctx.closePath();
    ctx.fill();

    // Core (White Triangle)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(bladeLength - 5, 0); // Tip
    ctx.lineTo(-bladeLength / 2 + 3, -bladeWidth / 4); // Bottom left
    ctx.lineTo(-bladeLength / 2 + 3, bladeWidth / 4); // Bottom right
    ctx.closePath();
    ctx.fill();

    // Hilt (Darker)
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(-hiltSize/2 - 10, -hiltSize/2, hiltSize, hiltSize, 1);
    ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(-hiltSize/2 - 10, -hiltSize/2, hiltSize, hiltSize);

    ctx.restore();
  }
}
