import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [process.env.FRONTEND_URL, process.env.DOCTOR_URL],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("joinRoom", ({ userId, doctorId }) => {
      const room = [userId, doctorId].sort().join("_");
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on("sendMessage", (message) => {
      const room = [message.senderId, message.receiverId].sort().join("_");
      console.log(`Sending message to room ${room}:`, message);
      io.to(room).emit("receiveMessage", message);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
