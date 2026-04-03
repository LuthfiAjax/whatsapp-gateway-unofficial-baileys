# WhatsApp Gateway

Production-ready multi-user WhatsApp Gateway berbasis Bun, TypeScript, Baileys, dan SQLite.

Project ini mendukung:

- JWT authentication untuk dashboard / human access
- API key authentication untuk machine-to-machine access
- isolasi multi-user per session
- template message
- bulk message dan broadcast
- webhook delivery dengan retry
- queue pengiriman message dengan retry
- request logging dan rate limiting
- session persistence dan auto restore

## Arsitektur

Komponen utama:

- `Bun + TypeScript` untuk HTTP server dan runtime
- `Baileys` untuk koneksi WhatsApp multi-device
- `SQLite` untuk persistence user, session, message, template, broadcast, webhook, dan log
- `WebSocket` untuk realtime event subscription
- `In-memory queue` untuk antrean kirim pesan dan retry

Catatan:

- queue saat ini masih in-memory, belum Redis
- endpoint existing tetap dipertahankan dan tidak dihapus

## Fitur Utama

- Multi-user isolation
- JWT access token 15 menit
- Refresh token 7 hari
- API key hashed di database
- API key scopes
- optional IP whitelist per API key
- session lifecycle: `connected`, `connecting`, `disconnected`, `banned`
- message status: `queued`, `sent`, `delivered`, `read`, `failed`
- template CRUD dan dynamic variable replacement
- broadcast dengan delay control
- webhook event delivery log + retry max 3x
- request log + failed auth log
- auto format nomor ke format internasional

## Database

Minimal table yang dipakai:

- `users`
- `refresh_tokens`
- `api_keys`
- `sessions`
- `auth_states`
- `messages`
- `templates`
- `broadcasts`
- `broadcast_recipients`
- `webhooks`
- `webhook_deliveries`
- `logs`
- `message_logs`

## Install

```bash
bun install
```

## Environment

Contoh environment .env yang dipakai aplikasi:

```env
APP_HOST=0.0.0.0
APP_BASE_URL=http://localhost:3010
PORT=3010
NODE_ENV=development

SQLITE_PATH=./data/app.db

JWT_SECRET=super-secret-jwt-key-replace-me-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120

WEBHOOK_RETRY_COUNT=3
WEBHOOK_TIMEOUT_MS=5000

DEFAULT_COUNTRY_CODE=62
DAILY_MESSAGE_QUOTA=10000
```

## Run

Development:

```bash
bun run dev
```

Production build:

```bash
bun run build
```

Production start:

```bash
bun run start
```

Output bundle ada di `dist/index.js`.

## Authentication

Ada 2 mode auth:

### 1. JWT for Human Access

Dipakai untuk dashboard / admin / operator.

Header:

```http
Authorization: Bearer <access_token>
```

Flow:

1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/login`
3. gunakan `accessToken` untuk request dashboard
4. gunakan `refreshToken` ke `POST /api/v1/auth/refresh-token` saat access token expired

### 2. API Key for Machine Access

Dipakai untuk integrasi server-to-server.

Header:

```http
x-api-key: <api_key>
```

Scopes yang tersedia:

- `send_message`
- `manage_session`
- `read_status`
- `manage_template`

Semua endpoint selain `/api/v1/auth/*` membutuhkan JWT atau API key.

## Quick Start

### Register user

```bash
curl -X POST http://localhost:3010/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"secret123"}'
```

### Login

```bash
curl -X POST http://localhost:3010/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"secret123"}'
```

### Generate API key

```bash
curl -X POST http://localhost:3010/api/v1/apikeys/generate \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{
    "name":"backend-prod",
    "scopes":["send_message","manage_session","read_status"],
    "ipWhitelist":["127.0.0.1"]
  }'
```

### Create session

```bash
curl -X POST http://localhost:3010/api/v1/sessions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{"sessionName":"sales-1","phoneNumber":"628123456789","webhookUrl":"https://example.com/wa/webhook"}'
```

### Connect session

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/connect \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{"method":"qr","phoneNumber":"628123456789"}'
```

Jika belum terkoneksi, response akan berisi `state=awaiting_qr` dan `qrCodeBase64`.

### Send text message

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/text \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{"to":"628123456789","text":"hello from gateway"}'
```

## API Reference

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh-token`
- `GET /api/v1/auth/me`

Example refresh token:

```bash
curl -X POST http://localhost:3010/api/v1/auth/refresh-token \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refresh_token>"}'
```

### API Keys

- `GET /api/v1/apikeys`
- `POST /api/v1/apikeys/generate`
- `PATCH /api/v1/apikeys/{id}/revoke`
- `DELETE /api/v1/apikeys/{id}`

### Sessions

Existing endpoint yang tetap dipertahankan:

- `GET /api/v1/sessions`
- `POST /api/v1/sessions`
- `POST /api/v1/sessions/{id}/connect`
- `GET /api/v1/sessions/{id}/status`
- `POST /api/v1/sessions/{id}/messages/text`

Endpoint session tambahan:

- `GET /api/v1/sessions/{id}`
- `POST /api/v1/sessions/{id}/disconnect`
- `DELETE /api/v1/sessions/{id}`
- `GET /api/v1/sessions/{id}/qr`
- `GET /api/v1/sessions/{id}/info`
- `PATCH /api/v1/sessions/{id}`
- `PATCH /api/v1/sessions/{id}/phone`
- `PATCH /api/v1/sessions/{id}/webhook`

Example get QR:

```bash
curl http://localhost:3010/api/v1/sessions/<session-id>/qr \
  -H 'Authorization: Bearer <access_token>'
```

Example get device info:

```bash
curl http://localhost:3010/api/v1/sessions/<session-id>/info \
  -H 'Authorization: Bearer <access_token>'
```

### Messaging

Endpoints:

- `POST /api/v1/sessions/{id}/messages/text`
- `POST /api/v1/sessions/{id}/messages/media`
- `POST /api/v1/sessions/{id}/messages/image`
- `POST /api/v1/sessions/{id}/messages/video`
- `POST /api/v1/sessions/{id}/messages/audio`
- `POST /api/v1/sessions/{id}/messages/document`
- `POST /api/v1/sessions/{id}/messages/location`
- `POST /api/v1/sessions/{id}/messages/contact`
- `POST /api/v1/sessions/{id}/messages/buttons`
- `POST /api/v1/sessions/{id}/messages/list`
- `POST /api/v1/sessions/{id}/messages/bulk`
- `POST /api/v1/sessions/{id}/messages/template`

Contoh image:

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/image \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "to":"628123456789",
    "url":"https://example.com/image.jpg",
    "caption":"halo"
  }'
```

Contoh document:

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/document \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "to":"628123456789",
    "url":"https://example.com/invoice.pdf",
    "fileName":"invoice.pdf",
    "mimeType":"application/pdf",
    "caption":"Invoice"
  }'
```

Contoh location:

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/location \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "to":"628123456789",
    "latitude":-6.2,
    "longitude":106.8,
    "name":"Jakarta",
    "address":"Indonesia"
  }'
```

Contoh buttons:

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/buttons \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "to":"628123456789",
    "text":"Pilih menu",
    "footer":"Footer text",
    "buttons":[
      {"id":"yes","text":"Ya"},
      {"id":"no","text":"Tidak"}
    ]
  }'
```

Contoh list:

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/list \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "to":"628123456789",
    "text":"Daftar produk",
    "buttonText":"Buka",
    "sections":[
      {
        "title":"Paket",
        "rows":[
          {"id":"basic","title":"Basic","description":"Paket basic"}
        ]
      }
    ]
  }'
```

Contoh bulk:

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/bulk \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "text":"Halo {{name}}",
    "delayMs":1000,
    "recipients":[
      {"to":"628111111111","variables":{"name":"John"}},
      {"to":"628222222222","variables":{"name":"Jane"}}
    ]
  }'
```

Behavior:

- nomor akan diformat otomatis ke format internasional
- message masuk ke queue dulu
- retry maksimal 3x jika gagal

### Templates

Endpoints:

- `GET /api/v1/templates`
- `POST /api/v1/templates`
- `PUT /api/v1/templates/{id}`
- `DELETE /api/v1/templates/{id}`

Contoh create template text:

```bash
curl -X POST http://localhost:3010/api/v1/templates \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{
    "name":"invoice-reminder",
    "type":"text",
    "content":"Halo {{name}}, invoice {{invoice}} sudah jatuh tempo.",
    "variables":["name","invoice"]
  }'
```

Contoh send template:

```bash
curl -X POST http://localhost:3010/api/v1/sessions/<session-id>/messages/template \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "to":"628123456789",
    "templateId":"<template-id>",
    "variables":{
      "name":"John",
      "invoice":"INV-001"
    }
  }'
```

### Broadcasts

Endpoints:

- `POST /api/v1/broadcasts`
- `GET /api/v1/broadcasts`
- `GET /api/v1/broadcasts/{id}/report`

Broadcast mendukung:

- recipients array
- upload CSV
- custom text
- template
- delay anti-burst

Contoh broadcast custom text:

```bash
curl -X POST http://localhost:3010/api/v1/broadcasts \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <api_key>' \
  -d '{
    "sessionId":"<session-id>",
    "name":"promo-ramadhan",
    "text":"Halo {{name}}, ada promo hari ini.",
    "delayMs":1500,
    "recipients":[
      {"to":"628111111111","variables":{"name":"Budi"}},
      {"to":"628222222222","variables":{"name":"Sinta"}}
    ]
  }'
```

Contoh report:

```bash
curl http://localhost:3010/api/v1/broadcasts/<broadcast-id>/report \
  -H 'x-api-key: <api_key>'
```

Response report berisi:

- `total`
- `sent`
- `failed`
- `pending`

### Webhooks

Endpoints:

- `POST /api/v1/webhooks`
- `GET /api/v1/webhooks`
- `DELETE /api/v1/webhooks/{id}`

Supported events:

- `message.received`
- `message.sent`
- `message.delivered`
- `message.read`
- `session.connected`
- `session.disconnected`

Contoh create webhook:

```bash
curl -X POST http://localhost:3010/api/v1/webhooks \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{
    "url":"https://example.com/webhooks/wa",
    "events":["message.received","message.sent","session.connected"]
  }'
```

Webhook payload:

```json
{
  "type": "message.sent",
  "sessionId": "session-uuid",
  "userId": "user-uuid",
  "occurredAt": "2026-03-13T00:00:00.000Z",
  "payload": {
    "messageId": "message-uuid",
    "to": "628123456789",
    "providerMessageId": "wamid.xxx"
  }
}
```

Behavior:

- retry maksimal 3x
- delivery status dicatat ke database

### Groups

- `GET /api/v1/sessions/{id}/groups`
- `GET /api/v1/sessions/{id}/groups/{groupId}/members`

## WebSocket

Endpoint:

```text
ws://localhost:3010/ws
```

Contoh:

```js
const ws = new WebSocket("ws://localhost:3010/ws");

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: "subscribe",
      sessionId: "<session-id>",
    }),
  );
};

ws.onmessage = (event) => {
  console.log(JSON.parse(event.data));
};
```

## Status dan Ownership

Rules:

- user hanya bisa akses session miliknya sendiri
- template, broadcast, webhook, dan API key terikat ke `user_id`
- API key hanya bisa mengakses resource milik owner key tersebut

Session status:

- `connected`
- `connecting`
- `disconnected`
- `banned`

Message status:

- `queued`
- `sent`
- `delivered`
- `read`
- `failed`

## Notes Compatibility

Endpoint lama berikut tetap ada:

- `GET /api/v1/sessions`
- `POST /api/v1/sessions`
- `POST /api/v1/sessions/{session_id}/connect`
- `GET /api/v1/sessions/{session_id}/status`
- `POST /api/v1/sessions/{session_id}/messages/text`

Selain itu, `POST /api/v1/sessions/{id}/messages/media` juga tetap dipertahankan untuk backward compatibility.

## Production Notes

- simpan `SQLITE_PATH` di persistent volume
- pasang reverse proxy untuk TLS
- gunakan `JWT_SECRET` yang kuat
- rotate API key secara berkala
- gunakan webhook endpoint yang idempotent
- limit akses by IP untuk API key produksi
- untuk scale-out, upgrade queue ke Redis + worker terpisah
- monitor tabel `logs`, `messages`, dan `webhook_deliveries`

## Build Verification

Perubahan saat ini sudah lolos:

```bash
bunx tsc --noEmit
bun run build
```

---

## ☕ Dukung Project Ini

Jika project WhatsApp Gateway ini bermanfaat untuk Anda,  
Anda bisa mendukung pengembang dengan mentraktir kopi 🙌

Dukungan Anda sangat berarti untuk pengembangan dan maintenance project ini.

### 💳 Donasi via QRIS

Silakan scan QRIS berikut:

![QRIS Donasi](./img/qris.png)

<p align="center">
  <strong>Ach Luthfi Imron Juhari</strong><br/>
  Terima kasih atas dukungannya ❤️
</p>

---
