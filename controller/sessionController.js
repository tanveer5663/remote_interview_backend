import Session from "../model/Session.js";
import { chatClient, streamClient } from "../lib/stream.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
export const createSession = asyncHandler(async (req, res) => {
  try {
    const { problem, difficulty } = req.body;
    const userId = req.user._id;

    if (!problem || !difficulty) {
      throw new ApiError(400, "Problem and difficulty are required");
    }

    // generate a unique call id for stream video
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // create session in db
    const session = await Session.create({
      problem,
      difficulty,
      host: userId,
      callId,
    });

    // create stream video call
    await streamClient.video.call("default", callId).getOrCreate({
      data: {
        created_by_id: userId,
        custom: { problem, difficulty, sessionId: session._id.toString() },
      },
    });

    // chat messaging
    const channel = chatClient.channel("messaging", callId, {
      name: `${problem} Session`,
      created_by_id: userId,
      members: [userId],
    });

    await channel.create();

    res
      .status(201)
      .json(new ApiResponse(201, session, "Session created successfully"));
  } catch (error) {
    console.log("Error in createSession controller:", error.message);
    throw new ApiError(500, "Failed to create session");
  }
});
