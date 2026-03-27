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
  public onIceStateChange: (state: string) => void = () => {};

  constructor() {}

  init() {
    if (this.peer) return;

    console.log('[Multiplayer] Initializing PeerJS with cloud defaults...');

    // Let PeerJS handle the host/port/path defaults for its cloud service
    this.peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceTransportPolicy: 'all'
      }
    });
    
    this.peer.on('open', (id) => {
      this.peerId = id;
      console.log('[Multiplayer] Peer ID assigned:', id);
      this.onIdReady(id);
    });

    this.peer.on('connection', (conn) => {
      console.log('[Multiplayer] Incoming connection request from:', conn.peer);
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
        message = 'Opponent not found. Make sure the Host ID is correct.';
      } else if (err.type === 'network') {
        message = 'Network error. Please check your connection.';
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
      // Use reliable mode and JSON serialization for better compatibility
      const conn = this.peer!.connect(targetId, {
        reliable: true,
        serialization: 'json'
      });
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
    console.log('[Multiplayer] Setting up data channel with:', conn.peer);
    
    // Monitor ICE state early
    const pc = (conn as any).peerConnection as RTCPeerConnection;
    if (pc) {
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('[Multiplayer] ICE State changed to:', state, 'for:', conn.peer);
        this.onIceStateChange(state);
      };
    }
    
    conn.on('open', () => {
      console.log('[Multiplayer] DATA CHANNEL OPENED with:', conn.peer);
      
      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (this.conn && this.conn.open) {
          this.conn.send({ type: 'HEARTBEAT' });
        } else {
          clearInterval(heartbeat);
        }
      }, 2000);

      this.onConnected();
    });

    conn.on('data', (data: any) => {
      if (data && data.type === 'HEARTBEAT') return;
      this.onData(data);
    });

    conn.on('close', () => {
      console.log('[Multiplayer] Connection closed by peer');
      this.onDisconnected();
    });

    conn.on('error', (err) => {
      console.error('[Multiplayer] Data channel error:', err);
      this.onError('Data channel failed to open.');
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
