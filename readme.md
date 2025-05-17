
# 🟢 LiveKit Self-Hosted Setup (WSL + Docker + Token Backend)

This guide explains how to run [LiveKit](https://livekit.io/) locally using Docker inside WSL (Windows Subsystem for Linux), and connect your frontend app to it by generating secure tokens using a minimal backend.

---

## ✅ Requirements

- Windows 10/11 with [WSL2](https://learn.microsoft.com/en-us/windows/wsl/)
- Docker Desktop installed and running
- Node.js (for backend token generator)
- Any frontend framework (React, Vue, etc.)

---

## 🚀 Step 1: Set Up LiveKit Server (Docker + WSL)

1. Open WSL (Ubuntu).

2. Install Docker:
   ```bash
  sudo apt update
  sudo apt install docker.io docker-compose -y
  sudo systemctl enable docker
 

3. Create and enter project folder:
   ```bash
   mkdir ~/livekit-server && cd ~/livekit-server
   ```

4. Create `docker-compose.yml`:
   ```yaml
   version: '3'
   services:
     livekit:
       image: livekit/livekit-server:latest
       command:
         - --port=7880
         - --rtc.use_mdns=false
         - --rtc.port_range_start=5000
         - --rtc.port_range_end=6000
         - --keys.devkey=secret
       ports:
         - "7880:7880"
         - "7881:7881"
         - "5000-6000:5000-6000/udp"
   ```

5.  Create config.yaml: 
    
    port: 7880
rtc:
  use_mdns: false
  port_range_start: 5000
  port_range_end: 6000
  use_external_ip: false
  enable_stun: false
keys:
  devkey: secret



6. Start LiveKit:
   ```bash
   docker-compose up
   ```
7. Start LiveKit:
   ```bash
   docker-compose down
   ```
8. Docker status:
   ```bash
   docker ps
   ```


9. Visit http://localhost:7880 — You should see `OK`.

10. Permission issues to open vs code 
```bash
 sudo chown -R $(whoami):$(whoami) . 
 chmod -R u+rw .
```

---

## 🧠 Step 2: Create Token Generator Backend

You must never expose your `LIVEKIT_API_SECRET` in the frontend. Instead, create a backend endpoint that issues a JWT token.

### 1. Create backend project:

```bash
mkdir ~/livekit-token-server && cd ~/livekit-token-server
npm init -y
npm install express cors livekit-server-sdk
```

### 2. Create `server.js`:

```js
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());

const API_KEY = 'devkey';
const API_SECRET = 'secret';
const LIVEKIT_URL = 'ws://localhost:7880';

app.get('/token', (req, res) => {
  const { identity = 'user', room = 'testroom' } = req.query;

  const token = new AccessToken(API_KEY, API_SECRET, {
    identity,
  });

  token.addGrant({ roomJoin: true, room });

  res.json({
    token: token.toJwt(),
    url: LIVEKIT_URL,
  });
});

app.listen(3001, () => {
  console.log('LiveKit token server running at http://localhost:3001');
});
```

### 3. Start server:

```bash
node server.js
```

---

## 💻 Step 3: Connect Frontend to LiveKit

### In your frontend code:

1. Fetch token:
```js
const res = await fetch('http://localhost:3001/token?identity=myUser');
const { token, url } = await res.json();
```

2. Connect to LiveKit:
```js
import { connect } from 'livekit-client';

const room = await connect(url, token, {
  // your options
});
```

---

## 📄 .env (if using React)

If you still want to use `.env` for the base URL of the token service:

```
REACT_APP_TOKEN_SERVER=http://localhost:3001
```

In code:
```js
const server = process.env.REACT_APP_TOKEN_SERVER;
const res = await fetch(`${server}/token?identity=abc`);
```

---

## 🧪 Test It

- Start LiveKit server:
  ```bash
  cd ~/livekit-server
  docker compose up
  ```

- Start token backend:
  ```bash
  cd ~/livekit-token-server
  node server.js
  ```

- Start your frontend and connect to a room!

---

## 🛡 Security Tip

For production, always:

- Use HTTPS (`wss://yourdomain.com`)
- Generate tokens server-side
- Never expose `LIVEKIT_API_SECRET` to the frontend

---

## 🧾 Credits

- [LiveKit Docs](https://docs.livekit.io)
- LiveKit Server Docker: [GitHub](https://github.com/livekit/livekit)
