const express = require("express");
const router = express.Router();

const { login } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/login", login);

// temporary route to test middleware
router.post("/upload", authMiddleware, (req, res) => {
  res.json({
    message: "Upload allowed",
    user: req.user
  });
});

module.exports = router;