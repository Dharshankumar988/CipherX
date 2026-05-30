# 🔒 CipherX | Secure Cryptographic Chat

CipherX is a secure, end-to-end encrypted (E2EE) chat application. It provides a highly secure communication channel where messages are cryptographically secured using multiple industry-standard algorithms.

---

## 🛡️ Core Cryptographic Architecture

CipherX is built with a focus on absolute message privacy. It implements both symmetric and asymmetric cryptography, allowing users to select the appropriate level of security for their communications.

### 1. RSA-2048 Asymmetric Encryption (True E2EE)
CipherX implements true End-to-End Encryption using RSA-2048 via `node-forge`. 
- **In-App Key Generation**: Each user generates a secure 2048-bit RSA keypair locally on their device.
- **Client-Side Encryption**: Before a message ever leaves the device, the plaintext is encrypted using the recipient's public key. The server and database only ever see the raw ciphertext.
- **Dual-Payload System**: Because asymmetric encryption only allows the possessor of the private key to decrypt the message, the sender encrypts a duplicate copy of the message using their *own* public key. Both encrypted payloads are packaged into a single JSON object, ensuring both parties can read the conversation history, but no one else.

### 2. AES-256 Symmetric Encryption
For scenarios requiring symmetric keys, CipherX utilizes AES-256 (via CryptoJS).
- Messages are encrypted using a pre-shared secret key that both users must agree upon outside the application.
- Offers industrial-grade security with high performance.

### 3. Classical Ciphers (Educational)
CipherX also includes classical cryptographic algorithms for educational and visualization purposes:
- **Caesar Cipher**: A substitution cipher that shifts characters by a specified numeric value.

---

## 🗄️ Database Security & Isolation

CipherX leverages strict Row-Level Security (RLS) policies within PostgreSQL (Supabase) to guarantee that encrypted payloads cannot be queried by unauthorized accounts.

- **Double Opt-In Contacts**: Users cannot exchange encrypted payloads until a mutual cryptographic handshake (contact request approval) is completed.
- **Message Isolation**: The `messages` table enforces RLS ensuring that only authenticated participants of a specific `conversation_id` can `SELECT` or `INSERT` ciphertexts. 
- **Private Key Storage**: The `user_settings` table stores the user's generated private key. RLS ensures that `auth.uid() = user_id`, making it cryptographically impossible for any other user to query another's private key.

---

## ⚡ Real-Time Unread Tracking

CipherX employs a lightweight read-receipt mechanism similar to Telegram/WhatsApp:
- An `is_read` boolean tracks the status of ciphertexts.
- A global realtime listener passively monitors the `messages` table for new incoming ciphertexts.
- State is updated instantaneously to provide unread badge counts across multiple devices without redundant database polling.

---

## 🚀 Setup & Installation

### 1. Database Migration
1. Go to your **Supabase Dashboard** -> **SQL Editor**.
2. Run the queries in the `schema.sql` file to create the core database structure, including performance indexes and unread message tracking.

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anonymous-key
```

### 3. Run Locally
Install dependencies and spin up the Vite development server:
```bash
npm install
npm run dev
```
