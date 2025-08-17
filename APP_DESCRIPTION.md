# Private Networks App

## Overall Architecture
```
┌─────────────────────────────────┐
│    Network Registry Server       │
│   (registry.yourapp.com)         │
├─────────────────────────────────┤
│ • User accounts & identity       │
│ • Network directory              │
│ • Join approvals                 │
│ • Payment processing             │
│ • Bootstrap coordination         │
└─────────────────────────────────┘
         ↓ API ↓
┌─────────────────────────────────┐
│      Mobile App (React Native)   │
│ • Local P2P connections          │
│ • Cached network data            │
│ • Direct peer messaging          │
└─────────────────────────────────┘
```

## User Journey: First Time User

### Screen 1: Welcome
```
┌─────────────────────────────────┐
│                                 │
│         [App Logo]              │
│                                 │
│    Private Networks for         │
│    Teams & Communities          │
│                                 │
│  Create secure, private spaces  │
│  for your group                 │
│                                 │
│                                 │
│  [Get Started]                  │
│                                 │
│  Already have an account?       │
│  [Sign In]                      │
└─────────────────────────────────┘
```

### Screen 2: Create Identity
```
┌─────────────────────────────────┐
│ Create Your Identity            │
├─────────────────────────────────┤
│                                 │
│ Choose a username               │
│ [alice_smith                 ]  │
│ ✓ Available                     │
│                                 │
│ Email (for account recovery)    │
│ [alice@example.com           ]  │
│                                 │
│ Phone (optional)                │
│ [+1 555-0100                 ]  │
│                                 │
│ [Generate Secure Identity]      │
│                                 │
│ ────────────────────────────    │
│ This creates a cryptographic    │
│ identity that only you control  │
└─────────────────────────────────┘
```

**Backend Process:**
```
1. Check username availability against registry
2. Generate Ed25519 keypair locally on device
3. Create account on registry:
   - Username → Public Key mapping
   - Email for recovery (encrypted)
   - Account creation timestamp
4. Store private key in device secure storage
```

### Screen 3: Identity Confirmation
```
┌─────────────────────────────────┐
│ Your Identity Created! 🔐        │
├─────────────────────────────────┤
│                                 │
│ Username: @alice_smith          │
│                                 │
│ Your Identity Key:              │
│ ┌─────────────────────────────┐ │
│ │ [QR CODE]                   │ │
│ │                             │ │
│ │ Backup this key!            │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Save Backup]  [I've Saved It]  │
│                                 │
│ ⚠️ This key is your identity.   │
│ Lost key = lost account         │
└─────────────────────────────────┘
```

### Screen 4: Home (Empty State)
```
┌─────────────────────────────────┐
│ Networks              @alice     │
├─────────────────────────────────┤
│                                 │
│        📱                       │
│   No networks yet               │
│                                 │
│ Join your first network or      │
│ create one for your group       │
│                                 │
│ [Create Network]                │
│                                 │
│ [Join with Invite Code]         │
│                                 │
└─────────────────────────────────┘
```

## Creating a Network

### Screen 5: Network Setup
```
┌─────────────────────────────────┐
│ ← Create Network                │
├─────────────────────────────────┤
│                                 │
│ Network Name                    │
│ [Smith Family                ]  │
│                                 │
│ Description                     │
│ [Family updates, photos and  ]  │
│ [planning                    ]  │
│                                 │
│ Network ID (auto-generated)     │
│ smith-family-2024               │
│ [Regenerate]                    │
│                                 │
│ Initial Members                 │
│ You + [9] others (10 free)      │
│                                 │
│ [Continue]                      │
└─────────────────────────────────┘
```

### Screen 6: Network Settings
```
┌─────────────────────────────────┐
│ ← Network Settings              │
├─────────────────────────────────┤
│                                 │
│ Join Approval                   │
│ ✅ Require admin approval       │
│ ☐ Auto-approve with code       │
│                                 │
│ Member Permissions              │
│ ☐ Members can invite others    │
│ ✅ Only admins can invite       │
│                                 │
│ Data Retention                  │
│ ○ Keep messages forever         │
│ ● Delete after 30 days          │
│ ○ Delete after 7 days           │
│                                 │
│ [Create Network]                │
└─────────────────────────────────┘
```

**Backend Process:**
```
1. Registry creates network record:
   - NetworkID (unique)
   - Creator identity
   - Settings and permissions
   - Creation timestamp
   - Payment tier (free <10)

2. Creator becomes first coordinator
3. Network registered in discovery database
4. Generate invite codes
```

### Screen 7: Network Created
```
┌─────────────────────────────────┐
│ Network Ready!                  │
├─────────────────────────────────┤
│                                 │
│ Smith Family                    │
│ Members: 1/10 (Free)            │
│                                 │
│ Invite Code: SMITH-A7K9-2024    │
│ [Copy Code]                     │
│                                 │
│ Share this code with family     │
│ members. You'll approve each    │
│ join request.                   │
│                                 │
│ [Invite Members]                │
│ [Go to Network]                 │
└─────────────────────────────────┘
```

## Member Joins Network

### New User Journey:

### Screen A: Join Network
```
┌─────────────────────────────────┐
│ Join Network                    │
├─────────────────────────────────┤
│                                 │
│ Enter Invite Code               │
│ [SMITH-A7K9-2024           ]    │
│                                 │
│ [Look Up Network]               │
└─────────────────────────────────┘
```

### Screen B: Network Found
```
┌─────────────────────────────────┐
│ Network Details                 │
├─────────────────────────────────┤
│                                 │
│ Smith Family                    │
│ Created by: @alice_smith        │
│ Members: 3/10                   │
│                                 │
│ "Family updates, photos and     │
│  planning"                      │
│                                 │
│ Your Display Name               │
│ [Bob Smith                  ]   │
│                                 │
│ Message to Admin                │
│ [Hi, it's Bob!              ]   │
│                                 │
│ [Request to Join]               │
└─────────────────────────────────┘
```

**Backend Process:**
```
1. Registry looks up network by invite code
2. Creates join request:
   - RequestID
   - User identity
   - Network ID
   - Message
   - Timestamp
3. Notifies network admins
```

## Admin Approval Flow

### Screen: Pending Approvals (Admin View)
```
┌─────────────────────────────────┐
│ Smith Family          [3]🔔     │
├─────────────────────────────────┤
│ Pending Approvals               │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ @bob_smith                  │ │
│ │ "Hi, it's Bob!"             │ │
│ │ [View] [Approve] [Deny]     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ @carol_jones                │ │
│ │ "Alice invited me"          │ │
│ │ [View] [Approve] [Deny]     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Screen: Approve Member
```
┌─────────────────────────────────┐
│ Approve Member?                 │
├─────────────────────────────────┤
│                                 │
│ @bob_smith                      │
│ Joined: Today                   │
│ Identity verified ✓             │
│                                 │
│ Message: "Hi, it's Bob!"        │
│                                 │
│ Set Role:                       │
│ ○ Admin                         │
│ ● Member                        │
│ ○ Read-only                     │
│                                 │
│ [Approve] [Deny] [Cancel]       │
└─────────────────────────────────┘
```

## Payment Flow (>10 members)

### Screen: Upgrade Required
```
┌─────────────────────────────────┐
│ Grow Your Network 🚀            │
├─────────────────────────────────┤
│                                 │
│ Smith Family has 10 members     │
│                                 │
│ To add more members, upgrade:   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Up to 50 members            │ │
│ │ $4.99/month                 │ │
│ │ • Priority support          │ │
│ │ • Advanced admin tools      │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Up to 100 members           │ │
│ │ $9.99/month                 │ │
│ │ • Everything above +        │ │
│ │ • Analytics dashboard       │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Choose Plan]                   │
└─────────────────────────────────┘
```

## Registry API Structure:

### User Endpoints:
```
POST /auth/register
  → Create identity, register public key

POST /auth/login
  → Verify identity signature

GET /user/profile
  → Get user's networks and profile
```

### Network Endpoints:
```
POST /network/create
  → Register new network

GET /network/{id}
  → Get network metadata

POST /network/{id}/request-join
  → Submit join request

GET /network/{id}/requests (admin)
  → View pending requests

POST /network/{id}/approve (admin)
  → Approve member

POST /network/{id}/update-coordinators
  → Update active coordinator list
```

### Discovery Endpoints:
```
GET /bootstrap/network/{id}
  → Get coordinators for P2P connection

POST /bootstrap/heartbeat
  → Coordinator availability update
```

## Data Stored in Registry:

### User Record:
```json
{
  "userId": "alice_smith",
  "publicKey": "ed25519:...",
  "email": "encrypted:...",
  "created": "2024-01-15",
  "networks": ["smith-family", "book-club"],
  "subscription": "free"
}
```

### Network Record:
```json
{
  "networkId": "smith-family-2024",
  "name": "Smith Family",
  "creator": "alice_smith",
  "admins": ["alice_smith"],
  "members": [
    {"userId": "alice_smith", "role": "admin"},
    {"userId": "bob_smith", "role": "member"}
  ],
  "settings": {
    "requireApproval": true,
    "maxMembers": 10
  },
  "billing": {
    "tier": "free",
    "memberCount": 2
  },
  "coordinators": [
    {"peerId": "alice_device_1", "lastSeen": "..."}
  ]
}
```