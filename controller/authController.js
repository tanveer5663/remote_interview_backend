import { ApiError } from "../utils/ApiError.js";
import User from "../model/User.js";
import bcryptjs from "bcryptjs";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { upsertStreamUser } from "../lib/stream.js";

export const signup = asyncHandler(async (req, res) => {
  console.log("reqbody", req.body);

  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    throw new ApiError(400, "All fields are required");
  }

  const userAlreadyExists = await User.findOne({ email }).lean();
  console.log("userAlreadyExists", userAlreadyExists);

  if (userAlreadyExists) {
    throw new ApiError(400, "User already exists");
  }

  const hashedPassword = await bcryptjs.hash(password, 10);
  const userId = generateId(10);

  const user = new User({
    email,
    password: hashedPassword,
    name,
    clerkId: userId,
  });
  console.log("user", user);

  await user.save();

  // jwt
  await generateTokenAndSetCookie(res, user._id);
  await upsertStreamUser({
    id: userId.toString(),
    name: user.name,
    image: user.profileImage,
  });
  res.status(201).json(
    new ApiResponse(
      201,
      {
        ...user._doc,
        createdAt: undefined,
        updatedAt: undefined,
        __v: undefined,
        password: undefined,
      },
      "User created successfully",
    ),
  );
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findOne({ email }).select("+password").lean();
  console.log("user found during login ", user);
  if (!user) {
    throw new ApiError(400, "Invalid credentials");
  }
  const isPasswordValid = await bcryptjs.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid credentials");
  }

  await generateTokenAndSetCookie(res, user._id);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ...user,
        createdAt: undefined,
        updatedAt: undefined,
        __v: undefined,
        password: undefined,
      },
      "Logged in successfully",
    ),
  );
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token");

  res.status(200).json(new ApiResponse(200, null, "Logged out successfully"));
});

export const checkAuth = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "User not authenticated");
  }

  res
    .status(200)
    .json(new ApiResponse(200, req.user, "User found successfully"));
});

function generateId(length = 10) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}
