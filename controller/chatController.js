import { chatClient } from "../lib/stream.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export const getStreamToken = asyncHandler((req, res) => {
  const token = chatClient.createToken(req.user.clerkId.toString());
  res.status(200).json(
    new ApiResponse(
      200,
      {
        token,
        userId: req.user.clerkId.toString(),
        userName: req.user.name,
        userImage: req.user.profileImage,
      },
      "Stream token generated successfully",
    ),
  );
});
