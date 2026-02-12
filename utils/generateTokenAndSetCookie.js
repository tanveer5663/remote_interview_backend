import jwt from "jsonwebtoken";
import { ENV } from "../lib/env.js";

export const generateTokenAndSetCookie = (res, userId) => {
  const token = jwt.sign({ userId }, ENV.JWT_SECRET, {
    expiresIn: "7d",
  });
  console.log("userId for token:", userId);
  console.log("token generated:", token);

  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
   
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};
