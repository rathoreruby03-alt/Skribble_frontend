import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  const [maxPlayers, setMaxPlayers] = useState(8);
  const [rounds, setRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(60);

  const [wordCount, setWordCount] = useState(3);
  const [hints, setHints] = useState(3);
  const [privateRoom, setPrivateRoom] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);

  const createRoom = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    const playerId = crypto.randomUUID();

    try {
      const response = await axios.post("http://localhost:8080/api/rooms", {
        hostId: playerId,
        hostName: name,
        maxPlayers: maxPlayers,
        rounds: rounds,
        drawTime: drawTime,
        wordCount: wordCount,
        hints: hints,
        privateRoom: privateRoom,
      });

      console.log("Room created:", response.data);

      // Save HOST information
      sessionStorage.setItem("playerId", playerId);
      sessionStorage.setItem("playerName", name);
      sessionStorage.setItem("roomId", response.data.roomId);
      sessionStorage.setItem("isHost", "true");

      // Check what was actually saved
      console.log("Host ID:", sessionStorage.getItem("playerId"));
      console.log("Host Name:", sessionStorage.getItem("playerName"));
      console.log("Is Host:", sessionStorage.getItem("isHost"));

      alert("Room created! Room ID: " + response.data.roomId);

      // Go to lobby
      navigate("/lobby");
    } catch (error) {
      console.error("Create room error:", error);
      alert("Failed to create room");
    }
  };

  const loadPublicRooms = async () => {
    try {
      const response = await axios.get("http://localhost:8080/api/rooms/public");
      setPublicRooms(response.data);
    } catch (error) {
      console.error("PUBLIC ROOMS ERROR:", error);
    }
  };

  const joinRoom = async (overrideRoomId) => {
    const targetRoomId = typeof overrideRoomId === "string" ? overrideRoomId : roomId;

    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!targetRoomId.trim()) {
      alert("Please enter room ID");
      return;
    }

    const playerId = crypto.randomUUID();

    try {
      const response = await axios.post(
        `http://localhost:8080/api/rooms/${targetRoomId}/join`,
        {
          playerId: playerId,
          playerName: name,
        }
      );

      console.log("Joined room:", response.data);

      // Save player information
      sessionStorage.setItem("playerId", playerId);
      sessionStorage.setItem("playerName", name);
      sessionStorage.setItem("roomId", targetRoomId);
      sessionStorage.setItem("isHost", "false");

      console.log("Player ID:", sessionStorage.getItem("playerId"));
      console.log("Player Name:", sessionStorage.getItem("playerName"));
      console.log("Is Host:", sessionStorage.getItem("isHost"));

      alert("Joined room successfully!");

      // Go directly to lobby
      navigate("/lobby");
    } catch (error) {
      console.error("Join room error:", error);
      alert("Failed to join room");
    }
  };

  useEffect(() => {
    loadPublicRooms();
  }, []);

  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.title}>Skribbl Clone 🎨</h1>
          <p style={styles.subtitle}>Draw, guess, and have fun with friends!</p>
        </header>

        {/* Player Name Input */}
        <div style={styles.section}>
          <label style={styles.label}>Your Name</label>
          <input
            type="text"
            placeholder="Enter your name to start..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* Create Room Section */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>⚙️ Create Room Settings</h2>

          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Max Players</label>
              <input
                type="number"
                min="2"
                max="20"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Rounds</label>
              <input
                type="number"
                min="2"
                max="10"
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Draw Time (s)</label>
              <input
                type="number"
                min="15"
                max="240"
                value={drawTime}
                onChange={(e) => setDrawTime(Number(e.target.value))}
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Word Count</label>
              <input
                type="number"
                min="1"
                max="5"
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Hints</label>
              <input
                type="number"
                min="0"
                max="5"
                value={hints}
                onChange={(e) => setHints(Number(e.target.value))}
                style={styles.input}
              />
            </div>
          </div>

          <label style={styles.checkboxContainer}>
            <input
              type="checkbox"
              checked={privateRoom}
              onChange={(e) => setPrivateRoom(e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.checkboxLabel}>Make Room Private</span>
          </label>

          <button onClick={createRoom} style={styles.primaryButton}>
            Create & Host Room
          </button>
        </div>

        {/* Join Room Section */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>🔑 Join via Code</h2>
          <div style={styles.joinContainer}>
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={styles.input}
            />
            <button onClick={() => joinRoom(roomId)} style={styles.secondaryButton}>
              Join
            </button>
          </div>
        </div>

        {/* Public Rooms List Section */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>🌐 Public Rooms</h2>

          {publicRooms.length === 0 ? (
            <p style={styles.emptyText}>No public rooms available right now.</p>
          ) : (
            <div style={styles.roomsList}>
              {publicRooms.map((room) => (
                <div key={room.roomId} style={styles.roomCard}>
                  <div>
                    <div style={styles.roomIdText}>Room: {room.roomId}</div>
                    <div style={styles.roomDetails}>
                      <span>👥 {room.players?.length || 0}/{room.maxPlayers}</span>
                      <span>🔄 {room.rounds} Rounds</span>
                      <span>⏱️ {room.drawTime}s</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setRoomId(room.roomId);
                      joinRoom(room.roomId);
                    }}
                    style={styles.joinRoomButton}
                  >
                    Join Room
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline Styles Object
const styles = {
  pageContainer: {
    minHeight: "100vh",
    backgroundColor: "#f4f6f8",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  card: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxWidth: "550px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    textAlign: "center",
  },
  title: {
    margin: 0,
    fontSize: "2rem",
    color: "#2c3e50",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#7f8c8d",
    fontSize: "0.95rem",
  },
  sectionCard: {
    backgroundColor: "#f8fafc",
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontSize: "1.1rem",
    color: "#334155",
  },
  section: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: "600",
    color: "#475569",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
  },
  checkboxContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "16px",
    cursor: "pointer",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },
  checkboxLabel: {
    fontSize: "0.9rem",
    color: "#475569",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#6366f1",
    color: "#ffffff",
    border: "none",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondaryButton: {
    backgroundColor: "#0ea5e9",
    color: "#ffffff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "0.95rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  joinContainer: {
    display: "flex",
    gap: "10px",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: "0.9rem",
    margin: 0,
    textAlign: "center",
  },
  roomsList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  roomCard: {
    backgroundColor: "#ffffff",
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomIdText: {
    fontWeight: "600",
    color: "#1e293b",
    fontSize: "0.95rem",
  },
  roomDetails: {
    display: "flex",
    gap: "12px",
    fontSize: "0.8rem",
    color: "#64748b",
    marginTop: "4px",
  },
  joinRoomButton: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
  },
};

export default Home;