import { Router } from "express";

import { authRouter } from "./auth.routes.js";
import { clientRouter } from "./client.routes.js";
import { collaborationRouter } from "./collaboration.routes.js";
import { healthRouter } from "./health.routes.js";
import { meRouter } from "./me.routes.js";
import { notificationRouter } from "./notification.routes.js";
import { projectRouter } from "./project.routes.js";
import { rbacRouter } from "./rbac.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/rbac", rbacRouter);
apiRouter.use("/notifications", notificationRouter);

apiRouter.use("/clients", clientRouter);
apiRouter.use("/projects", projectRouter);
apiRouter.use("/projects", collaborationRouter);
