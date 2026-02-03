import express from "express";
import { verifyJWT } from "../middleware/auth.js";
import {
  createSession,
  getActiveSessions,
  getMyRecentSessions,
  getSessionById,
  joinSession,
  endSession,
} from "../controller/sessionController.js";
const router = express.Router();

router.post("/", verifyJWT, createSession);
router.get("/active", verifyJWT, getActiveSessions);
router.get("/my-recent", verifyJWT, getMyRecentSessions);
router.get("/:id", verifyJWT, getSessionById);
router.post("/:id/join", verifyJWT, joinSession);
router.post("/:id/end", verifyJWT, endSession);
export default router;
