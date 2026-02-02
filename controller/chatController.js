import { chatClient } from "../lib/stream.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export const getStreamToken = asyncHandler((req, res) => {
  try {
    const token = chatClient.createToken(req.user._id.toString());
    res.status(200).json(
      new ApiResponse(
        200,
        {
          token,
          userId: req.user._id.toString(),
          userName: req.user.name,
          userImage: req.user.image,
        },
        "Stream token generated successfully",
      ),
    );
  } catch (error) {
    console.log("Error in getStreamToken controller:", error.message);
    throw new ApiError(500, "Internal Server Error");
  }
});
