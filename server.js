const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// each board has its own messages
let boards = {
	main: [],
	b: []
};

io.on("connection", (socket) => {
	socket.userId = "unknown";
	socket.username = "u.n. owen";
	socket.board = "main";

	socket.emit("chat history", boards[socket.board]);

	socket.on("register", (data) => {
		if (data?.userId) socket.userId = String(data.userId);
		if (data?.username) socket.username = String(data.username).slice(0, 20);
		if (data?.board) socket.board = data.board;
	});

	socket.on("switch board", (board) => {
		if (!boards[board]) return;

		socket.board = board;
		socket.emit("chat history", boards[board]);
	});

	socket.on("chat message", (msg) => {
		if (!msg) return;

		const text = typeof msg.text === "string" ? msg.text.trim() : "";
		const image = msg.image || null;

		if (!text && !image) return;

		const fullMsg = {
			id: Date.now() + Math.random(),
			name: `${socket.username} #${socket.userId}`,
			userId: socket.userId,
			text,
			image,
			replyTo: msg.replyTo || null,
			time: Date.now()
		};

		boards[socket.board].push(fullMsg);

		if (boards[socket.board].length > 50) {
			boards[socket.board].shift();
		}

		io.emit("chat message", { board: socket.board, msg: fullMsg });
	});
});

server.listen(PORT, () => {
	console.log("server running on " + PORT);
});
