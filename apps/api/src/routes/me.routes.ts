import { Router } from "express";

import { getMe } from "../controllers/me.controller.js";
import { requireApiAuth } from "../middlewares/api-auth.middleware.js";

export const meRouter = Router();

meRouter.get("/", requireApiAuth, getMe);
