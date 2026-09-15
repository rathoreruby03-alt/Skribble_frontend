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

    // =========================================================
    // LOAD ROOM
    // =========================================================
    const loadRoom = async () => {
        if (!roomId) {
            navigate("/");
            return;
        }

        try {
            const response = await axios.get(
                `${API_URL}/api/rooms/${roomId}`
            );

            console.log("ROOM FROM API:", response.data);

            setRoom(response.data);

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
    // WEBSOCKET
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
                console.log("================================");
                console.log("WEBSOCKET CONNECTED");
                console.log("Room ID:", roomId);
                console.log("================================");

                setIsConnected(true);

                // =================================================
                // ROOM UPDATES
                // =================================================
                stompClient.subscribe(
                    `/topic/room/${roomId}`,
                    (message) => {

                        try {
                            const updatedRoom =
                                JSON.parse(message.body);

                            console.log(
                                "========== ROOM UPDATE =========="
                            );

                            console.log(
                                "Room:",
                                updatedRoom
                            );

                            console.log(
                                "Room Code:",
                                updatedRoom.roomCode
                            );

                            console.log(
                                "Host ID:",
                                updatedRoom.hostId
                            );

                            console.log(
                                "Players:",
                                updatedRoom.players
                            );

                            console.log(
                                "Ready Status:",
                                updatedRoom.players?.map(
                                    (player) => ({
                                        name: player.name,
                                        id: player.id,
                                        ready: player.ready
                                    })
                                )
                            );

                            console.log(
                                "================================="
                            );

                            setRoom(updatedRoom);

                            // If game has started
                            if (
                                updatedRoom.game &&
                                updatedRoom.game.gameStatus ===
                                    "PLAYING"
                            ) {
                                console.log(
                                    "GAME STARTED -> /game"
                                );

                                navigate("/game");
                            }

                        } catch (error) {
                            console.error(
                                "ROOM UPDATE PARSE ERROR:",
                                error
                            );
                        }
                    }
                );

                // =================================================
                // GAME UPDATES
                // =================================================
                stompClient.subscribe(
                    `/topic/room/${roomId}/game`,
                    (message) => {

                        try {
                            const gameData =
                                JSON.parse(message.body);

                            console.log(
                                "GAME UPDATE:",
                                gameData
                            );

                            if (
                                gameData.gameStatus ===
                                "PLAYING"
                            ) {
                                navigate("/game");
                            }

                        } catch (error) {
                            console.error(
                                "GAME UPDATE PARSE ERROR:",
                                error
                            );
                        }
                    }
                );
            },

            onStompError: (frame) => {
                console.error(
                    "STOMP ERROR:",
                    frame
                );

                setIsConnected(false);
            },

            onWebSocketError: (error) => {
                console.error(
                    "WEBSOCKET ERROR:",
                    error
                );

                setIsConnected(false);
            },

            onWebSocketClose: () => {
                console.log(
                    "WEBSOCKET DISCONNECTED"
                );

                setIsConnected(false);
            }
        });

        stompClient.activate();

        setClient(stompClient);

        return () => {
            console.log(
                "CLOSING LOBBY WEBSOCKET"
            );

            setIsConnected(false);

            stompClient.deactivate();
        };

    }, [roomId, navigate]);

    // =========================================================
    // CURRENT PLAYER
    // =========================================================
    const currentPlayer = room?.players?.find(
        (player) => player.id === playerId
    );

    // =========================================================
    // HOST CHECK
    // =========================================================
    const isHost =
        room?.hostId === playerId;

    // =========================================================
    // ALL READY CHECK
    // =========================================================
    const allReady =
        room?.players?.length >= 2 &&
        room.players.every(
            (player) => player.ready === true
        );

    // =========================================================
    // READY / NOT READY
    // =========================================================
    const toggleReady = () => {

        console.log(
            "========== READY CLICK =========="
        );

        console.log(
            "Connected:",
            isConnected
        );

        console.log(
            "Client:",
            client
        );

        console.log(
            "Room:",
            room
        );

        console.log(
            "Player ID:",
            playerId
        );

        if (!client) {
            alert(
                "WebSocket client is not ready. Please wait."
            );
            return;
        }

        if (!isConnected) {
            alert(
                "WebSocket is still connecting. Please wait a moment."
            );
            return;
        }

        if (!currentPlayer) {
            alert(
                "Your player was not found in this room."
            );
            return;
        }

        const newReadyStatus =
            !currentPlayer.ready;

        console.log(
            "Sending READY:",
            {
                roomId,
                playerId,
                ready: newReadyStatus
            }
        );

        client.publish({
            destination: "/app/game/ready",

            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
                ready: newReadyStatus
            })
        });

        console.log(
            "READY MESSAGE SENT"
        );
    };

    // =========================================================
    // START GAME
    // =========================================================
    const startGame = () => {

        console.log(
            "========== START GAME CLICK =========="
        );

        console.log(
            "Connected:",
            isConnected
        );

        console.log(
            "Room:",
            room
        );

        console.log(
            "Player ID:",
            playerId
        );

        console.log(
            "Host ID:",
            room?.hostId
        );

        console.log(
            "Players:",
            room?.players
        );

        // -----------------------------------------------------
        // WEBSOCKET
        // -----------------------------------------------------
        if (!client || !isConnected) {
            alert(
                "WebSocket is not connected. Please wait."
            );
            return;
        }

        // -----------------------------------------------------
        // HOST
        // -----------------------------------------------------
        if (!isHost) {
            alert(
                "Only the host can start the game."
            );
            return;
        }

        // -----------------------------------------------------
        // PLAYER COUNT
        // -----------------------------------------------------
        if (
            !room?.players ||
            room.players.length < 2
        ) {
            alert(
                "At least 2 players are required."
            );
            return;
        }

        // -----------------------------------------------------
        // READY CHECK
        // -----------------------------------------------------
        const readyPlayers =
            room.players.filter(
                (player) => player.ready === true
            ).length;

        console.log(
            "Ready players:",
            readyPlayers
        );

        console.log(
            "Total players:",
            room.players.length
        );

        if (!allReady) {
            alert(
                "All players must be ready before starting the game."
            );
            return;
        }

        // -----------------------------------------------------
        // SEND START GAME
        // -----------------------------------------------------
        console.log(
            "SENDING START GAME REQUEST"
        );

        client.publish({
            destination: "/app/game/start",

            body: JSON.stringify({
                roomId: roomId,
                hostId: playerId
            })
        });

        console.log(
            "START GAME MESSAGE SENT"
        );
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

            console.log(
                "LEAVE ROOM MESSAGE SENT"
            );
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

                <h2
                    style={{
                        color: "#4F46E5"
                    }}
                >
                    Loading lobby...
                </h2>

                <p
                    style={{
                        color: "#6B7280"
                    }}
                >
                    Connecting to game server...
                </p>

            </div>
        );
    }

    // =========================================================
    // MAIN UI
    // =========================================================
    return (
        <div style={styles.page}>

            <div style={styles.container}>

                {/* ================================================= */}
                {/* HEADER */}
                {/* ================================================= */}

                <div style={styles.header}>

                    <div>

                        <h1 style={styles.title}>
                            🎨 Skribbl Lobby
                        </h1>

                        {/* ROOM CODE */}
                        <div
                            style={{
                                marginTop: "8px",
                                fontSize: "1.1rem"
                            }}
                        >
                            Room Code:{" "}

                            <strong
                                style={{
                                    color: "#4F46E5",
                                    fontSize: "1.25rem",
                                    letterSpacing: "2px"
                                }}
                            >
                                {room.roomCode || roomId}
                            </strong>
                        </div>

                    </div>

                    {/* CONNECTION STATUS */}

                    <div
                        style={{
                            ...styles.connectionStatus,

                            backgroundColor:
                                isConnected
                                    ? "#DCFCE7"
                                    : "#FEF3C7",

                            color:
                                isConnected
                                    ? "#166534"
                                    : "#92400E"
                        }}
                    >
                        {isConnected
                            ? "🟢 Connected"
                            : "🟡 Connecting..."}
                    </div>

                </div>

                {/* ================================================= */}
                {/* GAME SETTINGS */}
                {/* ================================================= */}

                <div style={styles.card}>

                    <h2 style={styles.cardTitle}>
                        🎮 Game Settings
                    </h2>

                    <div style={styles.settingsGrid}>

                        <div style={styles.settingItem}>
                            <span>Players</span>

                            <strong>
                                {room.players?.length || 0}
                                {" / "}
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

                {/* ================================================= */}
                {/* PLAYERS */}
                {/* ================================================= */}

                <div style={styles.card}>

                    <h2 style={styles.cardTitle}>
                        👥 Players
                    </h2>

                    <div style={styles.playerList}>

                        {room.players?.map(
                            (player) => {

                                const playerIsHost =
                                    player.id ===
                                    room.hostId;

                                const playerIsCurrent =
                                    player.id ===
                                    playerId;

                                return (
                                    <div
                                        key={player.id}
                                        style={
                                            styles.playerRow
                                        }
                                    >

                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px"
                                            }}
                                        >

                                            <div
                                                style={
                                                    styles.avatar
                                                }
                                            >
                                                {player.name
                                                    ?.charAt(0)
                                                    ?.toUpperCase()}
                                            </div>

                                            <div>

                                                <div
                                                    style={{
                                                        fontWeight:
                                                            "700"
                                                    }}
                                                >
                                                    {player.name}

                                                    {playerIsCurrent && (
                                                        <span
                                                            style={{
                                                                marginLeft:
                                                                    "8px",
                                                                color:
                                                                    "#4F46E5",
                                                                fontSize:
                                                                    "0.8rem"
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
                            }
                        )}

                    </div>

                </div>

                {/* ================================================= */}
                {/* ACTION AREA */}
                {/* ================================================= */}

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
                            gap: "10px",
                            flexWrap: "wrap"
                        }}
                    >

                        {/* READY */}

                        <button
                            onClick={toggleReady}
                            disabled={!isConnected}
                            style={{
                                ...styles.readyButton,

                                opacity:
                                    !isConnected
                                        ? 0.5
                                        : 1,

                                cursor:
                                    !isConnected
                                        ? "not-allowed"
                                        : "pointer"
                            }}
                        >
                            {currentPlayer?.ready
                                ? "❌ Not Ready"
                                : "✅ I'm Ready"}
                        </button>

                        {/* START */}

                        {isHost && (
                            <button
                                onClick={startGame}
                                disabled={!isConnected}
                                style={{
                                    ...styles.startButton,

                                    opacity:
                                        !isConnected
                                            ? 0.5
                                            : 1,

                                    cursor:
                                        !isConnected
                                            ? "not-allowed"
                                            : "pointer"
                                }}
                            >
                                🚀 Start Game
                            </button>
                        )}

                    </div>

                </div>

                {/* ================================================= */}
                {/* STATUS */}
                {/* ================================================= */}

                <div style={styles.statusCard}>

                    <strong>
                        {
                            room.players?.filter(
                                (player) =>
                                    player.ready
                            ).length || 0
                        }

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

                {/* ================================================= */}
                {/* LEAVE */}
                {/* ================================================= */}

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

// =============================================================
// STYLES
// =============================================================

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