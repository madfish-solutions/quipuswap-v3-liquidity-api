import express from "express";
import { getLiquidityItems } from "./stats";
import { port } from "./config";

export function bootstrapApp() {
  console.info("bootstrapping app...");

  const app = express();

  app.get("/stats", async (_, res) => {
    const items = await getLiquidityItems();
    res.send(items).status(200);
  });

  app.listen(port, () => {
    console.info(`app listening on port ${port}`);
  });
}
