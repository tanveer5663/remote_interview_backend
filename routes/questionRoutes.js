import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { questionAddController } from "../controller/questionAddController.js";

const router = Router();

router.post("/bulk",questionAddController);
// router.post("")

export default router;
