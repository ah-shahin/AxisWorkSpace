require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const customersRouter = require("./routes/customers");
const roomsRouter = require("./routes/rooms");
const visitsRouter = require("./routes/visits");
const reportsRouter = require("./routes/reports");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/customers", customersRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/visits", visitsRouter);
app.use("/api/reports", reportsRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;