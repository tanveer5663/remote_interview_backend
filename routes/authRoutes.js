import express from "express";
import {
  signup,
  login,
  logout,
  checkAuth,
} from "../controller/authController.js";
import { verifyJWT } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.get("/check-auth", verifyJWT, checkAuth);
export default router;
