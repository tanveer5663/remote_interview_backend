import express from "express";
import { ENV } from "./lib/env.js";

const app = express();
const port = ENV.PORT || 6000;

app.get("/", (req, res) => res.send("Hello World" + port));
app.listen(port, () => console.log("server is running"));
