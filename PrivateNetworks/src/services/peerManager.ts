import { storageService } from './storage';
import { authAPI } from './api';
import { peerStorage, PeerRoute, OfflineMessage, ActiveConnection } from './peerStorage';
import { webrtcService, WebRTCConnection, WebRTCConfig } from './webrtc';

// Simple EventEmitter implementation for React Native
class SimpleEventEmitter {
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

export interface PeerInfo {
  userId: string;
  peerId: string;
  signalAddress: string;
  lastSeen: number;
  isCoordinator: boolean;
  connectionState: 'disconnected' | 'discovering' | 'signaling' | 'connecting' | 'connected' | 'failed';
  connectionPath?: string; // e.g., "via Bob"
  canRelay: boolean;
}

export interface PeerStatus {
  status: 'direct' | 'relay' | 'offline';
  connectionPath?: string;
  lastSeen: number;
}

export interface PeerConnection {
  peerId: string;
  connection: WebRTCConnection;
  state: 'connecting' | 'connected' | 'failed' | 'closed';
  connectedAt: number;
  isRelay: boolean;
}

export interface NetworkState {
  onlineMembers: string[];
  coordinators: string[];
  timestamp: number;
}

export interface PeerQuery {
  lookingForUserId: string;
  requestId: string;
  fromPeerId: string;
}

export interface PeerFound {
  userId: string;
  signalAddress: string;
  lastSeen: number;
  canRelay: boolean;
}

export interface StoreMessage {
  forUserId: string;
  encryptedMessage: Uint8Array;
  expiresAt: number;
}

export interface PresenceAnnouncement {
  type: 'PRESENCE_ANNOUNCEMENT';
  userId: string;
  peerId: string;
  signalAddress: string;
  capabilities: string[];
  networkId: string;
  timestamp: number;
  isCoordinator: boolean;
}

class PeerManager extends SimpleEventEmitter {
  private connections = new Map<string, PeerConnection>();
  private peerCache = new Map<string, PeerInfo>();
  private networkMembers = new Map<string, PeerStatus>();
  private messageQueue = new Map<string, any[]>();
  private discoveryRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  
  // Connection pool limits
  private readonly MAX_ACTIVE_CONNECTIONS = 5;
  private readonly MAX_STANDBY_CONNECTIONS = 10;
  private readonly MAX_CACHED_PEERS = 50;
  
  // Timing constants
  private readonly DISCOVERY_TIMEOUT = 5000;
  private readonly CONNECTION_TIMEOUT = 10000;
  private readonly HEARTBEAT_INTERVAL = 30000;
  private readonly COORDINATOR_HEARTBEAT = 5 * 60 * 1000;
  private readonly P2P_PRESENCE_INTERVAL = 10 * 1000; // 10 seconds
  private readonly REGISTRY_PRESENCE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  private currentNetworkId: string | null = null;
  private currentUserId: string | null = null;
  private isCoordinator = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private coordinatorTimer: NodeJS.Timeout | null = null;
  private p2pPresenceTimer: NodeJS.Timeout | null = null;
  private registryPresenceTimer: NodeJS.Timeout | null = null;
  
  // ICE servers caching
  private cachedICEServers: any[] | null = null;
  private iceServersCacheExpiry: number = 0;

  constructor() {
    super();
    this.initializeStorage();
    this.startHeartbeat();
    this.setupWebRTCHandlers();
    this.setupAppStateHandler();
  }

  // Handle app state changes (just for logging, P2P continues in background)
  private setupAppStateHandler(): void {
    try {
      const { AppState } = require('react-native');
      AppState.addEventListener('change', (nextAppState: string) => {
        if (nextAppState === 'background') {
          console.log('📱 App going to background - P2P continues running');
          // P2P activities continue in background - no pausing
        } else if (nextAppState === 'active') {
          console.log('📱 App becoming active - P2P already running');
          // P2P was already running - no need to resume
        }
      });
    } catch (error) {
      console.error('Failed to setup app state handler:', error);
    }
  }

  private async initializeStorage(): Promise<void> {
    try {
      await peerStorage.initialize();
      console.log('SQLite PeerStorage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite PeerStorage, falling back to AsyncStorage:', error);
      // Import and use fallback storage
      const { peerStorageFallback } = await import('./peerStorageFallback');
      // Replace the peerStorage reference dynamically
      Object.setPrototypeOf(peerStorage, peerStorageFallback);
      Object.assign(peerStorage, peerStorageFallback);
      await peerStorageFallback.initialize();
      console.log('Fallback AsyncStorage initialized');
    }
  }

  // Initialize peer manager for a network
  async initialize(networkId: string, userId: string, token: string): Promise<void> {
    this.currentNetworkId = networkId;
    this.currentUserId = userId;
    
    try {
      // Initialize WebRTC service
      await this.initializeWebRTC(networkId, userId);
      
      // Load cached peer data
      await this.loadCachedPeers();
      
      // Initial registry announcement
      await this.announcePresenceToRegistry(token);
      
      // Start background tasks
      this.startCoordinatorHeartbeat();
      this.startP2PPresenceAnnouncements();
      this.startRegistryPresenceAnnouncements(token);
      
      console.log('PeerManager initialized for network:', networkId);
    } catch (error) {
      console.error('Failed to initialize PeerManager:', error);
      console.warn('P2P connections may be limited. Continuing with basic functionality.');
      // Don't throw - allow app to continue with limited P2P functionality
    }
  }

  // Get all network members with their status
  getNetworkMembers(): Map<string, PeerStatus> {
    return new Map(this.networkMembers);
  }

  // Get active connections
  getActiveConnections(): PeerConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.state === 'connected');
  }

  // Get active WebRTC connections count
  getActiveConnectionsCount(): number {
    return webrtcService.getActiveConnections().length;
  }

  // Initialize WebRTC service
  private async initializeWebRTC(networkId: string, userId: string): Promise<void> {
    const deviceId = this.getCurrentPeerId();
    
    // Get authentication token for ICE servers
    const token = await storageService.getAuthToken();
    
    const webrtcConfig: WebRTCConfig = {
      iceServers: await this.getICEServersFromRegistry(token) || [
        // Fallback STUN servers if registry is unreachable
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      signalingServerUrl: 'http://192.168.1.109:3005', // WebRTC signaling server port
      networkId,
      userId,
      deviceId,
    };

    await webrtcService.initialize(webrtcConfig);
    console.log('WebRTC service initialized for network:', networkId);
    
    // Load initial peers from registry
    await this.loadRegistryPeers();
  }

  // Set up WebRTC event handlers
  private setupWebRTCHandlers(): void {
    webrtcService.setMessageHandler((message, fromPeerId) => {
      this.handleP2PMessage(message, fromPeerId);
    });

    webrtcService.setConnectionStateHandler((peerId, state) => {
      this.handleConnectionStateChange(peerId, state);
    });
  }

  // Handle WebRTC connection state changes
  private handleConnectionStateChange(peerId: string, state: string): void {
    const connection = this.connections.get(peerId);
    if (!connection) return;

    if (state === 'connected') {
      connection.state = 'connected';
      this.emit('peerConnected', this.getPeerUserIdFromPeerId(peerId));
    } else if (state === 'disconnected') {
      connection.state = 'failed';
      this.connections.delete(peerId);
      this.emit('peerDisconnected', this.getPeerUserIdFromPeerId(peerId));
    }
  }

  // Get userId from peerId (helper method)
  private getPeerUserIdFromPeerId(peerId: string): string {
    const peerInfo = Array.from(this.peerCache.values()).find(peer => peer.peerId === peerId);
    return peerInfo?.userId || peerId;
  }

  // Discover and connect to a peer
  async connectToPeer(userId: string): Promise<PeerConnection | null> {
    console.log('Attempting to connect to peer:', userId);
    
    // 1. Check existing connections (0ms)
    const existingConnection = this.findExistingConnection(userId);
    if (existingConnection) {
      console.log('Found existing connection to', userId);
      return existingConnection;
    }

    // 2. Query connected peers via P2P (50-200ms)
    let peerInfo = await this.queryConnectedPeers(userId);
    
    // 3. Check local SQLite cache (5ms)
    if (!peerInfo) {
      peerInfo = await this.queryCachedPeer(userId);
    }
    
    // 4. Try last known coordinators (100-500ms)
    if (!peerInfo) {
      peerInfo = await this.queryCoordinators(userId);
    }
    
    // 5. Call Registry API (200-1000ms) - LAST RESORT
    if (!peerInfo) {
      peerInfo = await this.queryRegistry(userId);
    }
    
    // 6. Fall back to store & forward
    if (!peerInfo) {
      console.log('Peer not found, using store & forward for:', userId);
      this.updatePeerStatus(userId, { status: 'offline', lastSeen: Date.now() });
      return null;
    }

    // Attempt WebRTC connection
    return await this.establishConnection(peerInfo);
  }

  // Send message to peer
  async sendMessage(userId: string, message: any): Promise<boolean> {
    const connection = await this.connectToPeer(userId);
    
    if (connection && connection.state === 'connected') {
      // Direct send via WebRTC
      const success = await webrtcService.sendMessage(connection.peerId, message);
      if (success) {
        return true;
      }
    }
    
    // Try relay via other connected peers
    const relayConnection = this.findRelayForPeer(userId);
    if (relayConnection) {
      const relayMessage = {
        type: 'RELAY',
        to: userId,
        message: message
      };
      const success = await webrtcService.sendMessage(relayConnection.peerId, relayMessage);
      if (success) {
        return true;
      }
    }
    
    // Store & forward as last resort
    this.queueMessage(userId, message);
    await this.storeMessageWithCoordinator(userId, message);
    await this.storeOfflineMessageLocally(userId, message);
    return false;
  }

  // Broadcast network state
  broadcastNetworkState(): void {
    const networkState: NetworkState = {
      onlineMembers: Array.from(this.networkMembers.keys()).filter(
        userId => this.networkMembers.get(userId)?.status !== 'offline'
      ),
      coordinators: Array.from(this.peerCache.values())
        .filter(peer => peer.isCoordinator)
        .map(peer => peer.userId),
      timestamp: Date.now()
    };

    webrtcService.broadcastMessage({
      type: 'NETWORK_STATE',
      ...networkState
    });
  }

  // Broadcast presence information to all connected peers (Enhanced P2P Gossip)
  private broadcastPresenceToP2P(): void {
    if (!this.currentUserId || !this.currentNetworkId) return;

    // Enhanced gossip includes network topology information
    const knownPeers = Array.from(this.peerCache.values())
      .filter(peer => peer.userId !== this.currentUserId)
      .map(peer => ({
        userId: peer.userId,
        peerId: peer.peerId,
        signalAddress: peer.signalAddress,
        lastSeen: peer.lastSeen,
        isCoordinator: peer.isCoordinator,
        canRelay: peer.canRelay
      }));

    const presenceInfo = {
      type: 'PRESENCE_ANNOUNCEMENT',
      userId: this.currentUserId,
      peerId: this.getCurrentPeerId(),
      signalAddress: 'http://192.168.1.109:3005', // Registry server address
      capabilities: ['relay', 'store'],
      networkId: this.currentNetworkId,
      timestamp: Date.now(),
      isCoordinator: this.isCoordinator,
      // Enhanced gossip data
      knownPeers: knownPeers.slice(0, 10), // Share up to 10 known peers
      activeConnections: webrtcService.getActiveConnections().length,
      networkMembers: Array.from(this.networkMembers.entries()).map(([userId, status]) => ({
        userId,
        status: status.status,
        lastSeen: status.lastSeen
      }))
    };

    const activeConnections = webrtcService.getActiveConnections();
    console.log(`Broadcasting enhanced presence to ${activeConnections.length} connected peers`);

    webrtcService.broadcastMessage(presenceInfo);
  }

  // Handle incoming P2P messages
  private handleP2PMessage(message: any, fromPeerId: string): void {
    switch (message.type) {
      case 'PEER_QUERY':
        this.handlePeerQuery(message as PeerQuery, fromPeerId);
        break;
      case 'PEER_FOUND':
        this.handlePeerFound(message as PeerFound & { requestId: string });
        break;
      case 'NETWORK_STATE':
        this.handleNetworkState(message as NetworkState);
        break;
      case 'STORE_MESSAGE':
        this.handleStoreMessage(message as StoreMessage);
        break;
      case 'RELAY':
        this.handleRelayMessage(message);
        break;
      case 'PRESENCE_ANNOUNCEMENT':
        this.handlePresenceAnnouncement(message, fromPeerId);
        break;
      default:
        this.emit('message', message, fromPeerId);
    }
  }

  // Discovery methods implementation
  private findExistingConnection(userId: string): PeerConnection | null {
    for (const [peerId, connection] of this.connections) {
      const peerInfo = this.peerCache.get(peerId);
      if (peerInfo?.userId === userId && connection.state === 'connected') {
        return connection;
      }
    }
    return null;
  }

  private async queryConnectedPeers(userId: string): Promise<PeerInfo | null> {
    const requestId = `query_${Date.now()}_${Math.random()}`;
    const query: PeerQuery = {
      lookingForUserId: userId,
      requestId,
      fromPeerId: this.getCurrentPeerId()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.discoveryRequests.delete(requestId);
        resolve(null); // Don't reject, continue to next discovery method
      }, this.DISCOVERY_TIMEOUT);

      this.discoveryRequests.set(requestId, { resolve, reject, timeout });

      // Send query to all connected peers via WebRTC
      webrtcService.broadcastMessage({
        type: 'PEER_QUERY',
        ...query
      });
    });
  }

  private async queryCachedPeer(userId: string): Promise<PeerInfo | null> {
    if (!this.currentNetworkId) return null;
    
    try {
      const route = await peerStorage.getPeerRoute(userId, this.currentNetworkId);
      if (route) {
        return {
          userId: route.userId,
          peerId: route.peerId,
          signalAddress: route.signalAddress,
          lastSeen: route.lastSeen,
          isCoordinator: false,
          connectionState: 'disconnected',
          canRelay: true,
          connectionPath: route.connectionPath,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to query cached peer:', error);
      return null;
    }
  }

  private async queryCoordinators(userId: string): Promise<PeerInfo | null> {
    const coordinators = Array.from(this.peerCache.values()).filter(peer => peer.isCoordinator);
    
    for (const coordinator of coordinators) {
      try {
        const connection = await this.connectToPeer(coordinator.userId);
        if (connection) {
          // Query coordinator for peer info
          const requestId = `coord_query_${Date.now()}`;
          const query: PeerQuery = {
            lookingForUserId: userId,
            requestId,
            fromPeerId: this.getCurrentPeerId()
          };

          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.discoveryRequests.delete(requestId);
              resolve(null);
            }, this.DISCOVERY_TIMEOUT);

            this.discoveryRequests.set(requestId, { resolve, reject, timeout });

            webrtcService.sendMessage(coordinator.peerId, {
              type: 'PEER_QUERY',
              ...query
            }).catch(error => {
              console.warn('Failed to send query to coordinator:', error);
            });
          });
        }
      } catch (error) {
        console.warn('Failed to query coordinator:', coordinator.userId, error);
        continue;
      }
    }
    return null;
  }

  private async queryRegistry(userId: string): Promise<PeerInfo | null> {
    if (!this.currentNetworkId) return null;
    
    try {
      const token = await storageService.getAuthToken();
      if (!token) return null;

      const response = await authAPI.getNetworkPeer(this.currentNetworkId, userId, token);
      
      if (response.online && response.deviceId) {
        return {
          userId,
          peerId: response.deviceId,
          signalAddress: response.signalAddress || 'http://192.168.1.109:3005',
          lastSeen: new Date(response.lastSeen || new Date()).getTime(),
          isCoordinator: false,
          connectionState: 'disconnected',
          canRelay: true
        };
      }
    } catch (error) {
      console.error('Registry query failed:', error);
    }
    return null;
  }

  private async establishConnection(peerInfo: PeerInfo): Promise<PeerConnection | null> {
    try {
      console.log('Establishing WebRTC connection to:', peerInfo.userId);

      // Use WebRTC service to create connection
      const webrtcConnection = await webrtcService.createConnection(peerInfo.peerId);
      if (!webrtcConnection) {
        console.error('Failed to create WebRTC connection to:', peerInfo.peerId);
        return null;
      }

      const connection: PeerConnection = {
        peerId: peerInfo.peerId,
        connection: webrtcConnection,
        state: 'connecting',
        connectedAt: Date.now(),
        isRelay: false
      };

      this.connections.set(peerInfo.peerId, connection);
      
      // Update peer cache and status
      this.peerCache.set(peerInfo.peerId, peerInfo);
      this.updatePeerStatus(peerInfo.userId, { 
        status: 'direct', 
        lastSeen: Date.now() 
      });

      // Store peer route for future use
      await this.storePeerRoute(peerInfo);

      console.log('WebRTC connection initiated to:', peerInfo.userId);
      return connection;
    } catch (error) {
      console.error('Failed to establish connection:', error);
      return null;
    }
  }


  // Message handling methods
  private handlePeerQuery(query: PeerQuery, fromPeerId: string): void {
    const targetPeer = Array.from(this.peerCache.values()).find(
      peer => peer.userId === query.lookingForUserId
    );

    if (targetPeer) {
      const response: PeerFound = {
        userId: targetPeer.userId,
        signalAddress: targetPeer.signalAddress,
        lastSeen: targetPeer.lastSeen,
        canRelay: targetPeer.canRelay
      };

      webrtcService.sendMessage(fromPeerId, {
        type: 'PEER_FOUND',
        requestId: query.requestId,
        ...response
      }).catch(error => {
        console.warn('Failed to send peer found response:', error);
      });
    }
  }

  private handlePeerFound(response: PeerFound & { requestId: string }): void {
    const request = this.discoveryRequests.get(response.requestId);
    if (request) {
      clearTimeout(request.timeout);
      this.discoveryRequests.delete(response.requestId);
      
      const peerInfo: PeerInfo = {
        userId: response.userId,
        peerId: `peer_${response.userId}_${Date.now()}`, // Generate peer ID
        signalAddress: response.signalAddress,
        lastSeen: response.lastSeen,
        isCoordinator: false,
        connectionState: 'disconnected',
        canRelay: response.canRelay
      };
      
      request.resolve(peerInfo);
    }
  }

  private handleNetworkState(networkState: NetworkState): void {
    // Update local network state
    networkState.onlineMembers.forEach(userId => {
      if (!this.networkMembers.has(userId)) {
        this.updatePeerStatus(userId, { status: 'relay', lastSeen: networkState.timestamp });
      }
    });

    this.emit('networkStateUpdate', networkState);
  }

  private handleStoreMessage(storeMessage: StoreMessage): void {
    if (storeMessage.forUserId === this.currentUserId) {
      // Message is for us, decrypt and handle
      this.emit('storedMessage', storeMessage);
    }
  }

  private handleRelayMessage(message: any): void {
    if (message.to === this.currentUserId) {
      // Message is for us
      this.emit('relayedMessage', message.message);
    } else {
      // Relay to target peer
      this.sendMessage(message.to, message.message);
    }
  }

  private handlePresenceAnnouncement(message: any, fromPeerId: string): void {
    if (!message.userId || !message.networkId || message.networkId !== this.currentNetworkId) {
      return;
    }

    console.log('Received enhanced presence announcement from:', message.userId);

    // Update peer cache with fresh information
    const peerInfo: PeerInfo = {
      userId: message.userId,
      peerId: message.peerId || fromPeerId,
      signalAddress: message.signalAddress,
      lastSeen: message.timestamp || Date.now(),
      isCoordinator: message.isCoordinator || false,
      connectionState: 'connected', // We're receiving from them, so they're connected
      canRelay: message.capabilities?.includes('relay') || false
    };

    this.peerCache.set(peerInfo.peerId, peerInfo);

    // Update network member status
    this.updatePeerStatus(message.userId, {
      status: 'direct', // They're directly connected since we got P2P message
      lastSeen: peerInfo.lastSeen,
      connectionPath: 'direct'
    });

    // Store in SQLite cache for future use
    this.storePeerRoute(peerInfo).catch(error => {
      console.warn('Failed to store peer route from presence:', error);
    });

    // Process enhanced gossip data
    if (message.knownPeers && Array.isArray(message.knownPeers)) {
      console.log(`Processing gossip: ${message.knownPeers.length} known peers from ${message.userId}`);
      
      for (const gossipPeer of message.knownPeers) {
        // Skip if we already know this peer or it's ourselves
        if (gossipPeer.userId === this.currentUserId || this.peerCache.has(gossipPeer.peerId)) {
          continue;
        }

        // Add newly discovered peer to cache
        const discoveredPeer: PeerInfo = {
          userId: gossipPeer.userId,
          peerId: gossipPeer.peerId,
          signalAddress: gossipPeer.signalAddress,
          lastSeen: gossipPeer.lastSeen,
          isCoordinator: gossipPeer.isCoordinator || false,
          connectionState: 'disconnected',
          canRelay: gossipPeer.canRelay || false,
          connectionPath: `via ${message.userId}` // Mark how we discovered this peer
        };

        this.peerCache.set(gossipPeer.peerId, discoveredPeer);
        console.log(`Discovered new peer via gossip: ${gossipPeer.userId} via ${message.userId}`);

        // Store for offline access
        this.storePeerRoute(discoveredPeer).catch(error => {
          console.warn('Failed to store gossip peer route:', error);
        });
      }
    }

    // Process network member status updates
    if (message.networkMembers && Array.isArray(message.networkMembers)) {
      for (const member of message.networkMembers) {
        // Update status if we don't have recent info
        const currentStatus = this.networkMembers.get(member.userId);
        if (!currentStatus || currentStatus.lastSeen < member.lastSeen) {
          this.updatePeerStatus(member.userId, {
            status: member.status,
            lastSeen: member.lastSeen,
            connectionPath: member.status === 'direct' ? 'direct' : `via ${message.userId}`
          });
        }
      }
    }
  }

  // Utility methods
  private findRelayForPeer(_userId: string): PeerConnection | null {
    // Find a connected peer that can relay to the target
    for (const connection of this.getActiveConnections()) {
      const peerInfo = Array.from(this.peerCache.values()).find(
        peer => peer.peerId === connection.peerId
      );
      if (peerInfo?.canRelay) {
        return connection;
      }
    }
    return null;
  }

  private queueMessage(userId: string, message: any): void {
    if (!this.messageQueue.has(userId)) {
      this.messageQueue.set(userId, []);
    }
    this.messageQueue.get(userId)!.push({
      ...message,
      queuedAt: Date.now()
    });
  }

  private async flushMessageQueue(userId: string): Promise<void> {
    const queue = this.messageQueue.get(userId);
    if (queue && queue.length > 0) {
      for (const message of queue) {
        await this.sendMessage(userId, message);
      }
      this.messageQueue.delete(userId);
    }
  }

  private async storeMessageWithCoordinator(userId: string, message: any): Promise<void> {
    const coordinators = Array.from(this.peerCache.values()).filter(peer => peer.isCoordinator);
    
    for (const coordinator of coordinators) {
      const webrtcConnection = webrtcService.getConnection(coordinator.peerId);
      if (webrtcConnection && webrtcConnection.state === 'connected') {
        const storeMessage: StoreMessage = {
          forUserId: userId,
          encryptedMessage: new TextEncoder().encode(JSON.stringify(message)), // TODO: Implement proper encryption
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        
        webrtcService.sendMessage(coordinator.peerId, {
          type: 'STORE_MESSAGE',
          ...storeMessage
        }).catch(error => {
          console.warn('Failed to store message with coordinator:', error);
        });
        break;
      }
    }
  }

  private updatePeerStatus(userId: string, status: PeerStatus): void {
    this.networkMembers.set(userId, status);
    this.emit('peerStatusUpdate', userId, status);
  }

  private getCurrentPeerId(): string {
    return `peer_${this.currentUserId}_${Date.now()}`;
  }

  // Background tasks
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.broadcastNetworkState();
      this.cleanupStaleConnections();
    }, this.HEARTBEAT_INTERVAL);
  }

  private startCoordinatorHeartbeat(): void {
    if (this.isCoordinator) {
      this.coordinatorTimer = setInterval(async () => {
        await this.sendCoordinatorHeartbeat();
      }, this.COORDINATOR_HEARTBEAT);
    }
  }

  private startP2PPresenceAnnouncements(): void {
    // Clear any existing timer
    if (this.p2pPresenceTimer) {
      clearInterval(this.p2pPresenceTimer);
    }

    // Start new timer for P2P presence broadcasts every 10 seconds
    this.p2pPresenceTimer = setInterval(() => {
      this.broadcastPresenceToP2P();
    }, this.P2P_PRESENCE_INTERVAL);

    console.log('Started P2P presence announcements (every 10 seconds)');
  }

  private startRegistryPresenceAnnouncements(token: string): void {
    // Clear any existing timer
    if (this.registryPresenceTimer) {
      clearInterval(this.registryPresenceTimer);
    }

    // Start new timer for registry announcements every 5 minutes
    this.registryPresenceTimer = setInterval(async () => {
      try {
        await this.announcePresenceToRegistry(token);
      } catch (error) {
        console.error('Failed to announce presence to registry:', error);
      }
    }, this.REGISTRY_PRESENCE_INTERVAL);

    console.log('Started registry presence announcements (every 5 minutes)');
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute

    for (const [peerId, connection] of this.connections) {
      if (connection.state === 'failed' || 
          (now - connection.connectedAt > staleThreshold && connection.state !== 'connected')) {
        this.connections.delete(peerId);
        webrtcService.closeConnection(connection.peerId);
      }
    }
  }

  // Storage methods
  private async loadCachedPeers(): Promise<PeerInfo[]> {
    if (!this.currentNetworkId) return [];
    
    try {
      const routes = await peerStorage.getAllPeerRoutes(this.currentNetworkId);
      return routes.map(route => ({
        userId: route.userId,
        peerId: route.peerId,
        signalAddress: route.signalAddress,
        lastSeen: route.lastSeen,
        isCoordinator: false, // Will be updated from network state
        connectionState: 'disconnected',
        canRelay: true,
        connectionPath: route.connectionPath,
      }));
    } catch (error) {
      console.error('Failed to load cached peers:', error);
      return [];
    }
  }

  // Get ICE servers (including TURN) from registry server with caching
  private async getICEServersFromRegistry(token: string | null): Promise<any[] | null> {
    if (!token) {
      console.warn('No auth token - using fallback STUN servers');
      return null;
    }

    // Check cache first
    const now = Date.now();
    if (this.cachedICEServers && now < this.iceServersCacheExpiry) {
      console.log('✅ Using cached ICE servers');
      return this.cachedICEServers;
    }

    try {
      console.log('Fetching fresh ICE servers from registry...');
      const response = await authAPI.getICEServers(token);
      
      // Cache the response
      this.cachedICEServers = response.iceServers;
      this.iceServersCacheExpiry = now + (response.ttl * 1000); // TTL in milliseconds
      
      console.log(`✅ Got ${response.iceServers.length} ICE servers from registry (cached for ${response.ttl}s)`);
      return response.iceServers;
    } catch (error) {
      console.error('Failed to fetch ICE servers from registry:', error);
      
      // Return cached servers if available, even if expired
      if (this.cachedICEServers) {
        console.warn('Using expired cached ICE servers as fallback');
        return this.cachedICEServers;
      }
      
      return null; // Fall back to hardcoded servers
    }
  }

  // Load peers from registry server
  private async loadRegistryPeers(): Promise<void> {
    if (!this.currentNetworkId) return;

    try {
      const token = await storageService.getAuthToken();
      if (!token) return;

      const response = await authAPI.getNetworkPeers(this.currentNetworkId, token);
      
      console.log(`Loaded ${response.peers.length} peers from registry`);

      for (const peer of response.peers) {
        // Skip self
        if (peer.userId === this.currentUserId) continue;

        const peerInfo: PeerInfo = {
          userId: peer.userId,
          peerId: peer.deviceId,
          signalAddress: peer.signalAddress,
          lastSeen: new Date(peer.lastSeen).getTime(),
          isCoordinator: peer.isCoordinator,
          connectionState: 'disconnected',
          canRelay: peer.capabilities.includes('relay'),
        };

        this.peerCache.set(peer.deviceId, peerInfo);
        
        // Update network member status
        this.updatePeerStatus(peer.userId, {
          status: 'offline', // Will be updated by P2P gossip
          lastSeen: peerInfo.lastSeen,
        });

        // Store in local cache for offline access
        await this.storePeerRoute(peerInfo);
      }
    } catch (error) {
      console.error('Failed to load registry peers:', error);
    }
  }

  private async announcePresenceToRegistry(token: string): Promise<void> {
    if (!this.currentNetworkId) return;

    try {
      console.log('Announcing presence to registry server');
      await authAPI.announcePresence(this.currentNetworkId, {
        peerId: this.getCurrentPeerId(),
        signalAddress: 'http://192.168.1.109:3005', // Registry server address for signaling
        capabilities: ['relay', 'store']
      }, token);
      console.log('Successfully announced presence to registry');
    } catch (error) {
      console.error('Failed to announce presence to registry:', error);
    }
  }

  private async sendCoordinatorHeartbeat(): Promise<void> {
    if (!this.currentNetworkId) return;

    try {
      const token = await storageService.getAuthToken();
      if (!token) return;

      await authAPI.coordinatorHeartbeat({
        networkId: this.currentNetworkId,
        peerId: this.getCurrentPeerId(),
        activePeers: this.getActiveConnections().length
      }, token);
    } catch (error) {
      console.error('Failed to send coordinator heartbeat:', error);
    }
  }


  // Store peer route in cache
  private async storePeerRoute(peerInfo: PeerInfo): Promise<void> {
    if (!this.currentNetworkId) return;
    
    try {
      const route: PeerRoute = {
        userId: peerInfo.userId,
        peerId: peerInfo.peerId,
        signalAddress: peerInfo.signalAddress,
        lastSeen: peerInfo.lastSeen,
        successRate: 1.0, // Initial success rate
        connectionPath: peerInfo.connectionPath,
        networkId: this.currentNetworkId,
      };
      
      await peerStorage.storePeerRoute(route);
    } catch (error) {
      console.error('Failed to store peer route:', error);
    }
  }

  // Store offline message
  private async storeOfflineMessageLocally(userId: string, message: any): Promise<void> {
    if (!this.currentNetworkId) return;
    
    try {
      const offlineMessage: OfflineMessage = {
        messageId: `msg_${Date.now()}_${Math.random()}`,
        toUserId: userId,
        content: JSON.stringify(message),
        queuedAt: Date.now(),
        retryCount: 0,
        networkId: this.currentNetworkId,
      };
      
      await peerStorage.storeOfflineMessage(offlineMessage);
    } catch (error) {
      console.error('Failed to store offline message:', error);
    }
  }

  // Store active connection
  private async storeActiveConnectionData(connection: PeerConnection): Promise<void> {
    if (!this.currentNetworkId) return;
    
    try {
      const activeConnection: ActiveConnection = {
        peerId: connection.peerId,
        connectionState: connection.state,
        dataChannelState: connection.connection.dataChannel?.readyState || 'closed',
        connectedAt: connection.connectedAt,
        networkId: this.currentNetworkId,
      };
      
      await peerStorage.storeActiveConnection(activeConnection);
    } catch (error) {
      console.error('Failed to store active connection:', error);
    }
  }

  // Get network statistics
  async getNetworkStats(): Promise<{
    peerRoutes: number;
    offlineMessages: number;
    activeConnections: number;
  }> {
    try {
      return await peerStorage.getDatabaseStats();
    } catch (error) {
      console.error('Failed to get network stats:', error);
      return { peerRoutes: 0, offlineMessages: 0, activeConnections: 0 };
    }
  }

  // Test SQLite functionality
  async testStorage(): Promise<boolean> {
    if (!this.currentNetworkId) {
      console.warn('No network ID set for storage test');
      return false;
    }

    try {
      // Test storing and retrieving a peer route
      const testRoute: PeerRoute = {
        userId: 'test_user',
        peerId: 'test_peer',
        signalAddress: 'test_address',
        lastSeen: Date.now(),
        successRate: 1.0,
        networkId: this.currentNetworkId,
      };

      await peerStorage.storePeerRoute(testRoute);
      console.log('✅ SQLite write test passed');

      const retrievedRoute = await peerStorage.getPeerRoute('test_user', this.currentNetworkId);
      if (retrievedRoute && retrievedRoute.userId === 'test_user') {
        console.log('✅ SQLite read test passed');
        
        // Cleanup test data
        await peerStorage.deletePeerRoute('test_user', this.currentNetworkId);
        console.log('✅ SQLite delete test passed');
        
        return true;
      } else {
        console.error('❌ SQLite read test failed - data mismatch');
        return false;
      }
    } catch (error) {
      console.error('❌ SQLite test failed:', error);
      return false;
    }
  }

  // Cleanup - Stop all P2P activities (called on logout)
  async destroy(): Promise<void> {
    console.log('🛑 Stopping all P2P activities...');
    
    // Stop all timers FIRST to prevent new connections/announcements
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('✅ Stopped heartbeat timer');
    }
    if (this.coordinatorTimer) {
      clearInterval(this.coordinatorTimer);
      this.coordinatorTimer = null;
      console.log('✅ Stopped coordinator timer');
    }
    if (this.p2pPresenceTimer) {
      clearInterval(this.p2pPresenceTimer);
      this.p2pPresenceTimer = null;
      console.log('✅ Stopped P2P presence announcements');
    }
    if (this.registryPresenceTimer) {
      clearInterval(this.registryPresenceTimer);
      this.registryPresenceTimer = null;
      console.log('✅ Stopped registry presence announcements');
    }

    // Close all WebRTC connections
    const activeConnections = this.getActiveConnections();
    console.log(`🔌 Closing ${activeConnections.length} active connections...`);
    for (const connection of this.connections.values()) {
      webrtcService.closeConnection(connection.peerId);
    }
    this.connections.clear();

    // Destroy WebRTC service (closes signaling server connection)
    await webrtcService.destroy();
    console.log('✅ WebRTC service destroyed');
    
    // Clear all pending discovery requests
    for (const request of this.discoveryRequests.values()) {
      clearTimeout(request.timeout);
    }
    this.discoveryRequests.clear();
    console.log('✅ Cleared discovery requests');

    // Clear in-memory data structures
    this.peerCache.clear();
    this.networkMembers.clear();
    this.messageQueue.clear();
    console.log('✅ Cleared in-memory caches');

    // Reset state variables
    this.currentNetworkId = null;
    this.currentUserId = null;
    this.isCoordinator = false;
    console.log('✅ Reset state variables');

    // Cleanup stale data from database
    if (this.currentNetworkId) {
      try {
        await peerStorage.cleanupStaleData(this.currentNetworkId);
      } catch (error) {
        console.error('Failed to cleanup stale data:', error);
      }
    }

    // Close peer storage
    try {
      await peerStorage.close();
      console.log('✅ Peer storage closed');
    } catch (error) {
      console.error('Failed to close peer storage:', error);
    }

    // Remove all event listeners
    this.removeAllListeners();
    console.log('✅ Removed all event listeners');
    
    console.log('🏁 P2P cleanup completed - user fully logged out');
  }
}

export const peerManager = new PeerManager();