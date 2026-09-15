import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Client } from "@stomp/stompjs";
const API_URL = import.meta.env.VITE_API_URL;

function Lobby() {
    const navigate = useNavigate();

    const [room, setRoom] = useState(null);
    const [client, setClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const roomId = sessionStorage.getItem("roomId");
    const playerId = sessionStorage.getItem("playerId");

    const isHost = room?.hostId === playerId;

    const isReady =
        room?.players?.find(
            (player) => player.id === playerId
        )?.ready || false;

    useEffect(() => {
        if (!roomId) {
            navigate("/");
            return;
        }

        loadRoom();

        const stompClient = new Client({
            brokerURL: import.meta.env.VITE_WS_URL,
            reconnectDelay: 5000,

            onConnect: () => {
                console.log("WebSocket connected to lobby");
                setIsConnected(true);

                stompClient.subscribe(`/topic/room/${roomId}`, (message) => {
                    const updatedRoom = JSON.parse(message.body);
                    console.log("Room updated:", updatedRoom);
                    setRoom(updatedRoom);
                });

                stompClient.subscribe(`/topic/room/${roomId}/game`, (message) => {
                    const gameData = JSON.parse(message.body);
                    console.log("Game update:", gameData);

                    if (gameData.gameStatus === "PLAYING") {
                        navigate("/game");
                    }
                });
            },

            onStompError: (frame) => {
                console.error("STOMP error:", frame);
                setIsConnected(false);
            },

            onWebSocketError: (error) => {
                console.error("WebSocket error:", error);
                setIsConnected(false);
            },

            onWebSocketClose: () => {
                console.log("WebSocket disconnected");
                setIsConnected(false);
            },
        });

        stompClient.activate();
        setClient(stompClient);

        return () => {
            stompClient.deactivate();
        };
    }, [roomId, navigate]);

    const loadRoom = async () => {
        try {
            const response = await axios.get(
                `${API_URL}/api/rooms/${roomId}`
            );
            console.log("ROOM FROM API:", response.data);
            setRoom(response.data);
        } catch (error) {
            console.error("ROOM LOAD ERROR:", error);
        }
    };

    const startGame = () => {
        if (!client || !client.connected) {
            alert("WebSocket is not connected. Please wait a moment.");
            return;
        }

        if (room.players.length < 2) {
            alert("At least 2 players are required.");
            return;
        }

        const allReady = room.players.every((player) => player.ready);

        if (!allReady) {
            alert("All players must be ready before starting.");
            return;
        }

        client.publish({
            destination: "/app/game/start",
            body: JSON.stringify({
                roomId: roomId,
                hostId: playerId,
            }),
        });

        console.log("Start game request sent");
    };

    const toggleReady = () => {
        if (!client || !client.connected) {
            alert("WebSocket is not connected. Please wait a moment.");
            return;
        }

        const currentPlayer = room?.players?.find(
            (player) => player.id === playerId
        );

        if (!currentPlayer) {
            alert("Player not found in this room. Please rejoin the room.");
            return;
        }

        const newReadyState = !currentPlayer.ready;

        client.publish({
            destination: "/app/game/ready",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
                ready: newReadyState,
            }),
        });

        console.log("Ready request:", {
            playerId,
            ready: newReadyState,
        });
    };

    const leaveRoom = () => {
        if (!client || !client.connected) {
            alert("WebSocket is not connected. Please wait a moment.");
            return;
        }

        client.publish({
            destination: "/app/game/leave",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
            }),
        });

        console.log("Leave room request sent");

        // Clear room information
        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("isHost");
        sessionStorage.removeItem("playerId");
        sessionStorage.removeItem("playerName");

        // Go back to home
        navigate("/");
    };

    if (!room) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.loadingCard}>
                    <div style={styles.spinner}></div>
                    <h2 style={{ color: "#1e293b", margin: "16px 0 8px 0" }}>
                        Loading lobby...
                    </h2>
                    <p style={{ color: "#64748b", margin: 0 }}>
                        Connecting to room <strong>{roomId}</strong>
                    </p>
                </div>
            </div>
        );
    }

    const isStartDisabled =
        room.players.length < 2 || !room.players.every((player) => player.ready);

    return (
        <div style={styles.pageContainer}>
            <div style={styles.card}>
                {/* Header Section */}
                <header style={styles.header}>
                    <h1 style={styles.title}>🎨 Skribbl Lobby</h1>
                    <div style={styles.roomBadge}>
                        <span style={styles.roomBadgeLabel}>ROOM CODE</span>
                        <span style={styles.roomBadgeValue}>{room?.roomId}</span>
                    </div>
                </header>

                {/* Room Info Bar */}
                <div style={styles.infoBar}>
                    <div style={styles.infoItem}>
                        <span style={styles.infoIcon}>👥</span>
                        <span>
                            <strong>{room?.players?.length || 0}</strong> / {room?.maxPlayers || 0} Players
                        </span>
                    </div>
                    <div style={styles.infoItem}>
                        <span style={styles.infoIcon}>🔄</span>
                        <span>{room?.rounds} Rounds</span>
                    </div>
                    <div style={styles.infoItem}>
                        <span style={styles.infoIcon}>⏱️</span>
                        <span>{room?.drawTime}s Draw Time</span>
                    </div>
                </div>

                {/* Players List Section */}
                <div style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h2 style={styles.sectionTitle}>Players in Lobby</h2>
                        <span style={styles.playerCountPill}>
                            {room.players.length} Joined
                        </span>
                    </div>

                    <div style={styles.playersList}>
                        {room.players.map((player) => (
                            <div
                                key={player.id}
                                style={{
                                    ...styles.playerCard,
                                    ...(player.id === playerId ? styles.currentPlayerCard : {}),
                                }}
                            >
                                <div style={styles.playerInfo}>
                                    <span style={styles.avatarIcon}>👤</span>
                                    <span style={styles.playerName}>{player.name}</span>
                                    {player.id === room.hostId && (
                                        <span style={styles.hostTag}>👑 Host</span>
                                    )}
                                    {player.id === playerId && (
                                        <span style={styles.youTag}>You</span>
                                    )}
                                </div>

                                <div style={styles.playerStatusContainer}>
                                    <span
                                        style={{
                                            ...styles.statusBadge,
                                            backgroundColor: player.ready ? "#dcfce7" : "#f1f5f9",
                                            color: player.ready ? "#15803d" : "#64748b",
                                        }}
                                    >
                                        {player.ready ? "🟢 Ready" : "⚪ Not Ready"}
                                    </span>
                                    <span style={styles.scoreBadge}>⭐ {player.score}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Controls Section */}
                <div style={styles.actionsContainer}>
                    <div style={styles.buttonGroup}>
                        <button
                            onClick={toggleReady}
                            style={{
                                ...styles.button,
                                ...(room.players.find((player) => player.id === playerId)?.ready
                                    ? styles.notReadyButton
                                    : styles.readyButton),
                            }}
                        >
                            {room.players.find((player) => player.id === playerId)?.ready
                                ? "❌ Set Not Ready"
                                : "✅ I'm Ready!"}
                        </button>

                        {isHost && (
                            <button
                                onClick={startGame}
                                disabled={isStartDisabled}
                                style={{
                                    ...styles.button,
                                    ...styles.startButton,
                                    ...(isStartDisabled ? styles.disabledButton : {}),
                                }}
                            >
                                🚀 Start Game
                            </button>
                        )}
                    </div>

                    {!isHost && (
                        <div style={styles.noticeBanner}>
                            ⏳ Waiting for the host to start the game...
                        </div>
                    )}

                    {isHost && room.players.length < 2 && (
                        <div style={styles.warningBanner}>
                            ⚠️ At least 2 players are required to start the game.
                        </div>
                    )}

                    <button onClick={leaveRoom} style={styles.leaveButton}>
                        🚪 Leave Room
                    </button>
                </div>
            </div>
        </div>
    );
}

// Inline CSS-in-JS Styles Object
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
    loadingContainer: {
        minHeight: "100vh",
        backgroundColor: "#f4f6f8",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
    },
    loadingCard: {
        backgroundColor: "#ffffff",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
        textAlign: "center",
        maxWidth: "400px",
        width: "100%",
    },
    card: {
        backgroundColor: "#ffffff",
        width: "100%",
        maxWidth: "650px",
        borderRadius: "16px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
    },
    title: {
        margin: 0,
        fontSize: "1.8rem",
        color: "#2c3e50",
    },
    roomBadge: {
        backgroundColor: "#eef2ff",
        border: "1px solid #c7d2fe",
        borderRadius: "10px",
        padding: "6px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },
    roomBadgeLabel: {
        fontSize: "0.65rem",
        fontWeight: "700",
        color: "#4f46e5",
        letterSpacing: "0.5px",
    },
    roomBadgeValue: {
        fontSize: "1.1rem",
        fontWeight: "800",
        color: "#312e81",
    },
    infoBar: {
        display: "flex",
        justifyContent: "space-around",
        backgroundColor: "#f8fafc",
        padding: "12px",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        fontSize: "0.9rem",
        color: "#475569",
    },
    infoItem: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    infoIcon: {
        fontSize: "1rem",
    },
    sectionCard: {
        backgroundColor: "#ffffff",
    },
    sectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "12px",
    },
    sectionTitle: {
        margin: 0,
        fontSize: "1.1rem",
        color: "#334155",
    },
    playerCountPill: {
        backgroundColor: "#e2e8f0",
        color: "#475569",
        padding: "2px 10px",
        borderRadius: "12px",
        fontSize: "0.8rem",
        fontWeight: "600",
    },
    playersList: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    playerCard: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        transition: "all 0.2s ease",
    },
    currentPlayerCard: {
        borderColor: "#a5b4fc",
        backgroundColor: "#f5f3ff",
    },
    playerInfo: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    avatarIcon: {
        fontSize: "1.1rem",
    },
    playerName: {
        fontWeight: "600",
        color: "#1e293b",
        fontSize: "0.95rem",
    },
    hostTag: {
        backgroundColor: "#fef3c7",
        color: "#92400e",
        fontSize: "0.75rem",
        fontWeight: "700",
        padding: "2px 8px",
        borderRadius: "6px",
        border: "1px solid #fde68a",
    },
    youTag: {
        backgroundColor: "#e0e7ff",
        color: "#3730a3",
        fontSize: "0.75rem",
        fontWeight: "700",
        padding: "2px 8px",
        borderRadius: "6px",
    },
    playerStatusContainer: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    statusBadge: {
        fontSize: "0.8rem",
        fontWeight: "600",
        padding: "4px 10px",
        borderRadius: "12px",
    },
    scoreBadge: {
        fontSize: "0.85rem",
        fontWeight: "600",
        color: "#64748b",
    },
    actionsContainer: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginTop: "8px",
    },
    buttonGroup: {
        display: "flex",
        gap: "12px",
    },
    button: {
        flex: 1,
        padding: "12px 20px",
        borderRadius: "8px",
        fontSize: "1rem",
        fontWeight: "600",
        border: "none",
        cursor: "pointer",
        transition: "opacity 0.2s ease",
    },
    readyButton: {
        backgroundColor: "#10b981",
        color: "#ffffff",
    },
    notReadyButton: {
        backgroundColor: "#f59e0b",
        color: "#ffffff",
    },
    startButton: {
        backgroundColor: "#6366f1",
        color: "#ffffff",
    },
    disabledButton: {
        backgroundColor: "#cbd5e1",
        color: "#94a3b8",
        cursor: "not-allowed",
    },
    leaveButton: {
        width: "100%",
        padding: "10px",
        backgroundColor: "transparent",
        color: "#ef4444",
        border: "1px solid #fca5a5",
        borderRadius: "8px",
        fontSize: "0.95rem",
        fontWeight: "600",
        cursor: "pointer",
    },
    noticeBanner: {
        backgroundColor: "#eff6ff",
        color: "#1e40af",
        border: "1px solid #bfdbfe",
        padding: "10px",
        borderRadius: "8px",
        fontSize: "0.9rem",
        textAlign: "center",
    },
    warningBanner: {
        backgroundColor: "#fffbebf",
        color: "#b45309",
        border: "1px solid #fde68a",
        padding: "10px",
        borderRadius: "8px",
        fontSize: "0.9rem",
        textAlign: "center",
    },
};

export default Lobby;