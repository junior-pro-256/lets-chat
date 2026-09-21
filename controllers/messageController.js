const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");

const sendMessage = async (req, res) => {
  const { chatId, text } = req.body;
  let fileUrl = "";
  let fileType = "";

  if (req.file) {
    fileUrl = `/uploads/${req.file.filename}`;
    fileType = req.file.mimetype.startsWith("image/") ? "image" : "document";
  }

  if (!chatId || (!text && !fileUrl)) {
    return res.status(400).json({ message: "Invalid message data" });
  }

  let newMessage = {
    sender: req.user.id,
    text: text || "",
    fileUrl: fileUrl,
    fileType: fileType,
    chat: chatId,
  };

  try {
    let message = await Message.create(newMessage);
    message = await message.populate("sender", "username");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "username email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });
    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const allMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "username email")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { sendMessage, allMessages };