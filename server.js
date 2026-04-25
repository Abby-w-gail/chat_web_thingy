const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// boards now store { messages: [], nextId: number }
let boards = {
	main: { messages: [], nextId: 1 },
	b: { messages: [], nextId: 1 },
	food: { messages: [], nextId: 1 },
	images: { messages: [], nextId: 1 }
};

let threads = [];
const MAX_THREADS = 20;

io.on("connection", (socket) => {
	socket.userId = "unknown";
	socket.username = "u.n. owen";
	socket.board = "main";

	socket.emit("chat history", boards[socket.board].messages);
	socket.emit("threads update", threads);

	socket.on("register", (data) => {
		if (data?.userId) socket.userId = String(data.userId);
		if (data?.username) socket.username = String(data.username).slice(0, 20);
		if (data?.board) socket.board = data.board;
	});

	socket.on("switch board", (board) => {
		if (!boards[board]) return;

		socket.board = board;
		socket.emit("chat history", boards[board].messages);
	});

	socket.on("create thread", (name) => {
		if (!name) return;

		name = String(name).trim().slice(0, 30);
		if (!name) return;

		const id = "thread_" + Date.now();

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
		if (!msg) return;

		const boardData = boards[socket.board];
		if (!boardData) return;

		const text = typeof msg.text === "string" ? msg.text.trim() : "";
		const image = msg.image || null;

		if (!text && !image) return;

		const fullMsg = {
			msgId: boardData.nextId++,
			name: `${socket.username} #${socket.userId}`,
			userId: socket.userId,
			text,
			image,
			replyTo: msg.replyTo || null,
			time: Date.now()
		};

		boardData.messages.push(fullMsg);

		if (boardData.messages.length > 50) {
			boardData.messages.shift();
		}

		// thread activity
		if (socket.board.startsWith("thread_")) {
			const t = threads.find(t => t.id === socket.board);
			if (t) {
				t.lastActive = Date.now();
				threads.sort((a, b) => b.lastActive - a.lastActive);
				io.emit("threads update", threads);
			}
		}

		io.emit("chat message", { board: socket.board, msg: fullMsg });
	});

	socket.on("clear chat", () => {
		const board = socket.board;
		if (!boards[board]) return;

		boards[board] = { messages: [], nextId: 1 };
		io.emit("chat history", []);
	});
});

server.listen(PORT, () => {
	console.log("server running on " + PORT);
});
