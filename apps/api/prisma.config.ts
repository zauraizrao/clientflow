import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "src/models/prisma/schema.prisma",
  migrations: {
    path: "src/models/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
