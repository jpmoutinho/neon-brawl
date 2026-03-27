import { Peer, DataConnection } from 'peerjs';

export type GameState = {
  p1: { pos: { x: number, y: number }, vel: { x: number, y: number }, facing: { x: number, y: number }, isSlashing: boolean, isDashing: boolean, isAlive: boolean, kills: number, hasBoomerang: boolean };
  p2: { pos: { x: number, y: number }, vel: { x: number, y: number }, facing: { x: number, y: number }, isSlashing: boolean, isDashing: boolean, isAlive: boolean, kills: number, hasBoomerang: boolean };
  boomerangs: { pos: { x: number, y: number }, vel: { x: number, y: number }, ownerId: string, isReturning: boolean, angle: number }[];
  particles: { pos: { x: number, y: number }, color: string, life: number }[];
  lightBursts: { x: number, y: number, radius: number, maxRadius: number, life: number, color: string }[];
  envColor: string;
};

export type PlayerInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  slash: boolean;
  dash: boolean;
  mousePos: { x: number, y: number };
  isThrowing: boolean;
  throwDir?: { x: number, y: number };
};

export class MultiplayerManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  public peerId: string = '';
  public isHost: boolean = false;
  
  // Callbacks
  public onIdReady: (id: string) => void = () => {};
  public onConnected: () => void = () => {};
  public onData: (data: any) => void = () => {};
  public onDisconnected: () => void = () => {};
  public onError: (error: string) => void = () => {};

  constructor() {}

  init() {
    if (this.peer) return;

    console.log('[Multiplayer] Initializing PeerJS...');

    // Production Config for GitHub Pages & Secure Environments
    this.peer = new Peer({
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/',
      config: { 
        'iceServers': [
          { 'urls': 'stun:stun.l.google.com:19302' },
          { 'urls': 'stun:stun1.l.google.com:19302' },
          { 'urls': 'stun:stun2.l.google.com:19302' },
          { 'urls': 'stun:stun3.l.google.com:19302' },
          { 'urls': 'stun:stun4.l.google.com:19302' }
        ] 
      },
      debug: 3 // Full logging for debugging
    });
    
    this.peer.on('open', (id) => {
      this.peerId = id;
      console.log('[Multiplayer] Peer ID assigned:', id);
      this.onIdReady(id);
    });

    this.peer.on('connection', (conn) => {
      console.log('[Multiplayer] Incoming connection from:', conn.peer);
      if (this.conn) {
        console.log('[Multiplayer] Rejecting: already connected.');
        conn.on('open', () => {
          conn.send({ type: 'ERROR', message: 'Room full' });
          setTimeout(() => conn.close(), 500);
        });
        return;
      }
      this.isHost = true;
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[Multiplayer] PeerJS error:', err.type, err);
      let message = 'Connection error occurred.';
      
      if (err.type === 'peer-unavailable') {
        message = 'Opponent not found. Make sure the Host ID is correct and they are still online.';
      } else if (err.type === 'network') {
        message = 'Network error. Please check your internet connection.';
      } else if (err.type === 'server-error') {
        message = 'Could not reach the signaling server. Try again in a moment.';
      }
      
      this.onError(message);
    });
  }

  connect(targetId: string) {
    console.log('[Multiplayer] Attempting to connect to:', targetId);
    
    if (!this.peer) {
      this.init();
    }
    
    const attemptConnection = () => {
      this.isHost = false;
      // Use standard connection options
      const conn = this.peer!.connect(targetId);
      this.setupConnection(conn);
    };

    if (this.peerId) {
      attemptConnection();
    } else {
      console.log('[Multiplayer] Waiting for Peer ID before connecting...');
      this.peer!.once('open', () => attemptConnection());
    }
  }

  private setupConnection(conn: DataConnection) {
    this.conn = conn;
    
    conn.on('open', () => {
      console.log('Connected to: ' + conn.peer);
      this.onConnected();
    });

    conn.on('data', (data) => {
      this.onData(data);
    });

    conn.on('close', () => {
      console.log('Connection closed');
      this.conn = null;
      this.onDisconnected();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }

  send(data: any) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  disconnect() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
