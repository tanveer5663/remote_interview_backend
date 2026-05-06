import TestAttempt from "../model/TestAttempt.js";
import Question from "../model/Questions.js";
export const checkTestAttempt = async (req, res) => {
  try {
    const attempt = await TestAttempt.findOne({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    console.log(attempt);

    if (!attempt) {
      return res.json({ success: true, hasAttempted: false, attempt: null });
    }

    if (attempt.status === "in_progress") {
      const elapsed = Math.floor(
        (Date.now() - new Date(attempt.startedAt).getTime()) / 1000,
      );
      const remaining = Math.max(0, attempt.totalTimeSeconds - elapsed);

      // Auto-submit if time has expired
      if (remaining === 0) {
        attempt.status = "timed_out";
        attempt.submittedAt = new Date();
        attempt.timeSpentSeconds = attempt.totalTimeSeconds;
        const fullQuestions = await Question.find({
          _id: { $in: attempt.questions },
        });
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
};
export const TestStart = async (req, res) => {
  try {
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
    const inProgress = await TestAttempt.findOne({
      userId: req.user._id,
      status: "in_progress",
    });

    if (inProgress) {
      const elapsed = Math.floor(
        (Date.now() - new Date(inProgress.startedAt).getTime()) / 1000,
      );
      const remaining = Math.max(0, inProgress.totalTimeSeconds - elapsed);

      if (remaining === 0) {
        inProgress.status = "timed_out";
        inProgress.submittedAt = new Date();
        const fullQuestions = await Question.find({
          _id: { $in: inProgress.questions },
        });
        inProgress.score = calcScore(fullQuestions, inProgress.answers);
        await inProgress.save();

        return res.status(400).json({
          success: false,
          message: "Your previous attempt has timed out",
          attempt: formatAttemptResult(inProgress),
        });
      }

      // Fetch the questions without correct answers
      const questions = await Question.find({
        _id: { $in: inProgress.questions },
      }).select("-correct");

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

    const randomQuestions = await Question.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: 30 } },
    ]);

    const finalIds = randomQuestions.map((q) => q._id);
    console.log(req.user);

    const attempt = await TestAttempt.create({
      userId: req.user._id,
      questions: finalIds,
      answers: [],
      status: "in_progress",
    });
    console.log(attempt);

    const questions = await Question.find({ _id: { $in: finalIds } }).select(
      "-correct",
    );

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
};

export const autoSave = async (req, res) => {
  try {
    const { answers, timeSpentSeconds, tabSwitchCount } = req.body;
    const attempt = await TestAttempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
      status: "in_progress",
    });

    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Active attempt not found" });
    }

    // Check if time expired
    const elapsed = Math.floor(
      (Date.now() - new Date(attempt.startedAt).getTime()) / 1000,
    );
    if (elapsed >= attempt.totalTimeSeconds) {
      attempt.status = "timed_out";
      attempt.submittedAt = new Date();
      attempt.timeSpentSeconds = attempt.totalTimeSeconds;
      if (answers) attempt.answers = answers;
      const fullQuestions = await Question.find({
        _id: { $in: attempt.questions },
      });
      attempt.score = calcScore(fullQuestions, attempt.answers);
      await attempt.save();

      return res.json({
        success: true,
        message: "Test auto-submitted due to timeout",
        status: "timed_out",
      });
    }

    if (answers) attempt.answers = answers;
    if (timeSpentSeconds !== undefined)
      attempt.timeSpentSeconds = timeSpentSeconds;
    if (tabSwitchCount !== undefined) attempt.tabSwitchCount = tabSwitchCount;
    attempt.lastAutoSaveAt = new Date();

    await attempt.save();

    res.json({
      success: true,
      message: "Progress saved",
      savedAt: attempt.lastAutoSaveAt,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
export const submitTest = async (req, res) => {
  try {
    const { answers, timeSpentSeconds } = req.body;
    const attempt = await TestAttempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
    });

    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
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
    const fullQuestions = await Question.find({
      _id: { $in: attempt.questions },
    });
    attempt.score = calcScore(fullQuestions, attempt.answers);

    // Mark each answer as correct/incorrect
    attempt.answers = attempt.answers.map((ans) => {
      const q = fullQuestions.find(
        (q) => q._id.toString() === ans.questionId.toString(),
      );
      return {
        ...ans,
        isCorrect:
          q && ans.selectedOption !== null
            ? ans.selectedOption === q.correct
            : false,
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
};
export const result = async (req, res) => {
  try {
    const attempt = await TestAttempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
    }).populate("questions", "question options correct category difficulty");

    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    }

    if (attempt.status === "in_progress") {
      return res
        .status(400)
        .json({ success: false, message: "Test not yet submitted" });
    }

    res.json({ success: true, result: attempt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const calcScore = (questions, answers) => {
  let correct = 0;
  answers.forEach((ans) => {
    const q = questions.find(
      (q) => q._id.toString() === ans.questionId.toString(),
    );
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
