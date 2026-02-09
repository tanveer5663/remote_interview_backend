import Session from "../model/Session.js";
import { chatClient, streamClient } from "../lib/stream.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export const createSession = asyncHandler(async (req, res) => {
  const { problem, difficulty } = req.body;
  const userId = req.user._id;
   const clerkId = req.user.clerkId;

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
      created_by_id: clerkId,
      custom: { problem, difficulty, sessionId: session._id.toString() },
    },
  });

  // chat messaging
  const channel = chatClient.channel("messaging", callId, {
    name: `${problem} Session`,
    created_by_id: clerkId,
    members: [clerkId],
  });

  await channel.create();

  res
    .status(201)
    .json(new ApiResponse(201, session, "Session created successfully"));
});

export const getActiveSessions = asyncHandler(async (_, res) => {
  const sessions = await Session.find({ status: "active" })
    .populate("host", "name profileImage email clerkId")
    .populate("participant", "name profileImage email clerkId")
    .sort({ createdAt: -1 })
    .limit(20);

  res
    .status(200)
    .json(
      new ApiResponse(200, sessions, "Active sessions fetched successfully"),
    );
});

export const getMyRecentSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // get sessions where user is either host or participant
  const sessions = await Session.find({
    status: "completed",
    $or: [{ host: userId }, { participant: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(20);

  res
    .status(200)
    .json(
      new ApiResponse(200, sessions, "Recent sessions fetched successfully"),
    );
});

export const getSessionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await Session.findById(id)
    .populate("host", "name email profileImage clerkId")
    .populate("participant", "name email profileImage clerkId");

  if (!session) {
    throw new ApiError(404, "Session not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, session, "Session fetched successfully"));
});

export const joinSession = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const clerkId = req.user.clerkId;

  const session = await Session.findById(id);

  if (!session) throw new ApiError(404, "Session not found");

  if (session.status !== "active") {
    throw new ApiError(400, "Cannot join a completed session");
  }

  if (session.host.toString() === userId.toString()) {
    throw new ApiError(
      400,
      "Host cannot join their own session as participant",
    );
  }

  // check if session is already full - has a participant
  if (session.participant) throw new ApiError(409, "Session is full");

  session.participant = userId;
  await session.save();

  const channel = chatClient.channel("messaging", session.callId);
  await channel.addMembers([clerkId]);

  res
    .status(200)
    .json(new ApiResponse(200, session, "Joined session successfully"));
};

export const endSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const session = await Session.findById(id);

  if (!session) {
    throw new ApiError(404, "Session not found");
  }

  // check if user is the host
  if (session.host.toString() !== userId.toString()) {
    throw new ApiError(403, "Only the host can end the session");
  }

  // check if session is already completed
  if (session.status === "completed") {
    throw new ApiError(400, "Session is already completed");
  }

  // delete stream video call
  const call = streamClient.video.call("default", session.callId);
  await call.delete({ hard: true });

  // delete stream chat channel
  const channel = chatClient.channel("messaging", session.callId);
  await channel.delete();

  session.status = "completed";
  await session.save();

  res
    .status(200)
    .json(new ApiResponse(200, session, "Session ended successfully"));
});
