import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

// Enable debugging for SQLite
SQLite.DEBUG(__DEV__);
SQLite.enablePromise(true);

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

class PeerStorageService {
  private db: SQLiteDatabase | null = null;
  private readonly DB_NAME = 'peer_data.db';
  private readonly DB_VERSION = '1.0';
  private readonly DB_DISPLAY_NAME = 'Peer Data Database';
  private readonly DB_SIZE = 200000;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: this.DB_NAME,
        location: 'default'
      });

      await this.createTables();
      console.log('PeerStorageService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PeerStorageService:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createPeerRoutesTable = `
      CREATE TABLE IF NOT EXISTS peer_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        signal_address TEXT NOT NULL,
        last_seen INTEGER NOT NULL,
        success_rate REAL DEFAULT 1.0,
        connection_path TEXT,
        network_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(user_id, network_id)
      );
    `;

    const createOfflineMessagesTable = `
      CREATE TABLE IF NOT EXISTS offline_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE NOT NULL,
        to_user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        queued_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        network_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `;

    const createActiveConnectionsTable = `
      CREATE TABLE IF NOT EXISTS active_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        peer_id TEXT UNIQUE NOT NULL,
        connection_state TEXT NOT NULL,
        data_channel_state TEXT NOT NULL,
        connected_at INTEGER NOT NULL,
        network_id TEXT NOT NULL,
        last_ping INTEGER DEFAULT (strftime('%s', 'now')),
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_peer_routes_user_network ON peer_routes(user_id, network_id);
      CREATE INDEX IF NOT EXISTS idx_peer_routes_last_seen ON peer_routes(last_seen);
      CREATE INDEX IF NOT EXISTS idx_offline_messages_user ON offline_messages(to_user_id, network_id);
      CREATE INDEX IF NOT EXISTS idx_offline_messages_queued ON offline_messages(queued_at);
      CREATE INDEX IF NOT EXISTS idx_active_connections_network ON active_connections(network_id);
    `;

    try {
      await this.db.executeSql(createPeerRoutesTable, []);
      await this.db.executeSql(createOfflineMessagesTable, []);
      await this.db.executeSql(createActiveConnectionsTable, []);
      await this.db.executeSql(createIndexes, []);
      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Failed to create database tables:', error);
      throw error;
    }
  }

  // Peer Routes Management
  async storePeerRoute(route: PeerRoute): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT OR REPLACE INTO peer_routes 
      (user_id, peer_id, signal_address, last_seen, success_rate, connection_path, network_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `;

    try {
      await this.db.executeSql(query, [
        route.userId,
        route.peerId,
        route.signalAddress,
        route.lastSeen,
        route.successRate,
        route.connectionPath || null,
        route.networkId,
      ]);
      console.log('Peer route stored:', route.userId);
    } catch (error) {
      console.error('Failed to store peer route:', error);
      throw error;
    }
  }

  async getPeerRoute(userId: string, networkId: string): Promise<PeerRoute | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT user_id, peer_id, signal_address, last_seen, success_rate, connection_path, network_id
      FROM peer_routes 
      WHERE user_id = ? AND network_id = ?
    `;

    try {
      const results = await this.db.executeSql(query, [userId, networkId]);
      const resultSet = results[0];
      
      if (resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        return {
          userId: row.user_id,
          peerId: row.peer_id,
          signalAddress: row.signal_address,
          lastSeen: row.last_seen,
          successRate: row.success_rate,
          connectionPath: row.connection_path,
          networkId: row.network_id,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get peer route:', error);
      return null;
    }
  }

  async getAllPeerRoutes(networkId: string): Promise<PeerRoute[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT user_id, peer_id, signal_address, last_seen, success_rate, connection_path, network_id
      FROM peer_routes 
      WHERE network_id = ?
      ORDER BY last_seen DESC
    `;

    try {
      const results = await this.db.executeSql(query, [networkId]);
      const resultSet = results[0];
      const routes: PeerRoute[] = [];

      for (let i = 0; i < resultSet.rows.length; i++) {
        const row = resultSet.rows.item(i);
        routes.push({
          userId: row.user_id,
          peerId: row.peer_id,
          signalAddress: row.signal_address,
          lastSeen: row.last_seen,
          successRate: row.success_rate,
          connectionPath: row.connection_path,
          networkId: row.network_id,
        });
      }

      return routes;
    } catch (error) {
      console.error('Failed to get all peer routes:', error);
      return [];
    }
  }

  async updatePeerSuccessRate(userId: string, networkId: string, successRate: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      UPDATE peer_routes 
      SET success_rate = ?, updated_at = strftime('%s', 'now')
      WHERE user_id = ? AND network_id = ?
    `;

    try {
      await this.db.executeSql(query, [successRate, userId, networkId]);
    } catch (error) {
      console.error('Failed to update peer success rate:', error);
    }
  }

  async deletePeerRoute(userId: string, networkId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = 'DELETE FROM peer_routes WHERE user_id = ? AND network_id = ?';

    try {
      await this.db.executeSql(query, [userId, networkId]);
      console.log('Peer route deleted:', userId);
    } catch (error) {
      console.error('Failed to delete peer route:', error);
    }
  }

  // Offline Messages Management
  async storeOfflineMessage(message: OfflineMessage): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT OR REPLACE INTO offline_messages 
      (message_id, to_user_id, content, queued_at, retry_count, network_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.db.executeSql(query, [
        message.messageId,
        message.toUserId,
        message.content,
        message.queuedAt,
        message.retryCount,
        message.networkId,
      ]);
      console.log('Offline message stored:', message.messageId);
    } catch (error) {
      console.error('Failed to store offline message:', error);
      throw error;
    }
  }

  async getOfflineMessages(toUserId: string, networkId: string): Promise<OfflineMessage[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT message_id, to_user_id, content, queued_at, retry_count, network_id
      FROM offline_messages 
      WHERE to_user_id = ? AND network_id = ?
      ORDER BY queued_at ASC
    `;

    try {
      const results = await this.db.executeSql(query, [toUserId, networkId]);
      const resultSet = results[0];
      const messages: OfflineMessage[] = [];

      for (let i = 0; i < resultSet.rows.length; i++) {
        const row = resultSet.rows.item(i);
        messages.push({
          messageId: row.message_id,
          toUserId: row.to_user_id,
          content: row.content,
          queuedAt: row.queued_at,
          retryCount: row.retry_count,
          networkId: row.network_id,
        });
      }

      return messages;
    } catch (error) {
      console.error('Failed to get offline messages:', error);
      return [];
    }
  }

  async getAllOfflineMessages(networkId: string): Promise<OfflineMessage[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT message_id, to_user_id, content, queued_at, retry_count, network_id
      FROM offline_messages 
      WHERE network_id = ?
      ORDER BY queued_at ASC
    `;

    try {
      const results = await this.db.executeSql(query, [networkId]);
      const resultSet = results[0];
      const messages: OfflineMessage[] = [];

      for (let i = 0; i < resultSet.rows.length; i++) {
        const row = resultSet.rows.item(i);
        messages.push({
          messageId: row.message_id,
          toUserId: row.to_user_id,
          content: row.content,
          queuedAt: row.queued_at,
          retryCount: row.retry_count,
          networkId: row.network_id,
        });
      }

      return messages;
    } catch (error) {
      console.error('Failed to get all offline messages:', error);
      return [];
    }
  }

  async incrementMessageRetryCount(messageId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      UPDATE offline_messages 
      SET retry_count = retry_count + 1
      WHERE message_id = ?
    `;

    try {
      await this.db.executeSql(query, [messageId]);
    } catch (error) {
      console.error('Failed to increment message retry count:', error);
    }
  }

  async deleteOfflineMessage(messageId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = 'DELETE FROM offline_messages WHERE message_id = ?';

    try {
      await this.db.executeSql(query, [messageId]);
      console.log('Offline message deleted:', messageId);
    } catch (error) {
      console.error('Failed to delete offline message:', error);
    }
  }

  async deleteOfflineMessagesForUser(toUserId: string, networkId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = 'DELETE FROM offline_messages WHERE to_user_id = ? AND network_id = ?';

    try {
      await this.db.executeSql(query, [toUserId, networkId]);
      console.log('Offline messages deleted for user:', toUserId);
    } catch (error) {
      console.error('Failed to delete offline messages for user:', error);
    }
  }

  // Active Connections Management
  async storeActiveConnection(connection: ActiveConnection): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT OR REPLACE INTO active_connections 
      (peer_id, connection_state, data_channel_state, connected_at, network_id, last_ping)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `;

    try {
      await this.db.executeSql(query, [
        connection.peerId,
        connection.connectionState,
        connection.dataChannelState,
        connection.connectedAt,
        connection.networkId,
      ]);
      console.log('Active connection stored:', connection.peerId);
    } catch (error) {
      console.error('Failed to store active connection:', error);
      throw error;
    }
  }

  async getActiveConnections(networkId: string): Promise<ActiveConnection[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT peer_id, connection_state, data_channel_state, connected_at, network_id
      FROM active_connections 
      WHERE network_id = ?
      ORDER BY connected_at DESC
    `;

    try {
      const results = await this.db.executeSql(query, [networkId]);
      const resultSet = results[0];
      const connections: ActiveConnection[] = [];

      for (let i = 0; i < resultSet.rows.length; i++) {
        const row = resultSet.rows.item(i);
        connections.push({
          peerId: row.peer_id,
          connectionState: row.connection_state,
          dataChannelState: row.data_channel_state,
          connectedAt: row.connected_at,
          networkId: row.network_id,
        });
      }

      return connections;
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
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      UPDATE active_connections 
      SET connection_state = ?, last_ping = strftime('%s', 'now')
    `;
    const params: any[] = [connectionState];

    if (dataChannelState) {
      query += ', data_channel_state = ?';
      params.push(dataChannelState);
    }

    query += ' WHERE peer_id = ?';
    params.push(peerId);

    try {
      await this.db.executeSql(query, params);
    } catch (error) {
      console.error('Failed to update connection state:', error);
    }
  }

  async deleteActiveConnection(peerId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = 'DELETE FROM active_connections WHERE peer_id = ?';

    try {
      await this.db.executeSql(query, [peerId]);
      console.log('Active connection deleted:', peerId);
    } catch (error) {
      console.error('Failed to delete active connection:', error);
    }
  }

  // Cleanup methods
  async cleanupStaleData(networkId: string, maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Math.floor((Date.now() - maxAge) / 1000);

    const queries = [
      // Clean up old peer routes
      'DELETE FROM peer_routes WHERE network_id = ? AND last_seen < ?',
      // Clean up old offline messages (older than 24 hours)
      'DELETE FROM offline_messages WHERE network_id = ? AND queued_at < ?',
      // Clean up stale connections
      'DELETE FROM active_connections WHERE network_id = ? AND last_ping < ?',
    ];

    try {
      for (const query of queries) {
        await this.db.executeSql(query, [networkId, cutoffTime]);
      }
      console.log('Stale data cleaned up for network:', networkId);
    } catch (error) {
      console.error('Failed to cleanup stale data:', error);
    }
  }

  async clearNetworkData(networkId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const queries = [
      'DELETE FROM peer_routes WHERE network_id = ?',
      'DELETE FROM offline_messages WHERE network_id = ?',
      'DELETE FROM active_connections WHERE network_id = ?',
    ];

    try {
      for (const query of queries) {
        await this.db.executeSql(query, [networkId]);
      }
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
    if (!this.db) throw new Error('Database not initialized');

    try {
      const routesResult = await this.db.executeSql('SELECT COUNT(*) as count FROM peer_routes', []);
      const messagesResult = await this.db.executeSql('SELECT COUNT(*) as count FROM offline_messages', []);
      const connectionsResult = await this.db.executeSql('SELECT COUNT(*) as count FROM active_connections', []);

      return {
        peerRoutes: routesResult[0].rows.item(0).count,
        offlineMessages: messagesResult[0].rows.item(0).count,
        activeConnections: connectionsResult[0].rows.item(0).count,
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return { peerRoutes: 0, offlineMessages: 0, activeConnections: 0 };
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('PeerStorageService closed');
    }
  }
}

export const peerStorage = new PeerStorageService();