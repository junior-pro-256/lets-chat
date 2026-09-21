const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    text: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    fileType: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);