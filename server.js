const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

/* -------------------- PATHS (Railway-safe) -------------------- */

const baseDir = __dirname;
const publicDir = path.join(baseDir, "public");
const uploadDir = path.join(publicDir, "uploads");

/* ensure folders always exist */
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

/* -------------------- STATIC -------------------- */

app.use(express.static(publicDir));

/* -------------------- MULTER UPLOADS -------------------- */

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const safeExt = path.extname(file.originalname || "").toLowerCase();
		cb(null, Date.now() + "_" + Math.floor(Math.random() * 999999) + safeExt);
	}
});

const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024 // 5mb cap
	}
});

app.post("/upload", upload.single("image"), (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: "no file uploaded" });
		}

		return res.json({
			path: "/uploads/" + req.file.filename
		});
	} catch (err) {
		console.error("upload error:", err);
		return res.status(500).json({ error: "upload failed" });
	}
});

/* -------------------- DATA -------------------- */

let boards = {
	main: { messages: [], nextId: 1 },
	b: { messages: [], nextId: 1 },
	food: { messages: [], nextId: 1 },
	images: { messages: [], nextId: 1 }
};

let threads = [];
const MAX_THREADS = 20;
const MAX_MESSAGES = 50;

/* -------------------- SOCKETS -------------------- */

io.on("connection", (socket) => {
	socket.userId = "unknown";
	socket.username = "u.n. owen";
	socket.board = "main";

	socket.emit("chat history", boards.main.messages);
	socket.emit("threads update", threads);

	socket.on("register", (data) => {
		if (data?.userId) socket.userId = String(data.userId);
		if (data?.username) socket.username = String(data.username).slice(0, 20);
		if (data?.board && boards[data.board]) socket.board = data.board;
	});

	socket.on("switch board", (board) => {
		if (!boards[board]) return;

		socket.board = board;
		socket.emit("chat history", boards[board].messages);
	});

	socket.on("create thread", (name) => {
		name = String(name || "").trim().slice(0, 30);
		if (!name) return;

		const id = "thread_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

		boards[id] = { messages: [], nextId: 1 };

		threads.unshift({
			id,
			name,
			lastActive: Date.now()
		});

		if (threads.length > MAX_THREADS) {
			const removed = threads.pop();
			delete boards[removed.id];
		}

		io.emit("threads update", threads);
	});

	socket.on("chat message", (msg) => {
		const boardData = boards[socket.board];
		if (!boardData) return;

		const text = String(msg?.text || "").trim().slice(0, 500);
		const image = msg?.image ? String(msg.image) : null;

		if (!text && !image) return;

		const fullMsg = {
			msgId: boardData.nextId++,
			name: `${socket.username} #${socket.userId}`,
			userId: socket.userId,
			text,
			image,
			replyTo: msg?.replyTo || null,
			time: Date.now()
		};

		boardData.messages.push(fullMsg);

		if (boardData.messages.length > MAX_MESSAGES) {
			boardData.messages.shift();
		}

		if (socket.board.startsWith("thread_")) {
			const t = threads.find(x => x.id === socket.board);
			if (t) {
				t.lastActive = Date.now();
				threads.sort((a, b) => b.lastActive - a.lastActive);
				io.emit("threads update", threads);
			}
		}

		io.emit("chat message", {
			board: socket.board,
			msg: fullMsg
		});
	});

	socket.on("clear chat", () => {
		const board = socket.board;
		if (!boards[board]) return;

		boards[board] = { messages: [], nextId: 1 };

		io.emit("chat history", []);
	});
});

/* -------------------- START -------------------- */

server.listen(PORT, () => {
	console.log("server running on", PORT);
});
