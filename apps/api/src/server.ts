import { app } from "./app.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";
import { closeBackgroundQueue } from "./queues/background.queue.js";

const server = app.listen(env.PORT, () => {
  console.log(`ClientFlow API running at http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received. Shutting down.`);

  server.close(async () => {
    await closeBackgroundQueue();

    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
