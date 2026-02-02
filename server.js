import express from "express";
import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { asyncHandler } from "./utils/asyncHandler.js";

import globalErrorHandler from "./middleware/globalErroHandler.js";
import cookieParser from "cookie-parser";

import { clerkMiddleware } from "@clerk/express";
import authRoutes from "./routes/authRoutes.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import mongoose from "mongoose";
import cors from "cors";
const app = express();
const port = ENV.PORT || 6000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.use(clerkMiddleware());

app.get(
  "/api/health",
  asyncHandler((req, res) => {
    res.status(200).json(new ApiResponse(200, null, "api is up and running"));
  }),
);
app.use("/api/auth", authRoutes);

app.use(globalErrorHandler);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(ENV.PORT, () =>
      console.log("Server is running on port:", ENV.PORT),
    );
  } catch (error) {
    console.error("Error starting the server", error);
  }
};

startServer();

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Closing MongoDB connection...`);
  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
