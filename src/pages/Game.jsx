import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import { useNavigate } from "react-router-dom";
const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_WS_URL;

function Game() {
    const canvasRef = useRef(null);
    const lastPositionRef = useRef(null);
    const navigate = useNavigate();

    const [game, setGame] = useState(null);
    const [time, setTime] = useState(0);
    const [guess, setGuess] = useState("");
    const [messages, setMessages] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);

    const [client, setClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const [isDrawing, setIsDrawing] = useState(false);

    const [color, setColor] = useState("black");
    const [brushSize, setBrushSize] = useState(5);
    const [eraser, setEraser] = useState(false);

    const [drawingHistory, setDrawingHistory] = useState([]);

    const [hint, setHint] = useState("");
    const [hintsUsed, setHintsUsed] = useState(0);
    const [maxHints, setMaxHints] = useState(3);
    const [mousePosition, setMousePosition] = useState(null);
    const [room, setRoom] = useState(null);
    const [chatInput, setChatInput] = useState("");

    const roomId = sessionStorage.getItem("roomId");
    const playerId = sessionStorage.getItem("playerId");
    const playerName = sessionStorage.getItem("playerName");

    // =========================================================
    // LOAD GAME
    // =========================================================
    const loadGame = async () => {
        try {
            const response = await axios.get(
                `${API_URL}/api/rooms/${roomId}`
            );

            console.log("GAME FROM API:", response.data.game);

            setRoom(response.data);

            const gameData = response.data.game;

            if (!gameData) {
                console.error("Game data is missing");
                return;
            }

            // Drawer can see word information
            if (gameData.drawerId === playerId) {
                setGame(gameData);
            } else {
                // Guessers must not see the word
                setGame({
                    ...gameData,
                    wordOptions: null,
                    currentWord: null
                });
            }

            setTime(gameData.remainingTime || 0);
        } catch (error) {
            console.error("GAME LOAD ERROR:", error);
        }
    };

    // =========================================================
    // CLEAR LOCAL CANVAS
    // =========================================================
    const clearLocalCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // =========================================================
    // DRAW REMOTE STROKE
    // =========================================================
    const drawOnCanvas = (data) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        ctx.beginPath();
        ctx.moveTo(data.previousX, data.previousY);
        ctx.lineTo(data.x, data.y);
        ctx.strokeStyle = data.eraser ? "white" : data.color;
        ctx.lineWidth = data.brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    };

    const sendChat = () => {
        if (!chatInput.trim() || !client || !isConnected) {
            return;
        }

        client.publish({
            destination: "/app/game/chat",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
                playerName: playerName,
                message: chatInput.trim()
            })
        });

        setChatInput("");
    };

    // =========================================================
    // WEBSOCKET CONNECTION
    // =========================================================
    useEffect(() => {
        loadGame();

        const stompClient = new Client({
            brokerURL: WS_URL,
            reconnectDelay: 5000,
            onConnect: () => {
                console.log("Game WebSocket connected");
                setIsConnected(true);

                stompClient.subscribe(`/topic/room/${roomId}`, (message) => {
                    const updatedRoom = JSON.parse(message.body);
                    console.log("Room update:", updatedRoom);
                    setRoom(updatedRoom);

                    onStompError: (frame) => {
                        console.error("STOMP error:", frame);
                        setIsConnected(false);
                    };

                    onWebSocketError: (error) => {
                        console.error("WebSocket error:", error);
                        setIsConnected(false);
                    };

                    onWebSocketClose: () => {
                        console.log("Game WebSocket disconnected");
                        setIsConnected(false);
                    }
                });

                // -------------------------------------------------
                // GAME STATE
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/game`, (message) => {
                    const gameData = JSON.parse(message.body);
                    console.log("Game state:", gameData);

                    setGame((previousGame) => {
                        if (!previousGame) {
                            return gameData;
                        }

                        const isCurrentDrawer = gameData.drawerId === playerId;

                        return {
                            ...previousGame,
                            ...gameData,
                            wordOptions: isCurrentDrawer
                                ? (gameData.wordOptions ?? previousGame.wordOptions)
                                : null,
                            currentWord: isCurrentDrawer
                                ? (gameData.currentWord ?? previousGame.currentWord)
                                : null
                        };
                    });

                    if (gameData.remainingTime !== undefined) {
                        setTime(gameData.remainingTime);
                    }
                });

                stompClient.subscribe(`/topic/room/${roomId}/chat`, (message) => {
                    const chatData = JSON.parse(message.body);
                    setChatMessages((previousMessages) => [
                        ...previousMessages,
                        chatData
                    ]);
                });

                // -------------------------------------------------
                // PRIVATE DRAWER GAME DATA
                // -------------------------------------------------
                stompClient.subscribe(
                    `/topic/room/${roomId}/drawer/${playerId}`,
                    (message) => {
                        const drawerGame = JSON.parse(message.body);

                        console.log("NEW DRAWER GAME:", drawerGame);

                        setGame((previousGame) => ({
                            ...previousGame,
                            ...drawerGame,
                            wordOptions: drawerGame.wordOptions,
                            currentWord: drawerGame.currentWord
                        }));

                        setTime(drawerGame.remainingTime || 0);
                    }
                );

                // -------------------------------------------------
                // TIMER
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/timer`, (message) => {
                    const timer = JSON.parse(message.body);
                    setTime(timer);
                });

                // -------------------------------------------------
                // DRAWING
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/draw`, (message) => {
                    const drawData = JSON.parse(message.body);

                    if (drawData.playerId !== playerId) {
                        drawOnCanvas(drawData);
                        setDrawingHistory((previous) => [...previous, drawData]);
                    }
                });

                // -------------------------------------------------
                // UNDO
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/undo`, () => {
                    setDrawingHistory((previous) => {
                        if (previous.length === 0) {
                            return previous;
                        }

                        const updatedHistory = previous.slice(0, -1);
                        clearLocalCanvas();

                        const canvas = canvasRef.current;
                        if (!canvas) {
                            return updatedHistory;
                        }

                        const ctx = canvas.getContext("2d");

                        updatedHistory.forEach((stroke) => {
                            ctx.beginPath();
                            ctx.moveTo(stroke.previousX, stroke.previousY);
                            ctx.lineTo(stroke.x, stroke.y);
                            ctx.strokeStyle = stroke.eraser ? "white" : stroke.color;
                            ctx.lineWidth = stroke.brushSize;
                            ctx.lineCap = "round";
                            ctx.lineJoin = "round";
                            ctx.stroke();
                        });

                        return updatedHistory;
                    });
                });

                // -------------------------------------------------
                // CLEAR CANVAS
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/clear`, () => {
                    clearLocalCanvas();
                    setDrawingHistory([]);
                });

                // -------------------------------------------------
                // GUESS / CHAT
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/guess`, (message) => {
                    const guessData = JSON.parse(message.body);
                    setMessages((previous) => [...previous, guessData]);
                });

                // -------------------------------------------------
                // LEADERBOARD
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/leaderboard`, (message) => {
                    const leaderboardData = JSON.parse(message.body);
                    console.log("Leaderboard:", leaderboardData);
                    setLeaderboard(leaderboardData.players || []);
                });

                // -------------------------------------------------
                // HINT
                // -------------------------------------------------
                stompClient.subscribe(`/topic/room/${roomId}/hint`, (message) => {
                    const hintData = JSON.parse(message.body);
                    console.log("Hint:", hintData);
                    setHint(hintData.hint);
                    setHintsUsed(hintData.hintsUsed);
                    setMaxHints(hintData.maxHints);
                });
            }
        });

        stompClient.activate();
        setClient(stompClient);

        return () => {
            stompClient.deactivate();
        };
    }, [roomId]);

    // =========================================================
    // RESET WHEN NEW ROUND STARTS
    // =========================================================
    useEffect(() => {
        if (!game) return;

        clearLocalCanvas();
        setIsDrawing(false);
        lastPositionRef.current = null;
        setDrawingHistory([]);
        setHint("");
        setHintsUsed(0);
        setMaxHints(3);
        setTime(game.remainingTime || 0);
    }, [game?.currentRound]);

    const handleCanvasMouseMove = (event) => {
        if (!game) return;
        if (game.drawerId !== playerId) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setMousePosition({ x, y });
        draw(event);
    };

    // =========================================================
    // START DRAWING
    // =========================================================
    const startDrawing = (event) => {
        if (!game) return;
        if (game.drawerId !== playerId) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        lastPositionRef.current = { x, y };
        setIsDrawing(true);
    };

    // =========================================================
    // DRAW
    // =========================================================
    const draw = (event) => {
        if (!isDrawing) return;
        if (!game) return;
        if (game.drawerId !== playerId) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const previous = lastPositionRef.current;

        if (!previous) {
            lastPositionRef.current = { x, y };
            return;
        }

        const ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = eraser ? "white" : color;
        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        const stroke = {
            roomId: roomId,
            playerId: playerId,
            x: x,
            y: y,
            previousX: previous.x,
            previousY: previous.y,
            color: color,
            brushSize: brushSize,
            eraser: eraser
        };

        setDrawingHistory((previousHistory) => [...previousHistory, stroke]);

        if (client && client.connected) {
            client.publish({
                destination: "/app/game/draw",
                body: JSON.stringify(stroke)
            });
        }

        lastPositionRef.current = { x, y };
    };

    // =========================================================
    // STOP DRAWING
    // =========================================================
    const stopDrawing = () => {
        setIsDrawing(false);
        lastPositionRef.current = null;
    };

    // =========================================================
    // UNDO
    // =========================================================
    const undoLastStroke = () => {
        if (!game) return;
        if (game.drawerId !== playerId) return;

        setDrawingHistory((previous) => {
            if (previous.length === 0) return previous;

            const updatedHistory = previous.slice(0, -1);
            clearLocalCanvas();

            const canvas = canvasRef.current;
            if (!canvas) return updatedHistory;

            const ctx = canvas.getContext("2d");

            updatedHistory.forEach((stroke) => {
                ctx.beginPath();
                ctx.moveTo(stroke.previousX, stroke.previousY);
                ctx.lineTo(stroke.x, stroke.y);
                ctx.strokeStyle = stroke.eraser ? "white" : stroke.color;
                ctx.lineWidth = stroke.brushSize;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.stroke();
            });

            return updatedHistory;
        });

        if (client && isConnected) {
            client.publish({
                destination: "/app/game/undo",
                body: JSON.stringify({
                    roomId: roomId,
                    playerId: playerId
                })
            });
        }
    };

    // =========================================================
    // CLEAR CANVAS
    // =========================================================
    const clearCanvas = () => {
        if (!game) return;
        if (game.drawerId !== playerId) return;

        clearLocalCanvas();
        setDrawingHistory([]);

        if (client && isConnected) {
            client.publish({
                destination: "/app/game/clear",
                body: JSON.stringify({
                    roomId: roomId,
                    playerId: playerId
                })
            });
        }
    };

    // =========================================================
    // CHOOSE WORD
    // =========================================================
    const chooseWord = (word) => {
        if (!client || !client.connected) {
            alert("WebSocket is not connected");
            return;
        }

        client.publish({
            destination: "/app/game/choose-word",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
                word: word
            })
        });

        console.log("Word selected:", word);
    };

    // =========================================================
    // SEND GUESS
    // =========================================================
    const sendGuess = () => {
        if (!guess.trim()) return;

        if (!client || !client.connected) {
            alert("WebSocket is not connected");
            return;
        }

        client.publish({
            destination: "/app/game/guess",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
                playerName: playerName,
                message: guess
            })
        });

        setGuess("");
    };

    // =========================================================
    // LEAVE ROOM
    // =========================================================
    const leaveRoom = async () => {
        if (!client || !client.connected) {
            alert("WebSocket is not connected");
            return;
        }

        client.publish({
            destination: "/app/game/leave",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId
            })
        });

        console.log("Leave room request sent");
        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("isHost");
        sessionStorage.removeItem("playerId");
        sessionStorage.removeItem("playerName");
        window.location.href = "/";
    };

    // =========================================================
    // REQUEST HINT
    // =========================================================
    const requestHint = () => {
        if (!game) return;
        if (game.drawerId === playerId) return;
        if (!client || !client.connected) return;
        if (hintsUsed >= maxHints) return;

        client.publish({
            destination: "/app/game/hint",
            body: JSON.stringify({
                roomId: roomId,
                playerId: playerId,
                playerName: playerName
            })
        });
    };

    // =========================================================
    // LOADING
    // =========================================================
    if (!game) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <h2 style={{ color: "#4F46E5", marginTop: "20px" }}>Loading game...</h2>
            </div>
        );
    }

    // =========================================================
    // GAME OVER
    // =========================================================
    if (game.gameStatus === "GAME_OVER") {
        return (
            <div style={styles.gameOverWrapper}>
                <div style={styles.gameOverCard}>
                    <h1 style={{ fontSize: "2.5rem", margin: "0 0 10px 0" }}>🏆 Game Over!</h1>
                    <h2 style={{ color: "#4F46E5", margin: "0 0 25px 0" }}>
                        🎉 Winner: {game.winnerName}
                    </h2>

                    <h3 style={styles.sectionHeader}>Final Scores</h3>
                    <div style={styles.finalScoreList}>
                        {leaderboard.map((player, index) => (
                            <div key={player.id} style={styles.finalScoreItem}>
                                <span>
                                    <strong>{index + 1}.</strong> {player.name}
                                </span>
                                <span style={styles.scoreBadge}>{player.score} pts</span>
                            </div>
                        ))}
                    </div>

                    <button
                        style={styles.primaryButton}
                        onClick={() => {
                            sessionStorage.removeItem("roomId");
                            sessionStorage.removeItem("isHost");
                            navigate("/");
                        }}
                    >
                        🔄 Play Again
                    </button>
                </div>
            </div>
        );
    }

    // Color choices array for palette rendering
    const colorPalette = ["black", "red", "blue", "green", "yellow", "purple", "orange", "brown"];

    // =========================================================
    // MAIN UI
    // =========================================================
    return (
        <div style={styles.pageBackground}>
            <div style={styles.container}>
                {/* TOP BAR / HEADER */}
                <header style={styles.header}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h1 style={styles.title}>🎨 Skribbl Game</h1>
                    </div>

                    <div style={styles.gameInfoBar}>
                        <div style={styles.infoBadge}>
                            <span>Round</span>
                            <strong>
                                {game.currentRound} / {game.totalRounds}
                            </strong>
                        </div>

                        <div
                            style={{
                                ...styles.infoBadge,
                                ...(time <= 10 ? styles.timerWarning : {})
                            }}
                        >
                            <span>⏱️ Time</span>
                            <strong>{time}s</strong>
                        </div>

                        <div style={styles.infoBadge}>
                            <span>Status</span>
                            <strong>
                                {game.drawerId === playerId
                                    ? "🎨 Drawer"
                                    : "🔍 Guesser"}
                            </strong>
                        </div>
                    </div>

                    <button onClick={leaveRoom} style={styles.leaveButton}>
                        🚪 Leave
                    </button>
                </header>

                {/* HINT SECTION */}
                {game.drawerId !== playerId && (
                    <div style={styles.hintContainer}>
                        <button
                            onClick={requestHint}
                            disabled={hintsUsed >= maxHints}
                            style={{
                                ...styles.hintButton,
                                opacity: hintsUsed >= maxHints ? 0.6 : 1,
                                cursor: hintsUsed >= maxHints ? "not-allowed" : "pointer"
                            }}
                        >
                            💡 Hint ({hintsUsed}/{maxHints})
                        </button>

                        {hint ? (
                            <div style={styles.hintText}>{hint}</div>
                        ) : (
                            <span style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>
                                Request a hint if you get stuck!
                            </span>
                        )}
                    </div>
                )}

                {/* ROLE BANNER / WORD SELECTION */}
                {game.drawerId === playerId ? (
                    <div style={styles.drawerBanner}>
                        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#15803D" }}>
                            🎨 You are the DRAWER!
                        </h2>

                        {!game.currentWord ? (
                            <div style={{ marginTop: "10px" }}>
                                <p style={{ margin: "0 0 10px 0", fontWeight: "600" }}>
                                    Choose a word to draw:
                                </p>
                                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                                    {game.wordOptions?.map((word) => (
                                        <button
                                            key={word}
                                            onClick={() => chooseWord(word)}
                                            style={styles.wordOptionButton}
                                        >
                                            {word}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <h2 style={{ margin: "5px 0 0 0", color: "#166534" }}>
                                ✏️ Your word: <span style={styles.wordHighlight}>{game.currentWord}</span>
                            </h2>
                        )}
                    </div>
                ) : (
                    <div style={styles.guesserBanner}>
                        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#1D4ED8" }}>
                            🔍 You are the GUESSER!
                        </h2>
                        <p style={{ margin: "5px 0 0 0", fontSize: "0.95rem", color: "#1E40AF" }}>
                            Watch the canvas closely and guess the word in chat!
                        </p>
                    </div>
                )}

                {/* MAIN GAME WORKSPACE */}
                <div style={styles.mainGrid}>
                    {/* LEFT PANEL: CANVAS & TOOLBAR */}
                    <div style={styles.canvasSection}>
                        {/* DRAWING TOOLBAR */}
                        {game.drawerId === playerId && (
                            <div style={styles.toolbar}>
                                <div style={styles.toolGroup}>
                                    <span style={styles.toolLabel}>Palette:</span>
                                    {colorPalette.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setColor(c);
                                                setEraser(false);
                                            }}
                                            style={{
                                                ...styles.colorCircle,
                                                backgroundColor: c,
                                                border:
                                                    color === c && !eraser
                                                        ? "3px solid #4F46E5"
                                                        : "2px solid #E5E7EB"
                                            }}
                                        />
                                    ))}
                                </div>

                                <div style={styles.toolGroup}>
                                    <span style={styles.toolLabel}>Size:</span>
                                    <select
                                        value={brushSize}
                                        onChange={(e) => setBrushSize(Number(e.target.value))}
                                        style={styles.selectInput}
                                    >
                                        <option value="2">S (2px)</option>
                                        <option value="5">M (5px)</option>
                                        <option value="10">L (10px)</option>
                                        <option value="20">XL (20px)</option>
                                    </select>
                                </div>

                                <div style={styles.toolGroup}>
                                    <button
                                        onClick={() => setEraser(false)}
                                        style={{
                                            ...styles.toolButton,
                                            ...(!eraser ? styles.toolButtonActive : {})
                                        }}
                                    >
                                        🖌️ Brush
                                    </button>
                                    <button
                                        onClick={() => setEraser(true)}
                                        style={{
                                            ...styles.toolButton,
                                            ...(eraser ? styles.toolButtonActive : {})
                                        }}
                                    >
                                        🧹 Eraser
                                    </button>
                                </div>

                                <div style={styles.toolGroup}>
                                    <button onClick={undoLastStroke} style={styles.toolButton}>
                                        ↩️ Undo
                                    </button>
                                    <button
                                        onClick={clearCanvas}
                                        style={{ ...styles.toolButton, backgroundColor: "#FEE2E2", color: "#DC2626" }}
                                    >
                                        🗑️ Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CANVAS DISPLAY */}
                        <div style={styles.canvasContainer}>
                            <canvas
                                ref={canvasRef}
                                width={800}
                                height={500}
                                onMouseDown={startDrawing}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={stopDrawing}
                                onMouseLeave={() => {
                                    stopDrawing();
                                    setMousePosition(null);
                                }}
                                style={{
                                    border: "1px solid #E5E7EB",
                                    backgroundColor: "white",
                                    cursor: game.drawerId === playerId ? "none" : "default",
                                    display: "block",
                                    width: "100%",
                                    borderRadius: "12px"
                                }}
                            />

                            {/* Brush Cursor */}
                            {game.drawerId === playerId && mousePosition && (
                                <div
                                    style={{
                                        position: "absolute",
                                        left: mousePosition.x - brushSize / 2,
                                        top: mousePosition.y - brushSize / 2,
                                        width: brushSize,
                                        height: brushSize,
                                        border: "1px solid #000",
                                        backgroundColor: eraser ? "rgba(255,255,255,0.5)" : "transparent",
                                        borderRadius: "50%",
                                        pointerEvents: "none",
                                        boxSizing: "border-box"
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: PLAYERS, LEADERBOARD, GUESSES & CHAT */}
                    <div style={styles.sidePanel}>
                        {/* PLAYERS & LEADERBOARD TAB */}
                        <div style={styles.card}>
                            <h3 style={styles.cardHeader}>🏆 Leaderboard</h3>
                            <div style={styles.playerList}>
                                {room?.players?.length > 0 ? (
                                    room.players.map((player, idx) => {
                                        const isCurrentDrawer = player.id === game.drawerId;
                                        return (
                                            <div key={player.id} style={styles.playerRow}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ fontWeight: "700", color: "#6B7280" }}>
                                                        #{idx + 1}
                                                    </span>
                                                    <span>{player.name}</span>
                                                    {player.id === room.hostId && (
                                                        <span style={styles.hostTag}>👑 Host</span>
                                                    )}
                                                    {isCurrentDrawer && (
                                                        <span style={styles.drawerTag}>✏️</span>
                                                    )}
                                                </div>
                                                <span style={styles.scoreText}>{player.score} pts</span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p style={{ color: "#9CA3AF", textAlign: "center" }}>
                                        Waiting for players...
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* GUESSES BOX */}
                        <div style={{ ...styles.card, flex: 1, display: "flex", flexDirection: "column" }}>
                            <h3 style={styles.cardHeader}>🎯 Guesses</h3>
                            <div style={styles.chatBox}>
                                {messages.map((msg, index) => (
                                    <div key={index} style={styles.guessMessage}>
                                        <strong>{msg.playerName}: </strong>

                                        {msg.correct ? (
                                            <span style={{ color: "#16A34A", fontWeight: "700" }}>
                                                ✅ Correct guess!
                                            </span>
                                        ) : (
                                            <span>{msg.message}</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div style={styles.inputRow}>
                                <input
                                    type="text"
                                    value={guess}
                                    placeholder={game.drawerId === playerId ? "You are drawing..." : "Type your guess here..."}
                                    disabled={game.drawerId === playerId}
                                    onChange={(e) => setGuess(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            sendGuess();
                                        }
                                    }}
                                    style={styles.textInput}
                                />
                                <button
                                    onClick={sendGuess}
                                    disabled={game.drawerId === playerId}
                                    style={{
                                        ...styles.sendButton,
                                        opacity: game.drawerId === playerId ? 0.5 : 1
                                    }}
                                >
                                    Guess
                                </button>
                            </div>
                        </div>

                        {/* CHAT BOX */}
                        <div style={{ ...styles.card, flex: 1, display: "flex", flexDirection: "column" }}>
                            <h3 style={styles.cardHeader}>💬 Room Chat</h3>
                            <div style={styles.chatBox}>
                                {chatMessages.map((msg, index) => (
                                    <div key={index} style={styles.chatMessage}>
                                        <strong style={{ color: "#4F46E5" }}>{msg.playerName}: </strong>
                                        <span>{msg.message}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={styles.inputRow}>
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            sendChat();
                                        }
                                    }}
                                    placeholder="Type a chat message..."
                                    style={styles.textInput}
                                />
                                <button onClick={sendChat} style={styles.sendButton}>
                                    Chat
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =========================================================
// STYLES OBJECT
// =========================================================
const styles = {
    pageBackground: {
        backgroundColor: "#F3F4F6",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1F2937"
    },
    container: {
        maxWidth: "1280px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "15px"
    },
    header: {
        backgroundColor: "#FFFFFF",
        padding: "15px 25px",
        borderRadius: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
    },
    title: {
        margin: 0,
        fontSize: "1.5rem",
        fontWeight: "800",
        color: "#111827"
    },
    gameInfoBar: {
        display: "flex",
        gap: "15px"
    },
    infoBadge: {
        backgroundColor: "#F9FAFB",
        border: "1px solid #E5E7EB",
        padding: "8px 16px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontSize: "0.8rem",
        color: "#6B7280"
    },
    timerWarning: {
        backgroundColor: "#FEE2E2",
        borderColor: "#FCA5A5",
        color: "#DC2626"
    },
    leaveButton: {
        backgroundColor: "#EF4444",
        color: "#FFFFFF",
        border: "none",
        padding: "10px 18px",
        borderRadius: "10px",
        fontWeight: "600",
        cursor: "pointer",
        transition: "background 0.2s"
    },
    hintContainer: {
        backgroundColor: "#FFFBEB",
        border: "1px solid #FDE68A",
        padding: "12px 20px",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        gap: "20px"
    },
    hintButton: {
        backgroundColor: "#F59E0B",
        color: "#FFFFFF",
        border: "none",
        padding: "8px 16px",
        borderRadius: "8px",
        fontWeight: "600"
    },
    hintText: {
        fontSize: "1.4rem",
        letterSpacing: "6px",
        fontWeight: "bold",
        color: "#B45309"
    },
    drawerBanner: {
        backgroundColor: "#DCFCE7",
        border: "1px solid #86EFAC",
        padding: "15px 20px",
        borderRadius: "12px",
        textAlign: "center"
    },
    guesserBanner: {
        backgroundColor: "#DBEAFE",
        border: "1px solid #93C5FD",
        padding: "15px 20px",
        borderRadius: "12px",
        textAlign: "center"
    },
    wordOptionButton: {
        backgroundColor: "#22C55E",
        color: "#FFFFFF",
        border: "none",
        padding: "10px 20px",
        borderRadius: "8px",
        fontWeight: "600",
        cursor: "pointer"
    },
    wordHighlight: {
        backgroundColor: "#BBF7D0",
        padding: "2px 10px",
        borderRadius: "6px"
    },
    mainGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: "20px"
    },
    canvasSection: {
        display: "flex",
        flexDirection: "column",
        gap: "10px"
    },
    toolbar: {
        backgroundColor: "#FFFFFF",
        padding: "12px 18px",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
        flexWrap: "wrap",
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        border: "1px solid #E5E7EB"
    },
    toolGroup: {
        display: "flex",
        alignItems: "center",
        gap: "8px"
    },
    toolLabel: {
        fontSize: "0.85rem",
        fontWeight: "600",
        color: "#6B7280"
    },
    colorCircle: {
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        cursor: "pointer",
        padding: 0
    },
    selectInput: {
        padding: "6px 10px",
        borderRadius: "6px",
        border: "1px solid #D1D5DB",
        outline: "none"
    },
    toolButton: {
        backgroundColor: "#F3F4F6",
        border: "1px solid #D1D5DB",
        padding: "6px 12px",
        borderRadius: "6px",
        fontSize: "0.85rem",
        fontWeight: "600",
        cursor: "pointer"
    },
    toolButtonActive: {
        backgroundColor: "#EEF2FF",
        borderColor: "#6366F1",
        color: "#4F46E5"
    },
    canvasContainer: {
        position: "relative",
        backgroundColor: "#FFFFFF",
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        overflow: "hidden"
    },
    sidePanel: {
        display: "flex",
        flexDirection: "column",
        gap: "15px"
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: "12px",
        padding: "15px",
        border: "1px solid #E5E7EB",
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
    },
    cardHeader: {
        margin: "0 0 10px 0",
        fontSize: "1rem",
        fontWeight: "700",
        color: "#374151"
    },
    playerList: {
        display: "flex",
        flexDirection: "column",
        gap: "8px"
    },
    playerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 8px",
        backgroundColor: "#F9FAFB",
        borderRadius: "6px",
        fontSize: "0.9rem"
    },
    hostTag: {
        fontSize: "0.75rem",
        backgroundColor: "#FEF3C7",
        color: "#D97706",
        padding: "2px 6px",
        borderRadius: "4px"
    },
    drawerTag: {
        fontSize: "0.85rem"
    },
    scoreText: {
        fontWeight: "700",
        color: "#4F46E5"
    },
    chatBox: {
        height: "120px",
        overflowY: "auto",
        border: "1px solid #F3F4F6",
        backgroundColor: "#FAFAFA",
        borderRadius: "8px",
        padding: "10px",
        marginBottom: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        fontSize: "0.88rem"
    },
    guessMessage: {
        backgroundColor: "#FFFFFF",
        padding: "4px 8px",
        borderRadius: "4px",
        border: "1px solid #F3F4F6"
    },
    chatMessage: {
        wordBreak: "break-word"
    },
    inputRow: {
        display: "flex",
        gap: "8px"
    },
    textInput: {
        flex: 1,
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #D1D5DB",
        outline: "none",
        fontSize: "0.88rem"
    },
    sendButton: {
        backgroundColor: "#4F46E5",
        color: "#FFFFFF",
        border: "none",
        padding: "8px 14px",
        borderRadius: "8px",
        fontWeight: "600",
        cursor: "pointer"
    },
    loadingContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#F3F4F6"
    },
    spinner: {
        width: "40px",
        height: "40px",
        border: "4px solid #E5E7EB",
        borderTop: "4px solid #4F46E5",
        borderRadius: "50%"
    },
    gameOverWrapper: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#F3F4F6"
    },
    gameOverCard: {
        backgroundColor: "#FFFFFF",
        padding: "40px",
        borderRadius: "20px",
        textAlign: "center",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
        maxWidth: "450px",
        width: "100%"
    },
    sectionHeader: {
        margin: "0 0 15px 0",
        color: "#374151",
        textAlign: "left"
    },
    finalScoreList: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        marginBottom: "25px"
    },
    finalScoreItem: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 15px",
        backgroundColor: "#F9FAFB",
        borderRadius: "8px"
    },
    scoreBadge: {
        fontWeight: "bold",
        color: "#4F46E5"
    },
    primaryButton: {
        backgroundColor: "#4F46E5",
        color: "#FFFFFF",
        border: "none",
        padding: "12px 24px",
        borderRadius: "10px",
        fontSize: "1rem",
        fontWeight: "700",
        cursor: "pointer"
    }
};

export default Game;