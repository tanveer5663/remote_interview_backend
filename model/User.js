import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    profileImage: {
      type: String,
      default: "",
    },
    clerkId: {
      type: String,

      unique: true,
    },
  },
  { timestamps: true }, // createdAt, updatedAt
);

const User = mongoose.model("User", userSchema);

export default User;
