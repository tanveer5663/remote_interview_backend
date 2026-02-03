import express from "express";
import { verifyJWT } from "../middleware/auth.js";
import { getStreamToken } from "../controller/chatController.js";

const router = express.Router();

router.get("/token", verifyJWT, getStreamToken);

export default router;
