const User = require("../models/User");

const activeUsers = new Map();

module.exports = (io) => {
  io.on("connection", (socket) => {
    socket.on("setup", async (userData) => {
      socket.join(userData.id);
      activeUsers.set(userData.id, socket.id);
      await User.findByIdAndUpdate(userData.id, { isOnline: true });
      io.emit("user_status", { userId: userData.id, isOnline: true });
      socket.emit("connected");
    });

    socket.on("join_chat", (room) => socket.join(room));
    socket.on("typing", (room) => socket.in(room).emit("typing", room));
    socket.on("stop_typing", (room) => socket.in(room).emit("stop_typing", room));

    socket.on("new_message", (newMessageReceived) => {
      let chat = newMessageReceived.chat;
      if (!chat.users) return;

      chat.users.forEach((user) => {
        if (user._id === newMessageReceived.sender._id) return;
        socket.in(user._id).emit("message_received", newMessageReceived);
      });
    });

    socket.on("disconnect", async () => {
      let disconnectedUserId = null;
      for (let [userId, socketId] of activeUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          activeUsers.delete(userId);
          break;
        }
      }
      if (disconnectedUserId) {
        await User.findByIdAndUpdate(disconnectedUserId, { isOnline: false, lastSeen: new Date() });
        io.emit("user_status", { userId: disconnectedUserId, isOnline: false });
      }
    });
  });
};