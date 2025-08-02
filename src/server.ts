import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import { config } from "./config";
import { postgraphileMiddleware } from "./postgraphile";
import collectRoute from "./routes/collect";
import eventRoute from "./routes/event";

const app = express();

// Middleware
app.use(cors());


// GraphQL (PostGraphile)
app.use('/', postgraphileMiddleware);

// REST body parsing (AFTER PostGraphile)
app.use(express.json());

// REST(Data collection)  routes
app.use("/collect", collectRoute);
app.use("/event", eventRoute);

// -- Serve static analytics.js --
app.use(express.static(path.join(__dirname, "../public")));
app.get("/analytics.js", (req, res) => {
  const filePath = path.join(__dirname, "../public/analytics.js");
  res.setHeader("Content-Type", "application/javascript");
  fs.createReadStream(filePath).pipe(res);
});


// Start the server
app.listen(config.PORT, () => {
  console.log(`Server is running at ${config.PORT}`);
});
