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
    },
    role:{
      type: String,
      enum: ["user", "admin"],
      default: "user",
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
      default: "",
    },
  },
  { timestamps: true }, // createdAt, updatedAt
);

const User = mongoose.model("User", userSchema);

export default User;
