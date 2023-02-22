import express from "express";
import { getLiquidityItems } from "./stats";

export function bootstrapApp() {
  console.info("bootstrapping app...");

  const app = express();

  app.get("/stats", async (_, res) => {
    const items = await getLiquidityItems();
    res.send(items).status(200);
  });

  app.listen(3000, () => {
    console.info("app listening on port 3000!");
  });
}
