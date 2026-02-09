const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const DBConnection = require("./config/connect");

dotenv.config();

const app = express();

////// DATABASE ///////
DBConnection();

////// MIDDLEWARE ///////
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://learn-hub-blush.vercel.app"
    ],
    credentials: true,
  })
);

////// UPLOADS (TEMP on Render) ///////
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/uploads", express.static(uploadsDir));

////// TEST ROUTE ///////
app.get("/", (req, res) => {
  res.send("Backend running successfully 🚀");
});

////// ROUTES ///////
app.use("/api/admin", require("./routers/adminRoutes"));
app.use("/api/user", require("./routers/userRoutes"));

////// SERVER ///////
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
