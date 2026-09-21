const express = require("express");
const { register, login, getUsers, updateAvatar } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();
router.post("/register", upload.single("avatar"), register);
router.post("/login", login);
router.get("/users", protect, getUsers);
router.put("/profile/avatar", protect, upload.single("avatar"), updateAvatar);

module.exports = router;