const express = require("express");
const { accessChat, fetchChats, createGroupChat } = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.route("/").post(protect, accessChat).get(protect, fetchChats);
router.route("/group").post(protect, createGroupChat);

module.exports = router;