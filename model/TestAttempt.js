import mongoose from "mongoose";
const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedOption: {
      type: Number, // index 0-3, null if not answered
      default: null,
    },
    isSkipped: {
      type: Boolean,
      default: false,
    },
    isCorrect: {
      type: Boolean,
      default: null,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const testAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ], // The 30 random questions assigned to this student
    answers: [answerSchema],
    status: {
      type: String,
      enum: ["in_progress", "submitted", "auto_submitted", "timed_out"],
      default: "in_progress",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    totalTimeSeconds: {
      type: Number,
      default: 30 * 60, // 30 minutes
    },
    score: {
      correct: { type: Number, default: 0 },
      total: { type: Number, default: 30 },
      percentage: { type: Number, default: 0 },
    },
    tabSwitchCount: {
      type: Number,
      default: 0,
    },
    lastAutoSaveAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Index so we can quickly check if a user already attempted
testAttemptSchema.index({ userId: 1 });
testAttemptSchema.index({ userId: 1, status: 1 });

const testAttemptModel = mongoose.model("TestAttempt", testAttemptSchema);
export default testAttemptModel;
