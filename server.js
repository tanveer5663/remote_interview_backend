import express from "express";
import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { ApiError } from "./utils/ApiError.js";
import globalErrorHandler from "./middleware/globalErroHandler.js";
import cookieParser from "cookie-parser";
import { verifyJWT } from "./middleware/auth.js";
import { clerkMiddleware } from '@clerk/express'
const app = express();
const port = ENV.PORT || 6000;

app.use(express.json());
app.use(cookieParser());

app.use(clerkMiddleware())

app.get(
  "/health",

  asyncHandler((req, res) => {
    if (true) {
      // throw new ApiError(420, "Testing ApiError");
    }
    res.status(200).json({ msg: "api is up and running" });
  }),
);

app.use(globalErrorHandler);

const startServer = async () => {
  try {
    // await connectDB();
    app.listen(ENV.PORT, () =>
      console.log("Server is running on port:", ENV.PORT),
    );
  } catch (error) {
    console.error("Error starting the server", error);
  }
};

startServer();
