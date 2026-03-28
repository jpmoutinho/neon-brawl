import { Player } from './Player';
import { Boomerang } from './Boomerang';
import { Particle } from './Particle';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, SLASH_RANGE, SLASH_ANGLE, Point, Rect } from './constants';
import { GameState, PlayerInput } from './MultiplayerManager';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  players: Player[] = [];
  boomerangs: Boomerang[] = [];
  particles: Particle[] = [];
  lightBursts: { x: number; y: number; radius: number; maxRadius: number; life: number; color: string }[] = [];
  obstacles: Rect[] = [];
  keys: Set<string> = new Set();
  lastTime: number = 0;
  isRunning: boolean = false;
  isPaused: boolean = false;
  onGameOver?: (winnerId: string) => void;
  onKillsUpdate?: (p1Kills: number, p2Kills: number) => void;
  onPauseToggle?: (isPaused: boolean) => void;

  // Aiming state
  isAiming: boolean = false;
  mousePos: Point = { x: 0, y: 0 };

  // Multiplayer state
  isMultiplayer: boolean = false;
  isHost: boolean = false;
  remoteInput: PlayerInput = { up: false, down: false, left: false, right: false, slash: false, dash: false, mousePos: { x: 0, y: 0 }, isThrowing: false };
  onStateUpdate?: (state: GameState) => void;
  onInputUpdate?: (input: PlayerInput) => void;

  // Track remote throw
  private p2WasThrowing: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.setupInput();
    this.init();
    requestAnimationFrame(this.loop.bind(this));
  }

  private getLocalPlayer(): Player | undefined {
    const index = (this.isMultiplayer && !this.isHost) ? 1 : 0;
    return this.players[index];
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isRunning) {
        this.togglePause();
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.canvas.addEventListener('mousedown', (e) => {
      const lp = this.getLocalPlayer();
      if (lp && lp.isAlive && lp.hasBoomerang) {
        this.isAiming = true;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;
    });

    window.addEventListener('mouseup', () => {
      if (this.isAiming) {
        this.isAiming = false;
        
        // Only host actually executes the throw in simulation
        if (!this.isMultiplayer || this.isHost) {
          const lp = this.getLocalPlayer();
          if (lp && lp.isAlive && lp.hasBoomerang) {
            const dx = this.mousePos.x - lp.pos.x;
            const dy = this.mousePos.y - lp.pos.y;
            const mag = Math.sqrt(dx * dx + dy * dy);
            
            if (mag > 5) {
              const vx = dx / mag;
              const vy = dy / mag;
              this.throwBoomerang(lp, vx, vy, 1.0); // Full speed
            }
          }
        }
      }
    });
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.onPauseToggle) {
      this.onPauseToggle(this.isPaused);
    }
    if (!this.isPaused) {
      this.lastTime = performance.now();
      if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
    } else {
      if (this.audioCtx?.state === 'running') this.audioCtx.suspend();
    }
  }

  init(config?: { p1Color?: string; p2Color?: string; speedMultiplier?: number; envColor?: string }) {
    console.log('[Engine] Initializing. Multiplayer:', this.isMultiplayer, 'Host:', this.isHost);
    const p1Color = config?.p1Color || COLORS.PLAYER1;
    const p2Color = config?.p2Color || COLORS.PLAYER2;
    const speedMultiplier = config?.speedMultiplier || 1.0;
    this.envColor = config?.envColor || COLORS.ENV;
    this.p2WasThrowing = false;

    if (this.isRunning) {
      this.players = [
        new Player('Player 1', 150, CANVAS_HEIGHT / 2, p1Color),
        new Player('Player 2', CANVAS_WIDTH - 150, CANVAS_HEIGHT / 2, p2Color),
      ];
      this.players.forEach(p => p.speedMultiplier = speedMultiplier);

      this.boomerangs = [];
      this.particles = [];
      
      // Scale obstacles for larger map
      this.obstacles = [
        { x: 300, y: 150, width: 60, height: 300 },
        { x: CANVAS_WIDTH - 360, y: 150, width: 60, height: 300 },
        { x: 500, y: 100, width: 200, height: 60 },
        { x: 500, y: CANVAS_HEIGHT - 160, width: 200, height: 60 },
      ];
    } else {
      this.players = [];
      this.boomerangs = [];
      this.particles = [];
      this.obstacles = [];
    }

    this.initAudio();
  }

  private initAudio() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error('AudioContext not supported');
    }
  }

  private playSound(freq: number, type: OscillatorType = 'sine', duration: number = 0.1, volume: number = 0.1, sweep: boolean = false) {
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
    
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    if (sweep) {
      osc.frequency.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + duration);
    }
    
    gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  private startMusic() {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    
    if (this.musicOsc) return;

    this.musicGain = this.audioCtx.createGain();
    this.musicGain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
    this.musicGain.connect(this.audioCtx.destination);

    // Simple 80s synth bass loop
    const notes = [55, 55, 65, 55, 73, 55, 65, 82]; // Hz
    let noteIdx = 0;

    const playNextNote = () => {
      if (!this.isRunning || this.isPaused) return;
      
      const osc = this.audioCtx!.createOscillator();
      const g = this.audioCtx!.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(notes[noteIdx], this.audioCtx!.currentTime);
      
      g.gain.setValueAtTime(0.05, this.audioCtx!.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx!.currentTime + 0.2);
      
      osc.connect(g);
      g.connect(this.musicGain!);
      
      osc.start();
      osc.stop(this.audioCtx!.currentTime + 0.2);
      
      noteIdx = (noteIdx + 1) % notes.length;
      setTimeout(playNextNote, 200);
    };

    playNextNote();
  }

  start(config?: { p1Color?: string; p2Color?: string; speedMultiplier?: number; envColor?: string }) {
    console.log('[Engine] Starting. Multiplayer:', this.isMultiplayer, 'Host:', this.isHost);
    if (!this.isRunning) {
      this.isRunning = true;
      this.init(config);
      this.lastTime = performance.now();
      this.startMusic();
    }
  }

  loop(timestamp: number) {
    if (this.isPaused) {
      requestAnimationFrame(this.loop.bind(this));
      return;
    }

    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.isRunning) {
      this.update();
    }
    this.draw();

    requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.screenShake = 0;
    this.keys.clear();
    this.init();
  }

  // Visual effects state
  screenShake: number = 0;
  envColor: string = COLORS.ENV;

  // Audio state
  audioCtx: AudioContext | null = null;
  musicOsc: OscillatorNode | null = null;
  musicGain: GainNode | null = null;

  update() {
    if (this.isMultiplayer && !this.isHost) {
      // Client only sends inputs
      if (this.onInputUpdate) {
        const input: PlayerInput = {
          up: this.keys.has('KeyW'),
          down: this.keys.has('KeyS'),
          left: this.keys.has('KeyA'),
          right: this.keys.has('KeyD'),
          slash: this.keys.has('Space'),
          dash: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
          mousePos: { ...this.mousePos },
          isThrowing: this.isAiming,
        };
        this.onInputUpdate(input);
      }
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake *= 0.9;
      if (this.screenShake < 0.1) this.screenShake = 0;
    }

    // Player 1 controls (WASD + Shift/Space)
    const p1 = this.players[0];
    if (p1.isAlive) {
      const wasSlashing = p1.isSlashing;
      const wasDashing = p1.isDashing;
      
      p1.update({
        up: this.keys.has('KeyW'),
        down: this.keys.has('KeyS'),
        left: this.keys.has('KeyA'),
        right: this.keys.has('KeyD'),
        slash: this.keys.has('Space'),
        dash: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      });
      if (!wasSlashing && p1.isSlashing) {
        this.playSound(1200, 'sine', 0.2, 0.1, true); // Consistent with throw sound
      }
      if (!wasDashing && p1.isDashing) {
        this.playSound(880, 'sine', 0.1, 0.05, true); // Dash sound
      }
    }

    // Player 2 - AI Bot or Remote Player
    const p2 = this.players[1];
    if (p2.isAlive) {
      const wasSlashing = p2.isSlashing;
      const wasDashing = p2.isDashing;
      
      if (this.isMultiplayer && this.isHost) {
        // Handle remote throw for P2
        if (this.p2WasThrowing && !this.remoteInput.isThrowing && p2.hasBoomerang) {
          const dx = this.remoteInput.mousePos.x - p2.pos.x;
          const dy = this.remoteInput.mousePos.y - p2.pos.y;
          const mag = Math.sqrt(dx * dx + dy * dy);
          if (mag > 5) {
            this.throwBoomerang(p2, dx / mag, dy / mag, 1.0);
          }
        }
        this.p2WasThrowing = this.remoteInput.isThrowing;

        // Use remote input for P2
        p2.update(this.remoteInput);
      } else {
        // AI Bot
        const aiInput = this.getAIInput(p2, p1);
        p2.update(aiInput);
      }

      if (!wasSlashing && p2.isSlashing) {
        this.playSound(1200, 'sine', 0.2, 0.1, true); // Consistent with throw sound
      }
      if (!wasDashing && p2.isDashing) {
        this.playSound(880, 'sine', 0.1, 0.05, true); // Dash sound
      }

      // AI Throw logic (only if not multiplayer)
      if (!this.isMultiplayer && p2.hasBoomerang && !p2.isDashing) {
        const dx = p1.pos.x - p2.pos.x;
        const dy = p1.pos.y - p2.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Throw if player is at medium range
        if (dist > 150 && dist < 400 && Math.random() < 0.02) {
          const mag = Math.sqrt(dx * dx + dy * dy);
          this.throwBoomerang(p2, dx / mag, dy / mag, 1.2);
        }
      }
    }

    // Slash collisions
    this.players.forEach(attacker => {
      if (attacker.isAlive && attacker.isSlashing) {
        // Player vs Player hits
        this.players.forEach(victim => {
          if (attacker.id !== victim.id && victim.isAlive) {
            const dx = victim.pos.x - attacker.pos.x;
            const dy = victim.pos.y - attacker.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < SLASH_RANGE + victim.radius) {
              const angleToVictim = Math.atan2(dy, dx);
              const facingAngle = Math.atan2(attacker.facing.y, attacker.facing.x);
              let diff = angleToVictim - facingAngle;
              
              // Normalize angle diff
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              
              if (Math.abs(diff) < SLASH_ANGLE / 2 + 0.2) {
                this.killPlayer(victim, attacker.id);
              }
            }
          }
        });

        // Player vs Dagger deflection
        this.boomerangs.forEach(b => {
          const dx = b.pos.x - attacker.pos.x;
          const dy = b.pos.y - attacker.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < SLASH_RANGE + b.radius + 15) {
            const angleToDagger = Math.atan2(dy, dx);
            const facingAngle = Math.atan2(attacker.facing.y, attacker.facing.x);
            let diff = angleToDagger - facingAngle;
            
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            
            if (Math.abs(diff) < SLASH_ANGLE / 2 + 0.4) {
              // Deflect!
              const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
              const newSpeed = Math.min(Math.max(speed * 2, 15), 40);
              
              b.vel.x = attacker.facing.x * newSpeed;
              b.vel.y = attacker.facing.y * newSpeed;
              
              // Push out to prevent re-triggering
              b.pos.x = attacker.pos.x + attacker.facing.x * (SLASH_RANGE + 20);
              b.pos.y = attacker.pos.y + attacker.facing.y * (SLASH_RANGE + 20);

              this.playSound(180, 'sawtooth', 0.25, 0.2); // Electric hum collision sound
              this.createElectricBurst(b.pos.x, b.pos.y);
              this.screenShake = 8;
            }
          }
        });
      }
    });

    // Dagger-Dagger collisions
    for (let i = 0; i < this.boomerangs.length; i++) {
      for (let j = i + 1; j < this.boomerangs.length; j++) {
        const b1 = this.boomerangs[i];
        const b2 = this.boomerangs[j];
        
        const dx = b2.pos.x - b1.pos.x;
        const dy = b2.pos.y - b1.pos.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = b1.radius + b2.radius + 10; // Larger hitbox for easier collision
        
        if (distSq < radiusSum * radiusSum) {
          const dist = Math.sqrt(distSq);
          if (dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            
            const rvx = b2.vel.x - b1.vel.x;
            const rvy = b2.vel.y - b1.vel.y;
            const velAlongNormal = rvx * nx + rvy * ny;
            
            if (velAlongNormal < 0) {
              // Elastic collision
              const impulse = velAlongNormal;
              b1.vel.x += impulse * nx;
              b1.vel.y += impulse * ny;
              b2.vel.x -= impulse * nx;
              b2.vel.y -= impulse * ny;
              
              // Double speed
              b1.vel.x *= 2;
              b1.vel.y *= 2;
              b2.vel.x *= 2;
              b2.vel.y *= 2;
              
              const maxSpeed = 40;
              const s1 = Math.sqrt(b1.vel.x * b1.vel.x + b1.vel.y * b1.vel.y);
              const s2 = Math.sqrt(b2.vel.x * b2.vel.x + b2.vel.y * b2.vel.y);
              if (s1 > maxSpeed) { b1.vel.x = (b1.vel.x / s1) * maxSpeed; b1.vel.y = (b1.vel.y / s1) * maxSpeed; }
              if (s2 > maxSpeed) { b2.vel.x = (b2.vel.x / s2) * maxSpeed; b2.vel.y = (b2.vel.y / s2) * maxSpeed; }

              // Push apart
              const overlap = radiusSum - dist;
              b1.pos.x -= nx * overlap / 2;
              b1.pos.y -= ny * overlap / 2;
              b2.pos.x += nx * overlap / 2;
              b2.pos.y += ny * overlap / 2;
              
              this.playSound(180, 'sawtooth', 0.25, 0.2); // Electric hum collision sound
              this.createElectricBurst(b1.pos.x + nx * b1.radius, b1.pos.y + ny * b1.radius);
              this.screenShake = 10;
            }
          }
        }
      }
    }

    // Update Boomerangs
    for (let i = this.boomerangs.length - 1; i >= 0; i--) {
      const b = this.boomerangs[i];
      
      // Recall force
      const owner = this.players.find(p => p.id === b.ownerId);
      if (owner && owner.isAlive && !owner.hasBoomerang) {
        let shouldRecall = false;
        if (owner.id === 'Player 1') {
          shouldRecall = this.keys.has('Space');
        } else {
          if (this.isMultiplayer && this.isHost) {
            shouldRecall = this.remoteInput.slash;
          } else {
            // AI recalls if boomerang is far or slow
            const dx = owner.pos.x - b.pos.x;
            const dy = owner.pos.y - b.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
            if (dist > 300 || speed < 5) {
              shouldRecall = true;
            }
          }
        }

        if (shouldRecall) {
          const dx = owner.pos.x - b.pos.x;
          const dy = owner.pos.y - b.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const force = 0.5;
            b.vel.x += (dx / dist) * force;
            b.vel.y += (dy / dist) * force;
            
            // Cap speed during recall
            const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
            const maxRecallSpeed = 15;
            if (speed > maxRecallSpeed) {
              b.vel.x = (b.vel.x / speed) * maxRecallSpeed;
              b.vel.y = (b.vel.y / speed) * maxRecallSpeed;
            }
          }
        }
      }

      b.update();

      // Remove boomerang if owner is dead
      const bOwner = this.players.find(p => p.id === b.ownerId);
      if (!bOwner || !bOwner.isAlive) {
        this.boomerangs.splice(i, 1);
        continue;
      }

      // Wall collisions (bounce)
      if (b.pos.x < b.radius) {
        b.pos.x = b.radius;
        b.vel.x *= -0.8;
      } else if (b.pos.x > CANVAS_WIDTH - b.radius) {
        b.pos.x = CANVAS_WIDTH - b.radius;
        b.vel.x *= -0.8;
      }
      
      if (b.pos.y < b.radius) {
        b.pos.y = b.radius;
        b.vel.y *= -0.8;
      } else if (b.pos.y > CANVAS_HEIGHT - b.radius) {
        b.pos.y = CANVAS_HEIGHT - b.radius;
        b.vel.y *= -0.8;
      }

      // Obstacle collisions
      this.obstacles.forEach(obs => {
        const closestX = Math.max(obs.x, Math.min(b.pos.x, obs.x + obs.width));
        const closestY = Math.max(obs.y, Math.min(b.pos.y, obs.y + obs.height));
        const dx = b.pos.x - closestX;
        const dy = b.pos.y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < b.radius * b.radius) {
          const dist = Math.sqrt(distSq);
          
          if (dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = b.radius - dist;
            
            // Reflect velocity: v = v - 2 * (v . n) * n
            const dot = b.vel.x * nx + b.vel.y * ny;
            if (dot < 0) {
              b.vel.x = (b.vel.x - 2 * dot * nx) * 0.8;
              b.vel.y = (b.vel.y - 2 * dot * ny) * 0.8;
            }
            
            b.pos.x += nx * overlap;
            b.pos.y += ny * overlap;
          } else {
            // Perfectly inside or on edge - push out to nearest side
            const distLeft = Math.abs(b.pos.x - obs.x);
            const distRight = Math.abs(b.pos.x - (obs.x + obs.width));
            const distTop = Math.abs(b.pos.y - obs.y);
            const distBottom = Math.abs(b.pos.y - (obs.y + obs.height));
            const minDist = Math.min(distLeft, distRight, distTop, distBottom);

            if (minDist === distLeft) {
              b.pos.x = obs.x - b.radius;
              b.vel.x = -Math.abs(b.vel.x) * 0.8;
            } else if (minDist === distRight) {
              b.pos.x = obs.x + obs.width + b.radius;
              b.vel.x = Math.abs(b.vel.x) * 0.8;
            } else if (minDist === distTop) {
              b.pos.y = obs.y - b.radius;
              b.vel.y = -Math.abs(b.vel.y) * 0.8;
            } else {
              b.pos.y = obs.y + obs.height + b.radius;
              b.vel.y = Math.abs(b.vel.y) * 0.8;
            }
          }
        }
      });

      // Hit players
      let pickedUp = false;
      this.players.forEach(p => {
        if (!p.isAlive || pickedUp) return;
        
        const dx = b.pos.x - p.pos.x;
        const dy = b.pos.y - p.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radiusSum = p.radius + b.radius;
        
        // Update initial overlap state
        if (p.id === b.ownerId && b.isInitialOverlap && dist > radiusSum + 5) {
          b.isInitialOverlap = false;
        }

        if (dist < radiusSum) {
          // If it's the owner, check if they've separated yet
          if (p.id === b.ownerId) {
            if (!b.isInitialOverlap) {
              // Separated then came back - immediate pickup!
              p.hasBoomerang = true;
              this.boomerangs.splice(i, 1);
              this.createPickupEffect(b.pos.x, b.pos.y, p.color);
              pickedUp = true;
            }
            return; // Skip other logic for owner
          }

          // Always kill if not the owner
          this.killPlayer(p, b.ownerId);
        }
      });
    }

    // Update Particles
    this.particles = this.particles.filter(p => {
      p.update();
      return p.life > 0;
    });

    // Update Light Bursts
    this.lightBursts = this.lightBursts.filter(lb => {
      lb.life -= 0.04;
      lb.radius += (lb.maxRadius - lb.radius) * 0.15;
      return lb.life > 0;
    });

    // Player wall collisions
    this.players.forEach(p => {
      if (p.pos.x < p.radius) p.pos.x = p.radius;
      if (p.pos.x > CANVAS_WIDTH - p.radius) p.pos.x = CANVAS_WIDTH - p.radius;
      if (p.pos.y < p.radius) p.pos.y = p.radius;
      if (p.pos.y > CANVAS_HEIGHT - p.radius) p.pos.y = CANVAS_HEIGHT - p.radius;

      // Player obstacle collisions
      this.obstacles.forEach(obs => {
        const closestX = Math.max(obs.x, Math.min(p.pos.x, obs.x + obs.width));
        const closestY = Math.max(obs.y, Math.min(p.pos.y, obs.y + obs.height));
        const dx = p.pos.x - closestX;
        const dy = p.pos.y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < p.radius * p.radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.001) {
            const overlap = p.radius - dist;
            p.pos.x += (dx / dist) * overlap;
            p.pos.y += (dy / dist) * overlap;
          } else {
            // Perfectly inside - push out to nearest side
            const distLeft = Math.abs(p.pos.x - obs.x);
            const distRight = Math.abs(p.pos.x - (obs.x + obs.width));
            const distTop = Math.abs(p.pos.y - obs.y);
            const distBottom = Math.abs(p.pos.y - (obs.y + obs.height));
            const minDist = Math.min(distLeft, distRight, distTop, distBottom);

            if (minDist === distLeft) p.pos.x = obs.x - p.radius;
            else if (minDist === distRight) p.pos.x = obs.x + obs.width + p.radius;
            else if (minDist === distTop) p.pos.y = obs.y - p.radius;
            else p.pos.y = obs.y + obs.height + p.radius;
          }
        }
      });
    });

    // Broadcast state if host
    if (this.isMultiplayer && this.isHost && this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
  }

  getState(): GameState {
    return {
      p1: { 
        pos: { ...this.players[0].pos }, 
        vel: { ...this.players[0].vel }, 
        facing: { ...this.players[0].facing }, 
        isSlashing: this.players[0].isSlashing, 
        isDashing: this.players[0].isDashing, 
        isAlive: this.players[0].isAlive, 
        kills: this.players[0].kills, 
        hasBoomerang: this.players[0].hasBoomerang 
      },
      p2: { 
        pos: { ...this.players[1].pos }, 
        vel: { ...this.players[1].vel }, 
        facing: { ...this.players[1].facing }, 
        isSlashing: this.players[1].isSlashing, 
        isDashing: this.players[1].isDashing, 
        isAlive: this.players[1].isAlive, 
        kills: this.players[1].kills, 
        hasBoomerang: this.players[1].hasBoomerang 
      },
      boomerangs: this.boomerangs.map(b => ({
        pos: { ...b.pos },
        vel: { ...b.vel },
        ownerId: b.ownerId,
        isReturning: b.isReturning,
        angle: b.angle
      })),
      particles: this.particles.map(p => ({
        pos: { ...p.pos },
        color: p.color,
        life: p.life
      })),
      lightBursts: this.lightBursts.map(lb => ({ ...lb })),
      envColor: this.envColor
    };
  }

  applyState(state: GameState) {
    if (!this.players[0] || !this.players[1]) return;
    
    this.players[0].pos = { ...state.p1.pos };
    this.players[0].vel = { ...state.p1.vel };
    this.players[0].facing = { ...state.p1.facing };
    this.players[0].isSlashing = state.p1.isSlashing;
    this.players[0].isDashing = state.p1.isDashing;
    this.players[0].isAlive = state.p1.isAlive;
    this.players[0].kills = state.p1.kills;
    this.players[0].hasBoomerang = state.p1.hasBoomerang;

    this.players[1].pos = { ...state.p2.pos };
    this.players[1].vel = { ...state.p2.vel };
    this.players[1].facing = { ...state.p2.facing };
    this.players[1].isSlashing = state.p2.isSlashing;
    this.players[1].isDashing = state.p2.isDashing;
    this.players[1].isAlive = state.p2.isAlive;
    this.players[1].kills = state.p2.kills;
    this.players[1].hasBoomerang = state.p2.hasBoomerang;

    // Sync boomerangs
    this.boomerangs = state.boomerangs.map(bData => {
      const b = new Boomerang(bData.ownerId, bData.pos.x, bData.pos.y, 0, 0);
      b.vel = { ...bData.vel };
      b.isReturning = bData.isReturning;
      b.angle = bData.angle;
      return b;
    });

    // Sync particles (simplified)
    this.particles = state.particles.map(pData => {
      const p = new Particle(pData.pos.x, pData.pos.y, pData.color);
      p.life = pData.life;
      return p;
    });

    this.lightBursts = state.lightBursts.map(lb => ({ ...lb }));
    this.envColor = state.envColor;

    if (this.onKillsUpdate) {
      this.onKillsUpdate(this.players[0].kills, this.players[1].kills);
    }
  }

  getAIInput(ai: Player, target: Player) {
    const dx = target.pos.x - ai.pos.x;
    const dy = target.pos.y - ai.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let input = {
      up: false,
      down: false,
      left: false,
      right: false,
      slash: false,
      dash: false,
    };

    if (!target.isAlive) return input;

    // Desired movement direction
    let moveX = 0;
    let moveY = 0;

    if (dist > 220) {
      // Move towards target
      moveX = dx;
      moveY = dy;
    } else if (dist < 120) {
      // Move away from target
      moveX = -dx;
      moveY = -dy;
    } else {
      // Circle target or strafe
      moveX = -dy;
      moveY = dx;
    }

    // Obstacle avoidance
    if (moveX !== 0 || moveY !== 0) {
      const mag = Math.sqrt(moveX * moveX + moveY * moveY);
      const dirX = moveX / mag;
      const dirY = moveY / mag;

      // Look ahead to see if we'll hit an obstacle
      const lookAhead = 50;
      const checkX = ai.pos.x + dirX * lookAhead;
      const checkY = ai.pos.y + dirY * lookAhead;
      
      let blockedObs: Rect | null = null;
      for (const obs of this.obstacles) {
        const buffer = ai.radius + 5;
        if (checkX > obs.x - buffer && checkX < obs.x + obs.width + buffer &&
            checkY > obs.y - buffer && checkY < obs.y + obs.height + buffer) {
          blockedObs = obs;
          break;
        }
      }

      if (blockedObs) {
        // We are blocked. Try to find a way around by moving towards the nearest corner.
        const buffer = ai.radius + 15;
        const corners = [
          { x: blockedObs.x - buffer, y: blockedObs.y - buffer },
          { x: blockedObs.x + blockedObs.width + buffer, y: blockedObs.y - buffer },
          { x: blockedObs.x - buffer, y: blockedObs.y + blockedObs.height + buffer },
          { x: blockedObs.x + blockedObs.width + buffer, y: blockedObs.y + blockedObs.height + buffer },
        ];
        
        let closestCorner = corners[0];
        let minDist = Infinity;
        for (const corner of corners) {
          const d = Math.sqrt(Math.pow(corner.x - ai.pos.x, 2) + Math.pow(corner.y - ai.pos.y, 2));
          if (d < minDist) {
            minDist = d;
            closestCorner = corner;
          }
        }
        
        moveX = closestCorner.x - ai.pos.x;
        moveY = closestCorner.y - ai.pos.y;
      }
    }

    // Convert to discrete inputs
    if (moveY < -10) input.up = true;
    if (moveY > 10) input.down = true;
    if (moveX < -10) input.left = true;
    if (moveX > 10) input.right = true;

    // Slash if close
    if (dist < 60 && ai.hasBoomerang && Math.random() < 0.1) {
      input.slash = true;
    }

    // Dash if target is slashing or if far away and has boomerang
    if ((target.isSlashing && dist < 120) || (dist > 350 && Math.random() < 0.01)) {
      input.dash = true;
    }
    
    return input;
  }

  throwBoomerang(player: Player, vx?: number, vy?: number, power: number = 1) {
    player.hasBoomerang = false;
    this.playSound(1200, 'sine', 0.2, 0.1, true); // Throw sound
    
    let finalVx = vx;
    let finalVy = vy;

    if (finalVx === undefined || finalVy === undefined) {
      // Direction based on velocity or default
      finalVx = player.vel.x;
      finalVy = player.vel.y;
      if (finalVx === 0 && finalVy === 0) {
        // Default throw direction if standing still
        finalVx = player.id === 'Player 1' ? 1 : -1;
        finalVy = 0;
      } else {
        const mag = Math.sqrt(finalVx*finalVx + finalVy*finalVy);
        finalVx /= mag;
        finalVy /= mag;
      }
    }

    const b = new Boomerang(player.id, player.pos.x, player.pos.y, finalVx, finalVy, player.color);
    b.vel.x *= power;
    b.vel.y *= power;
    this.boomerangs.push(b);
  }

  killPlayer(player: Player, killerId?: string) {
    if (!player.isAlive) return;
    player.isAlive = false;
    
    // Screen Shake
    this.screenShake = 15;
    this.playSound(100, 'square', 0.4, 0.2, true); // Death sound
    
    // Increment killer's kill count
    if (killerId) {
      const killer = this.players.find(p => p.id === killerId);
      if (killer) {
        killer.kills++;
        if (this.onKillsUpdate) {
          this.onKillsUpdate(this.players[0].kills, this.players[1].kills);
        }

        // Check for win condition
        if (killer.kills >= 10) {
          this.isRunning = false;
          this.screenShake = 0;
          if (this.onGameOver) {
            this.onGameOver(killer.id);
          }
          return;
        }
      }
    }

    // Create explosion
    this.lightBursts.push({
      x: player.pos.x,
      y: player.pos.y,
      radius: 0,
      maxRadius: 150,
      life: 1.0,
      color: '#FF00FF'
    });

    // Respawn after 1 second
    setTimeout(() => {
      const respawnX = player.id === 'Player 1' ? 150 : CANVAS_WIDTH - 150;
      const respawnY = CANVAS_HEIGHT / 2;
      player.respawn(respawnX, respawnY);
    }, 1000);
  }

  createPickupEffect(x: number, y: number, color: string) {
    this.playSound(1500, 'sine', 0.1, 0.05); // Pickup sound
    // Small pop effect
    for (let i = 0; i < 8; i++) {
      const p = new Particle(x, y, color);
      p.vel.x *= 0.5;
      p.vel.y *= 0.5;
      p.life = 0.5; // Short life
      this.particles.push(p);
    }
  }

  createElectricBurst(x: number, y: number) {
    this.lightBursts.push({
      x,
      y,
      radius: 0,
      maxRadius: 80,
      life: 1.0,
      color: '#FF00FF'
    });
  }

  checkGameOver() {
    // Game over logic removed for continuous practice mode
  }

  draw() {
    this.ctx.save();
    
    // Screen Shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(sx, sy);
    }

    this.ctx.fillStyle = COLORS.BACKGROUND;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid lines for style (Neon Grid)
    const time = performance.now() / 1000;
    const gridOffset = (time * 20) % 40;
    
    this.ctx.strokeStyle = this.envColor + '44'; // Stronger grid
    this.ctx.lineWidth = 1.5;
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = this.envColor;
    this.ctx.beginPath();
    for (let x = gridOffset; x < CANVAS_WIDTH; x += 40) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for (let y = gridOffset; y < CANVAS_HEIGHT; y += 40) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(CANVAS_WIDTH, y);
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Horizontal perspective lines (animated)
    this.ctx.strokeStyle = this.envColor + '22';
    const pOffset = (time * 40) % 80;
    for (let y = pOffset; y < CANVAS_HEIGHT; y += 80) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(CANVAS_WIDTH, y);
      this.ctx.stroke();
    }

    this.particles.forEach(p => p.draw(this.ctx));
    this.boomerangs.forEach(b => b.draw(this.ctx));
    this.players.forEach(p => p.draw(this.ctx));

    // Draw Light Bursts
    this.lightBursts.forEach(lb => {
      this.ctx.save();
      const pulse = Math.sin(time * 20) * 0.2 + 0.8;
      this.ctx.globalAlpha = lb.life * pulse;
      this.ctx.beginPath();
      this.ctx.arc(lb.x, lb.y, lb.radius, 0, Math.PI * 2);
      
      const grad = this.ctx.createRadialGradient(lb.x, lb.y, 0, lb.x, lb.y, lb.radius);
      grad.addColorStop(0, '#FFF');
      grad.addColorStop(0.3, lb.color);
      grad.addColorStop(1, 'transparent');
      
      this.ctx.fillStyle = grad;
      this.ctx.shadowBlur = 40 * lb.life;
      this.ctx.shadowColor = lb.color;
      this.ctx.fill();
      this.ctx.restore();
    });

    // Draw obstacles (Neon Walls with Pulse)
    const pulse = Math.sin(time * 8) * 5 + 10;
    
    // Draw Map Boundaries with Glow
    this.ctx.save();
    this.ctx.shadowBlur = pulse;
    this.ctx.shadowColor = this.envColor;
    this.ctx.strokeStyle = this.envColor;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(2, 2, CANVAS_WIDTH - 4, CANVAS_HEIGHT - 4);
    this.ctx.restore();

    this.obstacles.forEach(obs => {
      // Outer Glow
      this.ctx.shadowBlur = pulse;
      this.ctx.shadowColor = this.envColor;
      this.ctx.fillStyle = COLORS.WALL;
      this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = this.envColor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      
      // Inner detail
      this.ctx.strokeStyle = this.envColor + '44';
      this.ctx.strokeRect(obs.x + 5, obs.y + 5, obs.width - 10, obs.height - 10);
    });

    // Draw aiming arrow (Neon)
    if (this.isAiming) {
      const lp = this.getLocalPlayer();
      if (lp) {
        const dx = this.mousePos.x - lp.pos.x;
        const dy = this.mousePos.y - lp.pos.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        
        if (mag > 5) {
          const angle = Math.atan2(dy, dx);
          const length = 112.5; // 50% longer than 75
          
          this.ctx.save();
          this.ctx.translate(lp.pos.x, lp.pos.y);
          this.ctx.rotate(angle);
          
          // Arrow line
          this.ctx.beginPath();
          this.ctx.moveTo(0, 0);
          this.ctx.lineTo(length, 0);
          this.ctx.strokeStyle = lp.color;
          this.ctx.lineWidth = 3;
          this.ctx.setLineDash([5, 5]);
          this.ctx.shadowBlur = 15;
          this.ctx.shadowColor = lp.color;
          this.ctx.stroke();
          
          // Arrow head
          this.ctx.beginPath();
          this.ctx.moveTo(length, 0);
          this.ctx.lineTo(length - 10, -10);
          this.ctx.lineTo(length - 10, 10);
          this.ctx.closePath();
          this.ctx.fillStyle = lp.color;
          this.ctx.fill();
          
          this.ctx.restore();
        }
      }
    }

    this.ctx.restore();

    // Scanlines Effect (Drawn last, outside of shake)
    this.ctx.save();
    this.ctx.globalAlpha = 0.05;
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    for (let i = 0; i < CANVAS_HEIGHT; i += 8) {
      this.ctx.rect(0, i, CANVAS_WIDTH, 4);
    }
    this.ctx.fill();
    this.ctx.restore();
    const gradient = this.ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH / 1.2
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.restore();
  }
}
