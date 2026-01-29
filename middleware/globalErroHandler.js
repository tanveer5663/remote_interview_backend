import { ENV } from "../lib/env.js";
import { ApiError } from "../utils/ApiError.js";
const globalErrorHandler = (err, req, res, next) => {
  console.log(err);
  let statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    statusCode,
    success: false,
    message: err.message,
    errors: err.errors,
    stack: ENV.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default globalErrorHandler;
