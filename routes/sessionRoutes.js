import express from "express";
import { verifyJWT } from "../middleware/auth.js";
import { createSession } from "../controller/sessionController.js";
const router = express.Router();

router.get("/", verifyJWT, createSession);
export default router;
