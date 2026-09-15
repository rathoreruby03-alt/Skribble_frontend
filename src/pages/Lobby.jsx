import { useEffect, useState } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_WS_URL;

function Lobby() {
    const navigate = useNavigate();

    const [room, setRoom] = useState(null);
    const [client, setClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);

    const roomId = sessionStorage.getItem("roomId");
    const playerId = sessionStorage.getItem("playerId");
    const playerName = sessionStorage.getItem("playerName");

    // =========================================================
    // LOAD ROOM
    // =========================================================
    const loadRoom = async () => {
        try {
            const response = await axios.get(
                `${API_URL}/api/rooms/${roomId}`
            );

            console.log("ROOM FROM API:", response.data);

            setRoom(response.data);

            // If game already started, go directly to game
            if (response.data.game?.gameStatus === "PLAYING") {
                navigate("/game");
            }

        } catch (error) {
            console.error("LOAD ROOM ERROR:", error);
        } finally {
            setLoading(false);
        }
    };

    // =========================================================
    // WEBSOCKET CONNECTION
    // =========================================================
    useEffect(() => {
        if (!roomId) {
            navigate("/");
            return;
        }

        loadRoom();

        const stompClient = new Client({
            brokerURL: WS_URL,

            reconnectDelay: 5000,

            debug: (str) => {
                console.log("STOMP:", str);
            },

            onConnect: () => {
                console.log("WebSocket connected to lobby");

                setIsConnected(true);

                // -------------------------------------------------
                // ROOM UPDATES
                // -------------------------------------------------
                stompClient.subscribe(
                    `/topic/room/${roomId}`,
                    (message) => {
                        const updatedRoom = JSON.parse(message.body);

                        console.log("Room updated:", updatedRoom);

                        setRoom(updatedRoom);

                        // If game starts, move to game page
                        if (
                            updatedRoom.game &&
                            updatedRoom.game.gameStatus === "PLAYING"
                        ) {
                            console.log("Game started! Navigating to game...");
                            navigate("/game");
                        }
                    }
                );

                // -------------------------------------------------
                // GAME UPDATES
                // -------------------------------------------------
                stompClient.subscribe(
                    `/topic/room/${roomId}/game`,
                    (message) => {
                        const gameData = JSON.parse(message.body);

                        console.log("Game update:", gameData);

                        if (gameData.gameStatus === "PLAYING") {
                            navigate("/game");
                        }
                    }
                );
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
            }
        });

        stompClient.activate();

        setClient(stompClient);

        return () => {
            console.log("Closing lobby WebSocket");

            setIsConnected(false);

            stompClient.deactivate();
        };
    }, [roomId, navigate]);

    // =========================================================
    // TOGGLE READY
    // =========================================================
    const toggleReady = () => {
        console.log("READY BUTTON CLICKED");

        console.log("WebSocket client:", client);
        console.log("WebSocket connected:", isConnected);

        if (!client || !isConnected) {
            alert("WebSocket is not connected. Please wait.");
            return;
        }

        const currentPlayer = room?.players?.find(
            (player) => player.id === playerId
        );

        if (!currentPlayer) {
            console.error("Current player not found");

            return;
        }

        const newReadyStatus = !currentPlayer.ready;

        console.log("Ready request:", {
            roomId: roomId,
            playerId: playerId,
            ready: newReadyStatus
        });

        client.publish({
            destination: "/app/game/ready",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
                ready: newReadyStatus
            })
        });

        console.log("Ready request sent");
    };

    // =========================================================
    // START GAME
    // =========================================================
    const startGame = () => {
        console.log("================================");
        console.log("START GAME BUTTON CLICKED");
        console.log("================================");

        console.log("START GAME ROOM:", room);

        console.log(
            "PLAYERS READY:",
            room?.players?.map((player) => ({
                name: player.name,
                id: player.id,
                ready: player.ready
            }))
        );

        console.log("WebSocket client:", client);
        console.log("WebSocket connected:", isConnected);
        console.log("Current player ID:", playerId);
        console.log("Host ID:", room?.hostId);

        // -------------------------------------------------
        // CHECK WEBSOCKET
        // -------------------------------------------------
        if (!client || !isConnected) {
            alert("WebSocket is not connected. Please wait.");
            return;
        }

        // -------------------------------------------------
        // CHECK HOST
        // -------------------------------------------------
        if (room?.hostId !== playerId) {
            alert("Only the host can start the game.");
            return;
        }

        // -------------------------------------------------
        // CHECK PLAYER COUNT
        // -------------------------------------------------
        if (!room?.players || room.players.length < 2) {
            alert("At least 2 players are required.");
            return;
        }

        // -------------------------------------------------
        // CHECK READY STATUS
        // -------------------------------------------------
        const allReady = room.players.every(
            (player) => player.ready === true
        );

        console.log("All players ready:", allReady);

        if (!allReady) {
            alert("All players must be ready.");
            return;
        }

        // -------------------------------------------------
        // SEND START GAME REQUEST
        // -------------------------------------------------
        client.publish({
            destination: "/app/game/start",
            body: JSON.stringify({
                roomId: roomId,
                hostId: playerId
            })
        });

        console.log("Start game request sent");
    };

    // =========================================================
    // LEAVE ROOM
    // =========================================================
    const leaveRoom = () => {
        if (client && isConnected) {
            client.publish({
                destination: "/app/game/leave",
                body: JSON.stringify({
                    roomId: roomId,
                    playerId: playerId
                })
            });

            console.log("Leave room request sent");
        }

        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("isHost");
        sessionStorage.removeItem("playerId");
        sessionStorage.removeItem("playerName");

        navigate("/");
    };

    // =========================================================
    // LOADING
    // =========================================================
    if (loading || !room) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>

                <h2 style={{ color: "#4F46E5" }}>
                    Loading lobby...
                </h2>

                <p style={{ color: "#6B7280" }}>
                    Connecting to game server...
                </p>
            </div>
        );
    }

    // =========================================================
    // CURRENT PLAYER
    // =========================================================
    const currentPlayer = room.players?.find(
        (player) => player.id === playerId
    );

    const isHost = room.hostId === playerId;

    const allReady =
        room.players?.length >= 2 &&
        room.players.every((player) => player.ready === true);

    // =========================================================
    // MAIN UI
    // =========================================================
    return (
        <div style={styles.page}>
            <div style={styles.container}>

                {/* HEADER */}
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>
                            🎨 Skribbl Lobby
                        </h1>

                        <p style={styles.subtitle}>
                            Room Code:{" "}
                            <strong>{room.roomCode}</strong>
                        </p>
                    </div>

                    <div
                        style={{
                            ...styles.connectionStatus,
                            backgroundColor: isConnected
                                ? "#DCFCE7"
                                : "#FEE2E2",
                            color: isConnected
                                ? "#166534"
                                : "#991B1B"
                        }}
                    >
                        {isConnected
                            ? "🟢 Connected"
                            : "🔴 Connecting..."}
                    </div>
                </div>

                {/* ROOM INFORMATION */}
                <div style={styles.card}>

                    <h2 style={styles.cardTitle}>
                        🎮 Game Settings
                    </h2>

                    <div style={styles.settingsGrid}>

                        <div style={styles.settingItem}>
                            <span>Players</span>
                            <strong>
                                {room.players?.length || 0} /{" "}
                                {room.maxPlayers}
                            </strong>
                        </div>

                        <div style={styles.settingItem}>
                            <span>Rounds</span>
                            <strong>
                                {room.rounds}
                            </strong>
                        </div>

                        <div style={styles.settingItem}>
                            <span>Draw Time</span>
                            <strong>
                                {room.drawTime}s
                            </strong>
                        </div>

                        <div style={styles.settingItem}>
                            <span>Word Choices</span>
                            <strong>
                                {room.wordCount}
                            </strong>
                        </div>

                        <div style={styles.settingItem}>
                            <span>Hints</span>
                            <strong>
                                {room.hints}
                            </strong>
                        </div>

                    </div>
                </div>

                {/* PLAYERS */}
                <div style={styles.card}>

                    <h2 style={styles.cardTitle}>
                        👥 Players
                    </h2>

                    <div style={styles.playerList}>

                        {room.players?.map((player) => {

                            const playerIsHost =
                                player.id === room.hostId;

                            const playerIsCurrent =
                                player.id === playerId;

                            return (
                                <div
                                    key={player.id}
                                    style={styles.playerRow}
                                >

                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px"
                                        }}
                                    >

                                        <div style={styles.avatar}>
                                            {player.name
                                                ?.charAt(0)
                                                ?.toUpperCase()}
                                        </div>

                                        <div>

                                            <div
                                                style={{
                                                    fontWeight: "700"
                                                }}
                                            >
                                                {player.name}

                                                {playerIsCurrent && (
                                                    <span
                                                        style={{
                                                            marginLeft: "8px",
                                                            color: "#4F46E5",
                                                            fontSize: "0.8rem"
                                                        }}
                                                    >
                                                        You
                                                    </span>
                                                )}
                                            </div>

                                            {playerIsHost && (
                                                <span
                                                    style={
                                                        styles.hostTag
                                                    }
                                                >
                                                    👑 Host
                                                </span>
                                            )}

                                        </div>

                                    </div>

                                    <div>

                                        {player.ready ? (
                                            <span
                                                style={
                                                    styles.readyBadge
                                                }
                                            >
                                                ✓ Ready
                                            </span>
                                        ) : (
                                            <span
                                                style={
                                                    styles.waitingBadge
                                                }
                                            >
                                                Waiting
                                            </span>
                                        )}

                                    </div>

                                </div>
                            );
                        })}

                    </div>
                </div>

                {/* READY / START SECTION */}
                <div style={styles.actionCard}>

                    <div>

                        <h2 style={styles.cardTitle}>
                            {currentPlayer?.ready
                                ? "✅ You are Ready"
                                : "⏳ You are Not Ready"}
                        </h2>

                        <p
                            style={{
                                margin: "5px 0 0",
                                color: "#6B7280"
                            }}
                        >
                            {isHost
                                ? "Everyone must be ready before you start the game."
                                : "Click Ready when you are prepared to play."}
                        </p>

                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: "10px"
                        }}
                    >

                        {/* READY BUTTON */}
                        <button
                            onClick={toggleReady}
                            disabled={!isConnected}
                            style={{
                                ...styles.readyButton,
                                opacity: !isConnected ? 0.5 : 1,
                                cursor: !isConnected
                                    ? "not-allowed"
                                    : "pointer"
                            }}
                        >
                            {currentPlayer?.ready
                                ? "❌ Not Ready"
                                : "✅ I'm Ready"}
                        </button>

                        {/* START GAME */}
                        {isHost && (
                            <button
                                onClick={startGame}
                                disabled={!isConnected}
                                style={{
                                    ...styles.startButton,
                                    opacity: !isConnected ? 0.5 : 1,
                                    cursor: !isConnected
                                        ? "not-allowed"
                                        : "pointer"
                                }}
                            >
                                🚀 Start Game
                            </button>
                        )}

                    </div>

                </div>

                {/* STATUS */}
                <div style={styles.statusCard}>

                    <strong>
                        {room.players?.filter(
                            (player) => player.ready
                        ).length || 0}
                        {" / "}
                        {room.players?.length || 0}
                        {" players ready"}
                    </strong>

                    {isHost && (
                        <span>
                            {allReady
                                ? " 🎉 Everyone is ready! You can start."
                                : " ⏳ Waiting for everyone to be ready."}
                        </span>
                    )}

                </div>

                {/* LEAVE */}
                <button
                    onClick={leaveRoom}
                    style={styles.leaveButton}
                >
                    🚪 Leave Room
                </button>

            </div>
        </div>
    );
}

// =========================================================
// STYLES
// =========================================================

const styles = {

    page: {
        minHeight: "100vh",
        backgroundColor: "#F3F4F6",
        padding: "30px 20px",
        fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1F2937"
    },

    container: {
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "18px"
    },

    header: {
        backgroundColor: "#FFFFFF",
        padding: "20px 25px",
        borderRadius: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow:
            "0 4px 10px rgba(0,0,0,0.05)"
    },

    title: {
        margin: 0,
        fontSize: "1.8rem",
        fontWeight: "800",
        color: "#111827"
    },

    subtitle: {
        margin: "5px 0 0",
        color: "#6B7280"
    },

    connectionStatus: {
        padding: "8px 14px",
        borderRadius: "20px",
        fontSize: "0.85rem",
        fontWeight: "700"
    },

    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: "14px",
        padding: "20px",
        border: "1px solid #E5E7EB",
        boxShadow:
            "0 2px 5px rgba(0,0,0,0.03)"
    },

    cardTitle: {
        margin: "0 0 15px",
        fontSize: "1.1rem",
        fontWeight: "700"
    },

    settingsGrid: {
        display: "grid",
        gridTemplateColumns:
            "repeat(auto-fit, minmax(130px, 1fr))",
        gap: "12px"
    },

    settingItem: {
        backgroundColor: "#F9FAFB",
        padding: "12px",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        color: "#6B7280",
        fontSize: "0.85rem"
    },

    playerList: {
        display: "flex",
        flexDirection: "column",
        gap: "10px"
    },

    playerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px",
        backgroundColor: "#F9FAFB",
        borderRadius: "10px",
        border: "1px solid #F3F4F6"
    },

    avatar: {
        width: "38px",
        height: "38px",
        borderRadius: "50%",
        backgroundColor: "#EEF2FF",
        color: "#4F46E5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "800"
    },

    hostTag: {
        display: "inline-block",
        marginTop: "3px",
        fontSize: "0.7rem",
        backgroundColor: "#FEF3C7",
        color: "#D97706",
        padding: "2px 6px",
        borderRadius: "4px"
    },

    readyBadge: {
        backgroundColor: "#DCFCE7",
        color: "#166534",
        padding: "5px 10px",
        borderRadius: "15px",
        fontSize: "0.8rem",
        fontWeight: "700"
    },

    waitingBadge: {
        backgroundColor: "#F3F4F6",
        color: "#6B7280",
        padding: "5px 10px",
        borderRadius: "15px",
        fontSize: "0.8rem",
        fontWeight: "600"
    },

    actionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: "14px",
        padding: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
        border: "1px solid #E5E7EB",
        boxShadow:
            "0 4px 8px rgba(0,0,0,0.04)"
    },

    readyButton: {
        backgroundColor: "#22C55E",
        color: "#FFFFFF",
        border: "none",
        padding: "11px 18px",
        borderRadius: "9px",
        fontWeight: "700"
    },

    startButton: {
        backgroundColor: "#4F46E5",
        color: "#FFFFFF",
        border: "none",
        padding: "11px 18px",
        borderRadius: "9px",
        fontWeight: "700"
    },

    statusCard: {
        backgroundColor: "#EEF2FF",
        color: "#3730A3",
        padding: "14px 18px",
        borderRadius: "10px",
        display: "flex",
        justifyContent: "center",
        gap: "5px",
        flexWrap: "wrap",
        textAlign: "center"
    },

    leaveButton: {
        backgroundColor: "#EF4444",
        color: "#FFFFFF",
        border: "none",
        padding: "11px 20px",
        borderRadius: "9px",
        fontWeight: "700",
        cursor: "pointer",
        alignSelf: "center"
    },

    loadingContainer: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6"
    },

    spinner: {
        width: "40px",
        height: "40px",
        border: "4px solid #E5E7EB",
        borderTop: "4px solid #4F46E5",
        borderRadius: "50%",
        marginBottom: "15px"
    }
};

export default Lobby;