import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { authAPI } from './api';
import { storageService } from './storage';

export interface WebRTCConnection {
  peerId: string;
  peerConnection: RTCPeerConnection;
  dataChannel?: any; // RTCDataChannel type not exported by react-native-webrtc
  state: 'connecting' | 'connected' | 'failed' | 'closed';
  connectedAt: number;
  isInitiator: boolean;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'relay-request';
  fromPeerId: string;
  toPeerId: string;
  data: any;
  timestamp: number;
}

export interface WebRTCConfig {
  iceServers: any[]; // RTCConfiguration not exported by react-native-webrtc
  signalingServerUrl: string;
  networkId: string;
  userId: string;
  deviceId: string;
}

class WebRTCService {
  private connections = new Map<string, WebRTCConnection>();
  private signalingSocket: WebSocket | null = null;
  private config: WebRTCConfig | null = null;
  private messageHandler: ((message: any, fromPeerId: string) => void) | null = null;
  private connectionStateHandler: ((peerId: string, state: string) => void) | null = null;

  // Default ICE servers
  private readonly DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  async initialize(config: WebRTCConfig): Promise<void> {
    this.config = {
      ...config,
      iceServers: config.iceServers || this.DEFAULT_ICE_SERVERS,
    };

    try {
      // Initialize signaling WebSocket connection
      await this.connectToSignalingServer();
      console.log('WebRTC service initialized with signaling server');
    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      console.log('WebRTC service will continue without signaling server (P2P discovery limited)');
      // Don't throw - allow the service to work without signaling server
    }
  }

  setMessageHandler(handler: (message: any, fromPeerId: string) => void): void {
    this.messageHandler = handler;
  }

  setConnectionStateHandler(handler: (peerId: string, state: string) => void): void {
    this.connectionStateHandler = handler;
  }

  private async connectToSignalingServer(): Promise<void> {
    if (!this.config) throw new Error('WebRTC not initialized');

    // Your signaling server uses /signaling path
    const baseWsUrl = this.config.signalingServerUrl.replace('http', 'ws');
    const pathsToTry = [
      '/signaling',  // Your server's actual path - try this first!
      '/ws',
      '/websocket', 
      '/',
    ];

    return this.tryWebSocketPaths(baseWsUrl, pathsToTry);
  }

  private async tryWebSocketPaths(baseUrl: string, paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const wsUrl = `${baseUrl}${path}`;
        console.log(`Trying WebSocket connection to: ${wsUrl}`);
        await this.attemptWebSocketConnection(wsUrl);
        console.log(`✅ Connected to WebSocket at: ${wsUrl}`);
        return; // Success!
      } catch (error) {
        console.log(`❌ Failed to connect to: ${baseUrl}${path}`);
        continue; // Try next path
      }
    }
    throw new Error(`Failed to connect to any WebSocket path on ${baseUrl}`);
  }

  private async attemptWebSocketConnection(wsUrl: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get authentication token
        const { storageService } = await import('./storage');
        const token = await storageService.getAuthToken();
        
        if (!token) {
          reject(new Error('No authentication token available'));
          return;
        }

        // Create WebSocket with authentication token in URL
        const wsUrlWithAuth = `${wsUrl}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrlWithAuth);
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000); // 5 second timeout

        ws.onopen = () => {
          clearTimeout(timeout);
          this.signalingSocket = ws;
          
          // Send authentication message as first message
          const authMessage = {
            type: 'auth',
            token: token,
            deviceId: this.config?.deviceId
          };
          ws.send(JSON.stringify(authMessage));
          
          this.setupWebSocketHandlers();
          console.log('✅ Authenticated WebSocket connection established');
          resolve();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.signalingSocket) return;

    this.signalingSocket.onmessage = (event) => {
      this.handleSignalingMessage(event.data);
    };

    this.signalingSocket.onclose = () => {
      console.log('Signaling server connection closed');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (this.config) {
          this.connectToSignalingServer().catch(console.error);
        }
      }, 5000);
    };

    this.signalingSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Check for pending messages on connection
    this.checkPendingSignalingMessages();
  }

  private handleSignalingMessage(data: string): void {
    try {
      const message: SignalingMessage = JSON.parse(data);
      console.log('Received signaling message:', message.type, 'from:', message.fromPeerId);

      switch (message.type) {
        case 'offer':
          this.handleOffer(message);
          break;
        case 'answer':
          this.handleAnswer(message);
          break;
        case 'ice-candidate':
          this.handleIceCandidate(message);
          break;
        default:
          console.warn('Unknown signaling message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse signaling message:', error);
    }
  }

  async createConnection(targetPeerId: string): Promise<WebRTCConnection | null> {
    if (!this.config) throw new Error('WebRTC not initialized');

    // Check if connection already exists
    const existingConnection = this.connections.get(targetPeerId);
    if (existingConnection && existingConnection.state === 'connected') {
      return existingConnection;
    }

    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
      });

      // Create data channel for initiator
      const dataChannel = peerConnection.createDataChannel('messages', {
        ordered: true,
      });

      const connection: WebRTCConnection = {
        peerId: targetPeerId,
        peerConnection,
        dataChannel,
        state: 'connecting',
        connectedAt: Date.now(),
        isInitiator: true,
      };

      this.setupConnectionHandlers(connection);
      this.connections.set(targetPeerId, connection);

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await this.sendSignalingMessage({
        type: 'offer',
        fromPeerId: this.config.deviceId,
        toPeerId: targetPeerId,
        data: offer,
        timestamp: Date.now(),
      });

      console.log('Created WebRTC connection and sent offer to:', targetPeerId);
      return connection;
    } catch (error) {
      console.error('Failed to create WebRTC connection:', error);
      return null;
    }
  }

  private async handleOffer(message: SignalingMessage): Promise<void> {
    if (!this.config) return;

    try {
      console.log('Handling offer from:', message.fromPeerId);

      const peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
      });

      const connection: WebRTCConnection = {
        peerId: message.fromPeerId,
        peerConnection,
        state: 'connecting',
        connectedAt: Date.now(),
        isInitiator: false,
      };

      // Set up data channel handler for receiver
      (peerConnection as any).ondatachannel = (event: any) => {
        const dataChannel = event.channel;
        connection.dataChannel = dataChannel;
        this.setupDataChannelHandlers(connection, dataChannel);
        console.log('Received data channel from:', message.fromPeerId);
      };

      this.setupConnectionHandlers(connection);
      this.connections.set(message.fromPeerId, connection);

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await this.sendSignalingMessage({
        type: 'answer',
        fromPeerId: this.config.deviceId,
        toPeerId: message.fromPeerId,
        data: answer,
        timestamp: Date.now(),
      });

      console.log('Sent answer to:', message.fromPeerId);
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  private async handleAnswer(message: SignalingMessage): Promise<void> {
    try {
      console.log('Handling answer from:', message.fromPeerId);

      const connection = this.connections.get(message.fromPeerId);
      if (!connection) {
        console.warn('No connection found for answer from:', message.fromPeerId);
        return;
      }

      await connection.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
      console.log('Set remote description for:', message.fromPeerId);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    try {
      const connection = this.connections.get(message.fromPeerId);
      if (!connection) {
        console.warn('No connection found for ICE candidate from:', message.fromPeerId);
        return;
      }

      const candidate = new RTCIceCandidate(message.data);
      await connection.peerConnection.addIceCandidate(candidate);
      console.log('Added ICE candidate from:', message.fromPeerId);
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }

  private setupConnectionHandlers(connection: WebRTCConnection): void {
    const { peerConnection, peerId } = connection;

    (peerConnection as any).onicecandidate = (event: any) => {
      if (event.candidate && this.config) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          fromPeerId: this.config.deviceId,
          toPeerId: peerId,
          data: event.candidate,
          timestamp: Date.now(),
        }).catch(console.error);
      }
    };

    (peerConnection as any).oniceconnectionstatechange = () => {
      const state = (peerConnection as any).iceConnectionState;
      console.log('ICE connection state changed:', state, 'for peer:', peerId);

      if (state === 'connected' || state === 'completed') {
        connection.state = 'connected';
        console.log('✅ NAT traversal successful for peer:', peerId);
        this.connectionStateHandler?.(peerId, 'connected');
      } else if (state === 'failed') {
        console.warn('❌ NAT traversal failed for peer:', peerId, '- may need TURN server');
        connection.state = 'failed';
        this.connectionStateHandler?.(peerId, 'disconnected');
        this.connections.delete(peerId);
        
        // TODO: Implement TURN server fallback or relay mechanism
        this.handleNATTraversalFailure(peerId);
      } else if (state === 'disconnected') {
        connection.state = 'failed';
        this.connectionStateHandler?.(peerId, 'disconnected');
        this.connections.delete(peerId);
      }
    };

    (peerConnection as any).onconnectionstatechange = () => {
      console.log('Connection state changed:', (peerConnection as any).connectionState, 'for peer:', peerId);
    };

    // Set up data channel handlers for initiator
    if (connection.dataChannel) {
      this.setupDataChannelHandlers(connection, connection.dataChannel);
    }
  }

  private setupDataChannelHandlers(connection: WebRTCConnection, dataChannel: any): void {
    dataChannel.onopen = () => {
      console.log('Data channel opened for peer:', connection.peerId);
      connection.state = 'connected';
      this.connectionStateHandler?.(connection.peerId, 'connected');
    };

    dataChannel.onmessage = (event: any) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received P2P message from:', connection.peerId, 'type:', message.type);
        this.messageHandler?.(message, connection.peerId);
      } catch (error) {
        console.error('Failed to parse P2P message:', error);
      }
    };

    dataChannel.onerror = (error: any) => {
      console.error('Data channel error for peer:', connection.peerId, error);
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed for peer:', connection.peerId);
      connection.state = 'closed';
      this.connectionStateHandler?.(connection.peerId, 'disconnected');
    };
  }

  async sendMessage(peerId: string, message: any): Promise<boolean> {
    const connection = this.connections.get(peerId);
    if (!connection || !connection.dataChannel || connection.dataChannel.readyState !== 'open') {
      console.warn('Cannot send message to peer:', peerId, 'connection not ready');
      return false;
    }

    try {
      const messageString = JSON.stringify(message);
      connection.dataChannel.send(messageString);
      console.log('Sent P2P message to:', peerId, 'type:', message.type);
      return true;
    } catch (error) {
      console.error('Failed to send message to peer:', peerId, error);
      return false;
    }
  }

  broadcastMessage(message: any): void {
    const activeConnections = this.getActiveConnections();
    console.log(`Broadcasting message to ${activeConnections.length} peers`);

    activeConnections.forEach(connection => {
      this.sendMessage(connection.peerId, message).catch(error => {
        console.warn('Failed to broadcast to peer:', connection.peerId, error);
      });
    });
  }

  getActiveConnections(): WebRTCConnection[] {
    return Array.from(this.connections.values()).filter(
      connection => connection.state === 'connected' && 
                   connection.dataChannel?.readyState === 'open'
    );
  }

  getConnection(peerId: string): WebRTCConnection | undefined {
    return this.connections.get(peerId);
  }

  closeConnection(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.peerConnection.close();
      this.connections.delete(peerId);
      console.log('Closed connection to peer:', peerId);
    }
  }

  private async sendSignalingMessage(message: SignalingMessage): Promise<void> {
    if (!this.signalingSocket || this.signalingSocket.readyState !== WebSocket.OPEN) {
      throw new Error('Signaling server not connected');
    }

    this.signalingSocket.send(JSON.stringify(message));
  }

  private async checkPendingSignalingMessages(): Promise<void> {
    if (!this.config) return;

    try {
      const token = await storageService.getAuthToken();
      if (!token) return;

      const response = await authAPI.getPendingSignalingMessages(this.config.deviceId, token);
      
      for (const message of response.messages) {
        console.log('Processing pending signaling message:', message.type, 'from:', message.fromPeerId);
        this.handleSignalingMessage(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Failed to check pending signaling messages:', error);
    }
  }

  async destroy(): Promise<void> {
    // Close signaling connection
    if (this.signalingSocket) {
      this.signalingSocket.close();
      this.signalingSocket = null;
    }

    // Close all peer connections
    for (const connection of this.connections.values()) {
      connection.peerConnection.close();
    }
    this.connections.clear();

    console.log('WebRTC service destroyed');
  }

  // Handle NAT traversal failure - implement fallback strategies
  private handleNATTraversalFailure(peerId: string): void {
    console.log('🔄 Attempting NAT traversal fallback for peer:', peerId);
    
    // Strategy 1: Mark peer as requiring relay connection
    // This will be handled by the PeerManager's relay mechanism
    
    // Strategy 2: Could implement TURN server retry with different credentials
    // Strategy 3: Could implement UDP hole punching assistance
    // Strategy 4: Could fall back to server-relayed messaging
    
    // For now, just log the failure for monitoring
    console.warn('NAT traversal failed - peer may need TURN server or relay:', peerId);
  }

  // Get network statistics with NAT traversal info
  getNetworkStats(): {
    totalConnections: number;
    activeConnections: number;
    signalingConnected: boolean;
    natTraversalStats?: {
      successfulConnections: number;
      failedConnections: number;
    };
  } {
    const activeConnections = this.getActiveConnections();
    
    return {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      signalingConnected: this.signalingSocket?.readyState === WebSocket.OPEN,
      natTraversalStats: {
        successfulConnections: activeConnections.length,
        failedConnections: this.connections.size - activeConnections.length,
      }
    };
  }
}

export const webrtcService = new WebRTCService();