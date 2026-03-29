import { Point, Vector, PLAYER_RADIUS, PLAYER_SPEED, PLAYER_ACCEL, PLAYER_FRICTION, COLORS, SLASH_DURATION, SLASH_COOLDOWN, SLASH_RANGE, SLASH_ANGLE } from './constants';

export class Player {
  id: string;
  pos: Point;
  vel: Vector = { x: 0, y: 0 };
  radius: number = PLAYER_RADIUS;
  color: string;
  hasBoomerang: boolean = true;
  isAlive: boolean = true;
  score: number = 0;
  kills: number = 0;
  speedMultiplier: number = 1.0;
  isInvulnerable: boolean = false;
  invulnerabilityTimer: number = 0;
  isMovementReversed: boolean = false;
  reverseMovementTimer: number = 0;
  isElectricBoogalooActive: boolean = false;
  electricBoogalooTimer: number = 0;
  
  // Slash state
  isSlashing: boolean = false;
  slashTimer: number = 0;
  slashCooldown: number = 0;
  facing: Vector = { x: 0, y: 1 };

  // Dash state
  isDashing: boolean = false;
  dashTimer: number = 0;
  dashCooldown: number = 0;
  dashDir: Vector = { x: 0, y: 0 };
  ghosts: { pos: Point; facing: Vector; time: number }[] = [];

  constructor(id: string, x: number, y: number, color: string) {
    this.id = id;
    this.pos = { x, y };
    this.color = color;
    if (id === 'Player 2') this.facing = { x: -1, y: 0 };
    else this.facing = { x: 1, y: 0 };
  }

  update(input: { up: boolean; down: boolean; left: boolean; right: boolean; slash: boolean; dash: boolean }) {
    if (!this.isAlive) return;

    // Apply reversed movement if active
    const actualInput = { ...input };
    if (this.isMovementReversed) {
      if (input.up) { actualInput.up = false; actualInput.down = true; }
      else if (input.down) { actualInput.up = true; actualInput.down = false; }
      
      if (input.left) { actualInput.left = false; actualInput.right = true; }
      else if (input.right) { actualInput.left = true; actualInput.right = false; }
    }

    const currentMaxSpeed = PLAYER_SPEED * this.speedMultiplier;

    // Dash trigger
    if (actualInput.dash && this.dashCooldown <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.dashTimer = 10;
      this.dashCooldown = 40;
      
      // Dash in movement direction if moving, otherwise facing direction
      let dx = 0;
      let dy = 0;
      if (actualInput.up) dy -= 1;
      if (actualInput.down) dy += 1;
      if (actualInput.left) dx -= 1;
      if (actualInput.right) dx += 1;
      
      if (dx === 0 && dy === 0) {
        this.dashDir = { ...this.facing };
      } else {
        const mag = Math.sqrt(dx * dx + dy * dy);
        this.dashDir = { x: dx / mag, y: dy / mag };
      }
    }

    if (this.isDashing) {
      const dashSpeed = currentMaxSpeed * 2;
      this.vel.x = this.dashDir.x * dashSpeed;
      this.vel.y = this.dashDir.y * dashSpeed;
      
      this.dashTimer--;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }

      // Add ghost
      this.ghosts.push({
        pos: { ...this.pos },
        facing: { ...this.facing },
        time: 15 // frames to live
      });
    } else {
      // Apply acceleration
      if (actualInput.up) this.vel.y -= PLAYER_ACCEL;
      if (actualInput.down) this.vel.y += PLAYER_ACCEL;
      if (actualInput.left) this.vel.x -= PLAYER_ACCEL;
      if (actualInput.right) this.vel.x += PLAYER_ACCEL;

      // Apply friction
      this.vel.x *= PLAYER_FRICTION;
      this.vel.y *= PLAYER_FRICTION;

      // Cap speed for normal movement
      const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
      if (speed > currentMaxSpeed) {
        this.vel.x = (this.vel.x / speed) * currentMaxSpeed;
        this.vel.y = (this.vel.y / speed) * currentMaxSpeed;
      }
      
      // Stop completely if very slow
      if (Math.abs(this.vel.x) < 0.1) this.vel.x = 0;
      if (Math.abs(this.vel.y) < 0.1) this.vel.y = 0;
    }

    // Update ghosts
    this.ghosts = this.ghosts.filter(g => {
      g.time--;
      return g.time > 0;
    });

    // Update facing direction
    if (this.vel.x !== 0 || this.vel.y !== 0) {
      const mag = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
      this.facing.x = this.vel.x / mag;
      this.facing.y = this.vel.y / mag;
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    // Slash logic
    if (actualInput.slash && this.slashCooldown <= 0 && this.hasBoomerang) {
      this.isSlashing = true;
      this.slashTimer = SLASH_DURATION;
      this.slashCooldown = SLASH_COOLDOWN;
    }

    if (this.slashTimer > 0) {
      this.slashTimer--;
      if (this.slashTimer <= 0) {
        this.isSlashing = false;
      }
    }

    if (this.slashCooldown > 0) {
      this.slashCooldown--;
    }

    if (this.dashCooldown > 0) {
      this.dashCooldown--;
    }

    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer--;
      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    if (this.reverseMovementTimer > 0) {
      this.reverseMovementTimer--;
      if (this.reverseMovementTimer <= 0) {
        this.isMovementReversed = false;
      }
    }

    if (this.electricBoogalooTimer > 0) {
      this.electricBoogalooTimer--;
      if (this.electricBoogalooTimer <= 0) {
        this.isElectricBoogalooActive = false;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.isAlive) return;

    // Draw ghosts
    this.ghosts.forEach(g => {
      const opacity = g.time / 15;
      ctx.save();
      ctx.globalAlpha = opacity * 0.4;
      this.drawBody(ctx, g.pos, g.facing, true);
      ctx.restore();
    });

    // Draw slash effect
    if (this.isSlashing) {
      const angle = Math.atan2(this.facing.y, this.facing.x);
      const progress = 1 - (this.slashTimer / SLASH_DURATION);
      
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      
      // Neon Glow
      ctx.shadowBlur = 25;
      ctx.shadowColor = this.color;
      
      const startAngle = angle - SLASH_ANGLE / 2 + (progress * SLASH_ANGLE);
      const sweep = SLASH_ANGLE * 0.5;
      
      ctx.arc(this.pos.x, this.pos.y, SLASH_RANGE, startAngle - sweep, startAngle + sweep);
      ctx.stroke();
      
      // Core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.restore();
    }

    this.drawBody(ctx, this.pos, this.facing);
  }

  private drawBody(ctx: CanvasRenderingContext2D, pos: Point, facing: Vector, isGhost: boolean = false) {
    ctx.save();
    
    // Neon Glow for Body
    if (!isGhost) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.isElectricBoogalooActive ? '#FF00FF' : this.color;
      
      // Flashing effect for invulnerability or Electric Boogaloo
      if (this.isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.3;
      }
      if (this.isElectricBoogalooActive) {
        // Bright shine effect
        ctx.shadowBlur = 50;
      }
    }

    const bodyColor = this.isElectricBoogalooActive ? '#FF00FF' : this.color;

    // Outer Ring
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Body Fill
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.radius - 2, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor + '44'; // Semi-transparent
    ctx.fill();
    
    // Core Highlight
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.radius - 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw eyes to show direction
    const eyeOffset = 8;
    const eyeSize = 4;
    
    const nx = facing.x;
    const ny = facing.y;

    // Glowing eyes
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFF';
    ctx.fillStyle = '#FFF';

    ctx.beginPath();
    ctx.arc(pos.x + nx * 10 - ny * eyeOffset, pos.y + ny * 10 + nx * eyeOffset, eyeSize, 0, Math.PI * 2);
    ctx.arc(pos.x + nx * 10 + ny * eyeOffset, pos.y + ny * 10 - nx * eyeOffset, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  triggerDash(dx: number, dy: number) {
    if (this.dashCooldown <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.dashTimer = 10;
      this.dashCooldown = 40;
      this.dashDir = { x: dx, y: dy };
      const mag = Math.sqrt(dx * dx + dy * dy);
      this.dashDir.x /= mag;
      this.dashDir.y /= mag;
    }
  }

  respawn(x: number, y: number) {
    this.pos = { x, y };
    this.isAlive = true;
    this.hasBoomerang = true;
    this.isSlashing = false;
    this.slashTimer = 0;
    this.slashCooldown = 0;
    this.isMovementReversed = false;
    this.reverseMovementTimer = 0;
    this.isElectricBoogalooActive = false;
    this.electricBoogalooTimer = 0;
    this.isInvulnerable = true;
    this.invulnerabilityTimer = 120; // 2 seconds at 60fps
  }
}
