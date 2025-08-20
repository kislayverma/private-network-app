import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PeerRoute {
  userId: string;
  peerId: string;
  signalAddress: string;
  lastSeen: number;
  successRate: number;
  connectionPath?: string;
  networkId: string;
}

export interface OfflineMessage {
  messageId: string;
  toUserId: string;
  content: string;
  queuedAt: number;
  retryCount: number;
  networkId: string;
}

export interface ActiveConnection {
  peerId: string;
  connectionState: 'connecting' | 'connected' | 'failed' | 'closed';
  dataChannelState: 'connecting' | 'open' | 'closing' | 'closed';
  connectedAt: number;
  networkId: string;
}

// AsyncStorage-based fallback implementation
class PeerStorageFallbackService {
  private readonly PEER_ROUTES_KEY = 'peer_routes';
  private readonly OFFLINE_MESSAGES_KEY = 'offline_messages';
  private readonly ACTIVE_CONNECTIONS_KEY = 'active_connections';

  async initialize(): Promise<void> {
    console.log('PeerStorageFallbackService initialized (using AsyncStorage)');
  }

  // Peer Routes Management
  async storePeerRoute(route: PeerRoute): Promise<void> {
    try {
      const key = `${this.PEER_ROUTES_KEY}_${route.networkId}`;
      const existingRoutes = await this.getAllPeerRoutes(route.networkId);
      
      const routeIndex = existingRoutes.findIndex(r => r.userId === route.userId);
      if (routeIndex >= 0) {
        existingRoutes[routeIndex] = route;
      } else {
        existingRoutes.push(route);
      }
      
      await AsyncStorage.setItem(key, JSON.stringify(existingRoutes));
      console.log('Peer route stored:', route.userId);
    } catch (error) {
      console.error('Failed to store peer route:', error);
      throw error;
    }
  }

  async getPeerRoute(userId: string, networkId: string): Promise<PeerRoute | null> {
    try {
      const routes = await this.getAllPeerRoutes(networkId);
      return routes.find(route => route.userId === userId) || null;
    } catch (error) {
      console.error('Failed to get peer route:', error);
      return null;
    }
  }

  async getAllPeerRoutes(networkId: string): Promise<PeerRoute[]> {
    try {
      const key = `${this.PEER_ROUTES_KEY}_${networkId}`;
      const routesStr = await AsyncStorage.getItem(key);
      return routesStr ? JSON.parse(routesStr) : [];
    } catch (error) {
      console.error('Failed to get all peer routes:', error);
      return [];
    }
  }

  async updatePeerSuccessRate(userId: string, networkId: string, successRate: number): Promise<void> {
    try {
      const route = await this.getPeerRoute(userId, networkId);
      if (route) {
        route.successRate = successRate;
        await this.storePeerRoute(route);
      }
    } catch (error) {
      console.error('Failed to update peer success rate:', error);
    }
  }

  async deletePeerRoute(userId: string, networkId: string): Promise<void> {
    try {
      const routes = await this.getAllPeerRoutes(networkId);
      const filteredRoutes = routes.filter(route => route.userId !== userId);
      
      const key = `${this.PEER_ROUTES_KEY}_${networkId}`;
      await AsyncStorage.setItem(key, JSON.stringify(filteredRoutes));
      console.log('Peer route deleted:', userId);
    } catch (error) {
      console.error('Failed to delete peer route:', error);
    }
  }

  // Offline Messages Management
  async storeOfflineMessage(message: OfflineMessage): Promise<void> {
    try {
      const key = `${this.OFFLINE_MESSAGES_KEY}_${message.networkId}`;
      const existingMessages = await this.getAllOfflineMessages(message.networkId);
      existingMessages.push(message);
      
      await AsyncStorage.setItem(key, JSON.stringify(existingMessages));
      console.log('Offline message stored:', message.messageId);
    } catch (error) {
      console.error('Failed to store offline message:', error);
      throw error;
    }
  }

  async getOfflineMessages(toUserId: string, networkId: string): Promise<OfflineMessage[]> {
    try {
      const allMessages = await this.getAllOfflineMessages(networkId);
      return allMessages.filter(message => message.toUserId === toUserId);
    } catch (error) {
      console.error('Failed to get offline messages:', error);
      return [];
    }
  }

  async getAllOfflineMessages(networkId: string): Promise<OfflineMessage[]> {
    try {
      const key = `${this.OFFLINE_MESSAGES_KEY}_${networkId}`;
      const messagesStr = await AsyncStorage.getItem(key);
      return messagesStr ? JSON.parse(messagesStr) : [];
    } catch (error) {
      console.error('Failed to get all offline messages:', error);
      return [];
    }
  }

  async incrementMessageRetryCount(messageId: string): Promise<void> {
    // Implementation would need to search through all network messages
    console.log('Increment retry count for:', messageId);
  }

  async deleteOfflineMessage(messageId: string): Promise<void> {
    // Implementation would need to search through all network messages
    console.log('Delete offline message:', messageId);
  }

  async deleteOfflineMessagesForUser(toUserId: string, networkId: string): Promise<void> {
    try {
      const allMessages = await this.getAllOfflineMessages(networkId);
      const filteredMessages = allMessages.filter(message => message.toUserId !== toUserId);
      
      const key = `${this.OFFLINE_MESSAGES_KEY}_${networkId}`;
      await AsyncStorage.setItem(key, JSON.stringify(filteredMessages));
      console.log('Offline messages deleted for user:', toUserId);
    } catch (error) {
      console.error('Failed to delete offline messages for user:', error);
    }
  }

  // Active Connections Management
  async storeActiveConnection(connection: ActiveConnection): Promise<void> {
    try {
      const key = `${this.ACTIVE_CONNECTIONS_KEY}_${connection.networkId}`;
      const existingConnections = await this.getActiveConnections(connection.networkId);
      
      const connectionIndex = existingConnections.findIndex(c => c.peerId === connection.peerId);
      if (connectionIndex >= 0) {
        existingConnections[connectionIndex] = connection;
      } else {
        existingConnections.push(connection);
      }
      
      await AsyncStorage.setItem(key, JSON.stringify(existingConnections));
      console.log('Active connection stored:', connection.peerId);
    } catch (error) {
      console.error('Failed to store active connection:', error);
      throw error;
    }
  }

  async getActiveConnections(networkId: string): Promise<ActiveConnection[]> {
    try {
      const key = `${this.ACTIVE_CONNECTIONS_KEY}_${networkId}`;
      const connectionsStr = await AsyncStorage.getItem(key);
      return connectionsStr ? JSON.parse(connectionsStr) : [];
    } catch (error) {
      console.error('Failed to get active connections:', error);
      return [];
    }
  }

  async updateConnectionState(
    peerId: string, 
    connectionState: string, 
    dataChannelState?: string
  ): Promise<void> {
    // Implementation would need to search through all network connections
    console.log('Update connection state for:', peerId, connectionState, dataChannelState);
  }

  async deleteActiveConnection(peerId: string): Promise<void> {
    // Implementation would need to search through all network connections
    console.log('Delete active connection:', peerId);
  }

  // Cleanup methods
  async cleanupStaleData(networkId: string, maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cutoffTime = Date.now() - maxAge;
      
      // Cleanup old peer routes
      const routes = await this.getAllPeerRoutes(networkId);
      const freshRoutes = routes.filter(route => route.lastSeen > cutoffTime);
      const routesKey = `${this.PEER_ROUTES_KEY}_${networkId}`;
      await AsyncStorage.setItem(routesKey, JSON.stringify(freshRoutes));
      
      // Cleanup old offline messages
      const messages = await this.getAllOfflineMessages(networkId);
      const freshMessages = messages.filter(message => message.queuedAt > cutoffTime);
      const messagesKey = `${this.OFFLINE_MESSAGES_KEY}_${networkId}`;
      await AsyncStorage.setItem(messagesKey, JSON.stringify(freshMessages));
      
      console.log('Stale data cleaned up for network:', networkId);
    } catch (error) {
      console.error('Failed to cleanup stale data:', error);
    }
  }

  async clearNetworkData(networkId: string): Promise<void> {
    try {
      const keys = [
        `${this.PEER_ROUTES_KEY}_${networkId}`,
        `${this.OFFLINE_MESSAGES_KEY}_${networkId}`,
        `${this.ACTIVE_CONNECTIONS_KEY}_${networkId}`,
      ];
      
      await AsyncStorage.multiRemove(keys);
      console.log('Network data cleared for:', networkId);
    } catch (error) {
      console.error('Failed to clear network data:', error);
    }
  }

  // Utility methods
  async getDatabaseStats(): Promise<{
    peerRoutes: number;
    offlineMessages: number;
    activeConnections: number;
  }> {
    try {
      // This is a simplified version - would need to check all networks
      return {
        peerRoutes: 0,
        offlineMessages: 0,
        activeConnections: 0,
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
    }
    
    return { peerRoutes: 0, offlineMessages: 0, activeConnections: 0 };
  }

  async close(): Promise<void> {
    console.log('PeerStorageFallbackService closed');
  }
}

export const peerStorageFallback = new PeerStorageFallbackService();