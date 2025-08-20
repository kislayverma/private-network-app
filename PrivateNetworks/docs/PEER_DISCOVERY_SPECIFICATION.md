# Implementation Guide: Peer Discovery & Messaging

## System Overview

A P2P messaging system where users can discover and message other network members. The system prioritizes local/P2P discovery over registry API calls for efficiency and decentralization.

## Frontend Implementation Requirements

### 1. Member List Screen

**Component:** MemberListView

**Display Requirements:**

- Show all network members with real-time status
- Status indicators:
  - 🟢 Green = Direct P2P connection active
  - 🟡 Yellow = Online but not directly connected (reachable via relay)
  - ⚫ Gray = Offline
- Show connection path (e.g., "Online via Bob")
- Update status in real-time as connections change

**Data Sources:**
```javascript
// Combine data from multiple sources
memberStatus = {
  registryData: // From initial network load
  localConnections: // From PeerManager
  peerReports: // From P2P network state messages
  cachedData: // From SQLite
}
```

### 2. Connection Manager

**Component:** PeerManager

**Core Responsibilities:**

- Maintain WebRTC connections map
- Handle connection lifecycle
- Implement discovery hierarchy
- Manage message queues for offline peers

**Discovery Priority Order:**

1. Check existing connections (0ms)
2. Query connected peers via P2P (50-200ms)
3. Check local SQLite cache (5ms)
4. Try last known coordinators (100-500ms)
5. Call Registry API (200-1000ms) - LAST RESORT
6. Fall back to store & forward

### 3. Chat Screen

**Component:** ChatView

**Features:**

- Show connection status in header
- Display connection path ("Connected via Bob")
- Show message delivery status (Sending → Delivered → Read)
- Handle offline messages queue
- Auto-upgrade relay connections to direct

### 4. Local Storage Schema

**SQLite Tables Needed:**
```sql
-- Peer routing cache
peer_routes:
- user_id
- peer_id
- signal_address
- last_seen
- success_rate
- connection_path

-- Message queue
offline_messages:
- message_id
- to_user_id
- content
- queued_at
- retry_count

-- Active connections
connections:
- peer_id
- connection_state
- data_channel_state
- connected_at
```

## Backend (Registry) Implementation Requirements

### 1. Essential API Endpoints

Minimize calls to these - they should be last resort
```javascript
// Get active peers in network (called sparingly)
GET /network/{networkId}/active-peers
Response: {
  peers: [{
    userId: string,
    peerId: string,
    signalAddress: string,
    lastSeen: timestamp,
    isCoordinator: boolean
  }]
}

// Announce device presence (called on app start)
POST /network/{networkId}/announce
Body: {
  peerId: string,
  signalAddress: string,
  capabilities: string[]
}

// Get specific peer info (only if P2P discovery fails)
GET /network/{networkId}/peer/{userId}
Response: {
  online: boolean,
  devices: [{
    peerId: string,
    signalAddress: string,
    lastSeen: timestamp
  }],
  lastCoordinators: string[] // Peer IDs that recently saw this user
}

// Coordinator heartbeat (every 5 minutes for coordinators only)
POST /coordinator/heartbeat
Body: {
  networkId: string,
  peerId: string,
  activePeers: number
}
```

### 2. Signaling Server

WebSocket endpoint for WebRTC signaling:

```
wss://signal.yourapp.com/{peerId}
```

**Messages:**

- WebRTC offers/answers
- ICE candidates
- Relay requests (when direct connection fails)

### 3. Database Schema
```sql
-- Active peers tracking
active_peers:
- network_id
- user_id
- peer_id
- signal_address
- last_seen
- is_coordinator

-- Network coordinators
coordinators:
- network_id
- peer_id
- capacity
- last_heartbeat
```

## P2P Protocol Messages

These messages are sent between peers, not to registry:
```protobuf
// Query for a specific peer
message PeerQuery {
  string looking_for_user_id = 1;
  string request_id = 2;
}

// Response with peer info
message PeerFound {
  string user_id = 1;
  string signal_address = 2;
  int64 last_seen = 3;
  bool can_relay = 4;
}

// Network state broadcast (every 30s)
message NetworkState {
  repeated string online_members = 1;
  repeated string coordinators = 2;
  int64 timestamp = 3;
}

// Store & forward request
message StoreMessage {
  string for_user_id = 1;
  bytes encrypted_message = 2;
  int64 expires_at = 3;
}
```

## Connection Establishment Flow

**Frontend Flow:**

1. User taps member name
2. Check existing connections → Found? Use it
3. Ask connected peers → Send PeerQuery to all connected peers
4. Check local cache → Query SQLite for recent routes
5. Try cached coordinators → Attempt connection to last known coordinators
6. Registry API (last resort) → GET /network/{networkId}/peer/{userId}
7. Establish WebRTC connection → Via best available path
8. Send message → Through DataChannel

**Connection State Machine:**

```
DISCONNECTED → DISCOVERING → SIGNALING → CONNECTING → CONNECTED
                    ↓              ↓           ↓
                  FAILED        FAILED      FAILED
                    ↓              ↓           ↓
              RELAY_MODE    RELAY_MODE   STORE_FORWARD
```

## Key Implementation Details

### 1. Connection Pooling
```javascript
class ConnectionPool {
  maxActive = 5;      // Direct connections
  maxStandby = 10;    // Keep-alive only
  maxCached = 50;     // Connection info cached
}
```

### 2. Message Delivery
```javascript
// Try direct send
if (directChannel.ready) {
  directChannel.send(message);
} 
// Try relay
else if (relayPeer.connected) {
  relayPeer.send({type: "RELAY", to: userId, message});
}
// Store & forward
else {
  coordinator.send({type: "STORE", for: userId, message});
  localStorage.queue(message);
}
```

### 3. Background Tasks

**Frontend (React Native):**

- Network state sync every 30s
- Coordinator heartbeat every 5 min (if coordinator)
- Connection cleanup every 60s
- Message retry every 30s

**Backend (Registry):**

- Cleanup stale peers every 5 min
- Coordinator election when needed
- No message storage (P2P only)

## Success Metrics

- Registry API calls: < 1 per minute per user
- Connection success rate: > 90% within 2 seconds
- Message delivery: > 95% within 5 seconds
- Direct connection rate: > 70% of active connections

## Error Handling

- Connection fails: Try next discovery method
- All methods fail: Store & forward mode
- Registry unreachable: Continue with P2P only
- No coordinators: Any peer can relay

## Testing Checklist

- Member list updates without registry calls
- Messages deliver when registry is offline
- Relay connections upgrade to direct automatically
- Offline messages deliver when peer returns
- Connection reuse works properly
- Battery usage acceptable with connection pooling

This architecture ensures the app remains functional even if the registry is unavailable, while providing fast peer discovery and reliable message delivery.