import express from "express";
import {
  checkTestAttempt,
  TestStart,
  autoSave,
  submitTest,
  result,
} from "../controller/testController.js";
import { verifyJWT } from "../middleware/auth.js";
verifyJWT;
const router = express.Router();

router.get("/check", verifyJWT, checkTestAttempt);
router.get("/start", verifyJWT, TestStart);
router.patch("/:attemptId/autosave", verifyJWT, autoSave);
router.post("/:attemptId/submit", verifyJWT, submitTest);
router.get("/:attemptId/result", verifyJWT, result);
export default router;
