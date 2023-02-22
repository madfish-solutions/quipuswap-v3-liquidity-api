import { bootstrapApp } from "./app";
import { getLiquidityItems } from "./stats";

(async () => {
  const items = await getLiquidityItems();
  console.info("cache warm up finished with ", items.length, " items 🔮");

  bootstrapApp();
})().catch((err) => {
  console.error(err);
});
