const express = require("express");
const router = express.Router();
const Question = require("../models/Question");
const TestAttempt = require("../models/TestAttempt");
const { protect } = require("../middleware/auth");

// ─── Helper: pick N random items from array ───────────────────────────────────
const pickRandom = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ─── Helper: calculate score ──────────────────────────────────────────────────
const calcScore = (questions, answers) => {
  let correct = 0;
  answers.forEach((ans) => {
    const q = questions.find((q) => q._id.toString() === ans.questionId.toString());
    if (q && ans.selectedOption !== null && ans.selectedOption === q.correct) {
      correct++;
    }
  });
  return {
    correct,
    total: questions.length,
    percentage: Math.round((correct / questions.length) * 100),
  };
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/test/check
// Check if the logged-in student has already taken the test
// ────────────────────────────────────────────────────────────────────────────
router.get("/check", protect, async (req, res) => {
  try {
    const attempt = await TestAttempt.findOne({ userId: req.user._id }).sort({ createdAt: -1 });

    if (!attempt) {
      return res.json({ success: true, hasAttempted: false, attempt: null });
    }

    if (attempt.status === "in_progress") {
      const elapsed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
      const remaining = Math.max(0, attempt.totalTimeSeconds - elapsed);

      // Auto-submit if time has expired
      if (remaining === 0) {
        attempt.status = "timed_out";
        attempt.submittedAt = new Date();
        attempt.timeSpentSeconds = attempt.totalTimeSeconds;
        const fullQuestions = await Question.find({ _id: { $in: attempt.questions } });
        attempt.score = calcScore(fullQuestions, attempt.answers);
        await attempt.save();

        return res.json({
          success: true,
          hasAttempted: true,
          status: "timed_out",
          attempt: formatAttemptResult(attempt),
        });
      }

      // Test still in progress — resume it
      return res.json({
        success: true,
        hasAttempted: true,
        status: "in_progress",
        remainingSeconds: remaining,
        attemptId: attempt._id,
      });
    }

    // Already submitted
    return res.json({
      success: true,
      hasAttempted: true,
      status: attempt.status,
      attempt: formatAttemptResult(attempt),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/test/start
// Assign 30 random questions and create a new attempt
// ────────────────────────────────────────────────────────────────────────────
router.post("/start", protect, async (req, res) => {
  try {
    // Block if already has a completed attempt
    const existing = await TestAttempt.findOne({
      userId: req.user._id,
      status: { $in: ["submitted", "auto_submitted", "timed_out"] },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already completed this test",
        attempt: formatAttemptResult(existing),
      });
    }

    // Resume in-progress attempt instead of creating a new one
    const inProgress = await TestAttempt.findOne({ userId: req.user._id, status: "in_progress" });
    if (inProgress) {
      const elapsed = Math.floor((Date.now() - new Date(inProgress.startedAt).getTime()) / 1000);
      const remaining = Math.max(0, inProgress.totalTimeSeconds - elapsed);

      if (remaining === 0) {
        inProgress.status = "timed_out";
        inProgress.submittedAt = new Date();
        const fullQuestions = await Question.find({ _id: { $in: inProgress.questions } });
        inProgress.score = calcScore(fullQuestions, inProgress.answers);
        await inProgress.save();

        return res.status(400).json({
          success: false,
          message: "Your previous attempt has timed out",
          attempt: formatAttemptResult(inProgress),
        });
      }

      // Fetch the questions without correct answers
      const questions = await Question.find({ _id: { $in: inProgress.questions } }).select("-correct");

      return res.json({
        success: true,
        message: "Resuming existing attempt",
        attemptId: inProgress._id,
        questions,
        answers: inProgress.answers,
        remainingSeconds: remaining,
        isResume: true,
      });
    }

    // Pick 10 easy + 12 medium + 8 hard (totaling 30) for balanced distribution
    const [easy, medium, hard] = await Promise.all([
      Question.find({ difficulty: "easy", isActive: true }).select("_id"),
      Question.find({ difficulty: "medium", isActive: true }).select("_id"),
      Question.find({ difficulty: "hard", isActive: true }).select("_id"),
    ]);

    const selectedIds = [
      ...pickRandom(easy, Math.min(10, easy.length)),
      ...pickRandom(medium, Math.min(12, medium.length)),
      ...pickRandom(hard, Math.min(8, hard.length)),
    ];

    // If not enough by difficulty, fill remaining randomly
    if (selectedIds.length < 30) {
      const usedIds = new Set(selectedIds.map((id) => id._id.toString()));
      const all = await Question.find({ isActive: true, _id: { $nin: Array.from(usedIds) } }).select("_id");
      const extra = pickRandom(all, 30 - selectedIds.length);
      selectedIds.push(...extra);
    }

    // Shuffle final order
    const finalIds = pickRandom(selectedIds, selectedIds.length).map((q) => q._id);

    const attempt = await TestAttempt.create({
      userId: req.user._id,
      questions: finalIds,
      answers: [],
      status: "in_progress",
    });

    const questions = await Question.find({ _id: { $in: finalIds } }).select("-correct");

    res.status(201).json({
      success: true,
      message: "Test started",
      attemptId: attempt._id,
      questions,
      remainingSeconds: attempt.totalTimeSeconds,
      isResume: false,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/test/:attemptId/autosave
// Called on tab close (visibilitychange / beforeunload) or periodic saves
// Body: { answers: [...], timeSpentSeconds, tabSwitchCount }
// ────────────────────────────────────────────────────────────────────────────
router.patch("/:attemptId/autosave", protect, async (req, res) => {
  try {
    const { answers, timeSpentSeconds, tabSwitchCount } = req.body;
    const attempt = await TestAttempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
      status: "in_progress",
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: "Active attempt not found" });
    }

    // Check if time expired
    const elapsed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    if (elapsed >= attempt.totalTimeSeconds) {
      attempt.status = "timed_out";
      attempt.submittedAt = new Date();
      attempt.timeSpentSeconds = attempt.totalTimeSeconds;
      if (answers) attempt.answers = answers;
      const fullQuestions = await Question.find({ _id: { $in: attempt.questions } });
      attempt.score = calcScore(fullQuestions, attempt.answers);
      await attempt.save();

      return res.json({ success: true, message: "Test auto-submitted due to timeout", status: "timed_out" });
    }

    if (answers) attempt.answers = answers;
    if (timeSpentSeconds !== undefined) attempt.timeSpentSeconds = timeSpentSeconds;
    if (tabSwitchCount !== undefined) attempt.tabSwitchCount = tabSwitchCount;
    attempt.lastAutoSaveAt = new Date();

    await attempt.save();

    res.json({ success: true, message: "Progress saved", savedAt: attempt.lastAutoSaveAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/test/:attemptId/submit
// Final submission by student
// Body: { answers: [...], timeSpentSeconds }
// ────────────────────────────────────────────────────────────────────────────
router.post("/:attemptId/submit", protect, async (req, res) => {
  try {
    const { answers, timeSpentSeconds } = req.body;
    const attempt = await TestAttempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }

    if (attempt.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Test already submitted",
        attempt: formatAttemptResult(attempt),
      });
    }

    attempt.answers = answers || attempt.answers;
    attempt.timeSpentSeconds = timeSpentSeconds || attempt.timeSpentSeconds;
    attempt.status = "submitted";
    attempt.submittedAt = new Date();

    // Calculate score using actual correct answers
    const fullQuestions = await Question.find({ _id: { $in: attempt.questions } });
    attempt.score = calcScore(fullQuestions, attempt.answers);

    // Mark each answer as correct/incorrect
    attempt.answers = attempt.answers.map((ans) => {
      const q = fullQuestions.find((q) => q._id.toString() === ans.questionId.toString());
      return {
        ...ans,
        isCorrect: q && ans.selectedOption !== null ? ans.selectedOption === q.correct : false,
      };
    });

    await attempt.save();

    res.json({
      success: true,
      message: "Test submitted successfully",
      result: formatAttemptResult(attempt),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/test/:attemptId/result
// Get result for a completed attempt (student can view their own)
// ────────────────────────────────────────────────────────────────────────────
router.get("/:attemptId/result", protect, async (req, res) => {
  try {
    const attempt = await TestAttempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
    }).populate("questions", "question options correct category difficulty");

    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }

    if (attempt.status === "in_progress") {
      return res.status(400).json({ success: false, message: "Test not yet submitted" });
    }

    res.json({ success: true, result: attempt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Format helper ────────────────────────────────────────────────────────────
function formatAttemptResult(attempt) {
  return {
    attemptId: attempt._id,
    status: attempt.status,
    score: attempt.score,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeSpentSeconds: attempt.timeSpentSeconds,
    tabSwitchCount: attempt.tabSwitchCount,
  };
}

module.exports = router;