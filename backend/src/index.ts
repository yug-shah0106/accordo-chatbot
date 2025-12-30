import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { dealsRouter } from "./routes/deals";
import { vendorSimRouter } from "./routes/vendorSim";
import { convoRouter } from "./convo/convoRouter";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => res.json({
  name: "Accordo API",
  version: "1.0.0",
  endpoints: {
    health: "/health",
    deals: "/api/deals",
    conversation: "/api/convo/deals/:dealId"
  }
}));
app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api", dealsRouter);
app.use("/api", vendorSimRouter);
app.use("/api/convo", convoRouter);

app.listen(process.env.PORT || 4000, () => {
  console.log(`✅ Backend running on http://localhost:${process.env.PORT || 4000}`);
});

