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
  public onConnected: () => void = () => {};
  public onData: (data: any) => void = () => {};
  public onDisconnected: () => void = () => {};

  constructor() {}

  init(id?: string, onOpen?: (id: string) => void) {
    this.peer = id ? new Peer(id) : new Peer();

    this.peer.on('open', (id) => {
      this.peerId = id;
      console.log('My peer ID is: ' + id);
      if (onOpen) onOpen(id);
    });

    this.peer.on('connection', (conn) => {
      if (this.conn) {
        conn.close();
        return;
      }
      this.isHost = true;
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
    });
  }

  connect(targetId: string) {
    if (!this.peer) return;
    this.isHost = false;
    const conn = this.peer.connect(targetId);
    this.setupConnection(conn);
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
