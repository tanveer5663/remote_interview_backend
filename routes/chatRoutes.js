import express from "express";
import { verifyJWT } from "../middleware/auth.js";
import { getStreamToken } from "../controller/chatController.js";

const router = express.Router();
// Define your chat routes here
router.get("/token", verifyJWT, getStreamToken);

export default router;
