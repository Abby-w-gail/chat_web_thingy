const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let boards = {
	main: { messages: [], nextId: 1 },
	b: { messages: [], nextId: 1 },
	food: { messages: [], nextId: 1 },
	images: { messages: [], nextId: 1 }
};

let threads = [];
const MAX_THREADS = 20;
const MAX_MESSAGES = 50;

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

		const id = "thread_" + Date.now();
		boards[id] = { messages: [], nextId: 1 };

		threads.unshift({ id, name, lastActive: Date.now() });

		if (threads.length > MAX_THREADS) {
			const removed = threads.pop();
			delete boards[removed.id];
		}

		io.emit("threads update", threads);
	});

	socket.on("chat message", (msg) => {
		const board = boards[socket.board];
		if (!board) return;

		const text = String(msg?.text || "").slice(0, 20000);
		const image = msg?.image || null;

		if (!text && !image) return;

		const fullMsg = {
			msgId: board.nextId++,
			name: `${socket.username} #${socket.userId}`,
			userId: socket.userId,
			text,
			image,
			replyTo: msg?.replyTo || null,
			time: Date.now()
		};

		board.messages.push(fullMsg);
		if (board.messages.length > MAX_MESSAGES) board.messages.shift();

		io.emit("chat message", {
			board: socket.board,
			msg: fullMsg
		});
	});
});

server.listen(PORT, "0.0.0.0", () => {
	console.log("server running on", PORT);
});
