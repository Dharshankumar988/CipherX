# 🔒 CipherX | Secure Cryptographic Chat

CipherX is a premium, Telegram-style end-to-end encrypted (E2EE) chat application. Designed with a sci-fi cyberpunk dark/neon theme, it provides a secure chat dashboard where users can communicate using four cryptographic engines.

---

## 🌟 Key Features

### 📡 1. Comprehensive Cryptographic Engine
CipherX implements both symmetric and asymmetric cryptography, allowing users to toggle algorithms dynamically:
*   **Caesar Cipher**: Shift letters of the alphabet by a user-specified numeric shift value.
*   **Vigenère Cipher**: Polyalphabetic substitution cipher that encrypts messages using an alphanumeric keyword.
*   **AES-256 (Symmetric)**: Secure, industrial-grade symmetric encryption (via CryptoJS) using a custom secret key/password.
*   **RSA-2048 (Asymmetric E2EE)**: Complete public/private key asymmetric cryptography (via node-forge). 
    *   **In-App Key Generation**: Generate a secure 2048-bit keypair in the settings menu.
    *   **E2EE Client-Side**: Message plaintext is encrypted with the recipient's public key before being sent to the database.
    *   **Sender History Retention**: The sender encrypts a duplicate copy with their own public key, packing them as a single secure JSON object. Only the authorized sender or recipient can decrypt their respective fields using their private key.

### 🛡️ 2. Strict Contact Search & Approval (Double Opt-In)
To preserve absolute privacy:
*   **No Global Directories**: Users are not searchable by username and are not listed globally. You must search for a contact using their **exact email address**.
*   **Double Opt-In Approval**: When User A sends a request, User B must explicitly accept it before a secure channel is established. Chat windows are locked until mutual approval is finalized.

### ⚡ 3. Global Scrambler Animation Overlay
*   When sending or receiving an encrypted message, a matrix-style hacker scrambler overlay triggers in the bottom-left corner of the screen, scrambling the characters of the raw message into ciphertext (or decrypting it) for 2 seconds.
*   This visualizer can be toggled on or off under the **Settings** menu.

### 🎨 4. Premium Cyberpunk Dark/Neon UI
*   Built using glassmorphic cards, harmonized HSL neon colors, custom neon buttons, and responsive grid layouts.
*   Custom browser tab branding with a glowing padlock icon and a styled title.

---

## 🛠️ Tech Stack
*   **Frontend**: React (v19) + TypeScript + Vite
*   **Styling**: Vanilla CSS with Tailwind CSS (v4)
*   **Icons**: Lucide React
*   **Backend & Realtime**: Supabase (PostgreSQL + Realtime Channel subscriptions)
*   **Cryptographic Libraries**: `crypto-js` (for AES), `node-forge` (for RSA-2048)

---

## 🗄️ Database Architecture & Security (RLS)

CipherX uses Row-Level Security (RLS) policies in Supabase to ensure complete data isolation:
*   **`profiles`**: Stores public display names and public RSA keys. Accessible to all users for lookup during contacts search and RSA encryption.
*   **`contacts`**: Manages friend requests and approvals. Users can only view records where they are the requester or addressee.
*   **`messages`**: Contains encrypted ciphertext. Users can only read messages if they are a registered participant of the conversation.
*   **`user_settings`**: Stores private RSA keys, default algorithms, and visualization preferences. Users can only select and modify their own settings record.

---

## 🚀 Setup & Installation

### 1. Database Migration
Before running the app, execute the database migration script.
1. Go to your **Supabase Dashboard** -> **SQL Editor**.
2. Run the queries in the [schema.sql](file:///C:/IMP%20PROJECTS/CipherX/schema.sql) file to create the core database structure.
3. Run the queries in the [update_schema.sql](file:///C:/IMP%20PROJECTS/CipherX/update_schema.sql) migration script to apply the latest column and policy updates.

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anonymous-key
```

### 3. Run Locally
Install dependencies and spin up the Vite development server:
```bash
# Install packages
npm install

# Start local server
npm run dev
```

---

## 🔒 Cryptographic Implementation Details

### Caesar Cipher (`caesar.ts`)
```typescript
export function encryptCaesar(text: string, shift: number): string { ... }
export function decryptCaesar(text: string, shift: number): string { ... }
```

### Vigenère Cipher (`vigenere.ts`)
```typescript
export function encryptVigenere(text: string, keyword: string): string { ... }
export function decryptVigenere(text: string, keyword: string): string { ... }
```

### AES-256 (`aes.ts`)
```typescript
export function encryptAES(text: string, secretKey: string): string { ... }
export function decryptAES(ciphertext: string, secretKey: string): string { ... }
```

### RSA Asymmetric (`rsa.ts`)
```typescript
export function generateRSAKeys(): { publicKey: string, privateKey: string } { ... }
export function encryptRSA(text: string, publicKeyPem: string): string { ... }
export function decryptRSA(ciphertext: string, privateKeyPem: string): string { ... }
```
