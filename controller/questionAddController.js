import { asyncHandler } from "../utils/asyncHandler.js";
import Question from "../model/Questions.js";
import { LOGIC_QUESTIONS } from "./qustion.js";

export const questionAddController = asyncHandler(async (req, res) => {
  try {
    const seed = async () => {
      const existing = await Question.countDocuments();
      if (existing > 0) {
        console.log(`⚠️  ${existing} questions already exist. Skipping seed.`);
        console.log("   To re-seed, drop the questions collection first.");
        process.exit(0);
       return  res.status(400).json({
          success: false,
          message: "Questions already exist. Seed skipped.",
        });
      }

      const inserted = await Question.insertMany(LOGIC_QUESTIONS);
      console.log(`✅ Seeded ${inserted.length} questions successfully`);
      res.status(200).json({
        success: true,
        message: `Seeded ${inserted.length} questions successfully`,
      });
    };

    seed();
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
