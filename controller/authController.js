import { ApiError } from "../utils/ApiError.js";
import User from "../model/User.js";
import bcryptjs from "bcryptjs";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const signup = asyncHandler(async (req, res) => {
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

  const user = new User({
    email,
    password: hashedPassword,
    name,
  });
  console.log("user", user);

  await user.save();

  // jwt
  await generateTokenAndSetCookie(res, user._id);
  res.status(201).json(
    new ApiResponse(
      201,
      {
        ...user._doc,
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
  const user = await User.findById(req.userId).select("-password");
  if (!user) {
    return new ApiResponse(400, null, "User not found");
  }

  res.status(200).json(new ApiResponse(200, user, "User found"));
});
