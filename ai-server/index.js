require("dotenv").config();

const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT || 5000;
const app = express();
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/docs", documentRoutes);



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});