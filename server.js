const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let messages = [];
let userCount = 0;

io.on("connection", (socket) => {
	userCount++;

	socket.userId = userCount;
	socket.username = "u.n. owen";

	console.log(`user connected #${socket.userId}`);

	socket.emit("chat history", messages);

	socket.on("set username", (name) => {
		socket.username = name || "u.n. owen";
	});

	socket.on("chat message", (msg) => {
		const fullMsg = {
			name: `${socket.username} #${socket.userId}`,
			text: msg.text,
			image: msg.image || null
		};

		messages.push(fullMsg);

		if (messages.length > 10) {
			messages.shift();
		}

		io.emit("chat message", fullMsg);
	});

	socket.on("disconnect", () => {
		console.log(`user disconnected #${socket.userId}`);
	});
});

server.listen(PORT, () => {
	console.log("server running on port " + PORT);
});