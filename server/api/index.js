// Vercel Serverless Function entry point.
// @vercel/node runs an exported Express app natively — it calls the app with
// Node's (req, res), which is exactly Express's own signature. No adapter needed.
// (serverless-http is an AWS Lambda / Netlify adapter and does NOT fit Vercel.)
const app = require("../app");

module.exports = app;
