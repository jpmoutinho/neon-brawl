import { Point, POWERUP_RADIUS, COLORS } from './constants';

export enum PowerupType {
  REVERSE_MOVEMENT = 'reverse_movement',
  ELECTRIC_BOOGALOO = 'electric_boogaloo'
}

export class Powerup {
  id: string;
  pos: Point;
  type: PowerupType;
  radius: number = POWERUP_RADIUS;
  life: number = 600; // 10 seconds to pick up

  constructor(id: string, x: number, y: number, type: PowerupType) {
    this.id = id;
    this.pos = { x, y };
    this.type = type;
  }

  update() {
    this.life--;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const time = performance.now() / 1000;
    const bounce = Math.sin(time * 5) * 5;
    const alpha = this.life < 120 ? (this.life / 120) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.pos.x, this.pos.y + bounce);

    // Glow
    ctx.shadowBlur = 20;
    const color = this.type === PowerupType.ELECTRIC_BOOGALOO ? '#FF00FF' : '#FFFF00';
    ctx.shadowColor = color;

    // Outer circle
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner icon
    if (this.type === PowerupType.REVERSE_MOVEMENT) {
      this.drawReverseArrow(ctx);
    } else if (this.type === PowerupType.ELECTRIC_BOOGALOO) {
      this.drawElectricIcon(ctx);
    }

    ctx.restore();
  }

  private drawReverseArrow(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    
    // Two curved arrows in a circle
    const r = this.radius * 0.6;
    
    // Top arrow
    ctx.arc(0, 0, r, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    
    // Arrow head for top
    ctx.save();
    ctx.translate(Math.cos(-Math.PI * 0.2) * r, Math.sin(-Math.PI * 0.2) * r);
    ctx.rotate(-Math.PI * 0.2 + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4, 4);
    ctx.stroke();
    ctx.restore();

    // Bottom arrow
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();

    // Arrow head for bottom
    ctx.save();
    ctx.translate(Math.cos(Math.PI * 0.8) * r, Math.sin(Math.PI * 0.8) * r);
    ctx.rotate(Math.PI * 0.8 + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4, 4);
    ctx.stroke();
    ctx.restore();
  }

  private drawElectricIcon(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 2;
    
    const r = this.radius * 0.6;
    // Bolt shape
    ctx.moveTo(0, -r);
    ctx.lineTo(-r/2, 0);
    ctx.lineTo(r/4, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(r/2, 0);
    ctx.lineTo(-r/4, 0);
    ctx.closePath();
    ctx.stroke();
    
    ctx.fillStyle = '#FF00FF44';
    ctx.fill();
  }
}
