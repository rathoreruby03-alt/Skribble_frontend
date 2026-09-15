# 🎨 Skribbl Clone — Frontend

The frontend of a real-time multiplayer drawing and guessing game inspired by **Skribbl.io**.

Built with **React.js**, HTML5 Canvas, WebSockets/STOMP, Axios, JavaScript, and Bootstrap.

## 🌐 Live Application

**Live Frontend:** https://skribbl-frontend-sigma.vercel.app/

**Backend Repository:** https://github.com/rathoreruby03-alt/SkribblClone_backend

## ✨ Features

- Create a game room
- Join a room using a room code
- Public/private room support
- Lobby with player list
- Player ready/unready status
- Host-controlled game start
- Turn-based drawing
- Word choices for the drawer
- Real-time drawing synchronization
- Guessing and chat
- Correct-answer notifications
- Round timer
- Multiple rounds
- Automatic drawer rotation
- Score and leaderboard display
- Game-over and winner screen

### 🎨 Drawing Tools

- Brush
- Color selection
- Brush size
- Eraser
- Undo
- Clear canvas

## 🛠️ Tech Stack

- **React.js**
- **JavaScript (ES6+)**
- **HTML5**
- **CSS**
- **Bootstrap**
- **HTML5 Canvas**
- **Axios**
- **STOMP.js / WebSocket**
- **Vite**

## 🏗️ Frontend Architecture

```text
React Application
       │
       ├── Pages / Components
       │       │
       │       ├── Home
       │       ├── Lobby
       │       └── Game
       │
       ├── REST API
       │       │
       │       └── Spring Boot Backend
       │
       └── WebSocket / STOMP
               │
               └── Spring Boot WebSocket
```

The frontend communicates with the backend using:

- **REST APIs** for room-related operations
- **WebSockets** for real-time game communication

## 🔌 WebSocket Communication

The frontend connects to the backend WebSocket endpoint:

```text
wss://skribblclone-backend-f6ve.onrender.com/ws
```

Application messages use:

```text
/app/...
```

Room updates are received from topics such as:

```text
/topic/room/{roomId}
/topic/room/{roomId}/game
```

WebSockets are used for real-time:

- Drawing
- Guessing
- Chat
- Word selection
- Ready status
- Game state
- Scores
- Round changes
- Player actions

## 📂 Project Structure

```text
SkribblClone_frontend/
│
├── public/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── App.jsx
│   └── main.jsx
│
├── .env
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

> Folder names may vary slightly depending on the current project structure.

## ⚙️ Environment Variables

Create a `.env` file in the frontend root:

```env
VITE_API_URL=https://skribblclone-backend-f6ve.onrender.com
VITE_WS_URL=wss://skribblclone-backend-f6ve.onrender.com/ws
```

**Do not commit `.env` files containing private configuration or secrets to GitHub.**

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/rathoreruby03-alt/SkribblClone_frontend.git
cd SkribblClone_frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env`:

```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

### 4. Start the development server

```bash
npm run dev
```

The frontend will normally run at:

```text
http://localhost:5173
```

## 🧪 Testing Multiplayer

For multiplayer testing:

1. Open the application in one browser.
2. Create a room.
3. Open another browser/incognito window.
4. Join using the room code.
5. Make both players ready.
6. Start the game.
7. Select a word as the drawer.
8. Draw on the canvas.
9. Verify the drawing appears on the second player's screen.
10. Submit guesses and verify scoring.
11. Verify round transitions and leaderboard updates.

## 🚀 Deployment

The frontend is deployed using **Vercel**.

Production API configuration:

```env
VITE_API_URL=https://skribblclone-backend-f6ve.onrender.com
VITE_WS_URL=wss://skribblclone-backend-f6ve.onrender.com/ws
```

## 🔗 Related Repository

**Backend:** https://github.com/rathoreruby03-alt/SkribblClone_backend

## 👩‍💻 Author

**Ruby Rathore**

BCA | Full Stack Developer Fresher
