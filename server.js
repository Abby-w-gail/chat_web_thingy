const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let messages = [];

io.on("connection", (socket) => {
	socket.userId = "unknown";
	socket.username = "u.n. owen";

	socket.emit("chat history", messages);

	// receive stable id from client
	socket.on("register", (data) => {
		if (data?.userId) {
			socket.userId = String(data.userId);
		}
		if (data?.username) {
			socket.username = String(data.username).slice(0, 20);
		}

		console.log("connected:", socket.userId);
	});

	socket.on("chat message", (msg) => {
		if (!msg) return;

		const text = typeof msg.text === "string" ? msg.text.trim() : "";
		const image = msg.image || null;

		if (!text && !image) return;

		const fullMsg = {
			id: Date.now() + Math.random(),
			name: `${socket.username} #${socket.userId}`,
			text,
			image,
			time: Date.now()
		};

		messages.push(fullMsg);
		if (messages.length > 50) messages.shift();

		io.emit("chat message", fullMsg);
	});
});

server.listen(PORT, () => {
	console.log("server running on port " + PORT);
});
