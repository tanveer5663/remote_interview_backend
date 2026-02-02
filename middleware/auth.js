import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ENV } from "../lib/env.js";
import jwt from "jsonwebtoken";
import User from "../model/User.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    console.log(req.cookies, "cookies");
    const token =
      req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");
    console.log("token:", token);

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, ENV.JWT_SECRET);
    console.log("decoded token");

    const user = await User.findById(decodedToken?.userId)
      .select("-createdAt -updatedAt -__v ")
      .lean();
    console.log("user inside jwtVerify", user);

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
