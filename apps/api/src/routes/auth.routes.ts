import { Router } from "express";

import { loginSchema, registerSchema } from "@clientflow/contracts";

import {
  bootstrapOrganization,
  getBridgeMembershipContext,
  getBridgeUserContext,
  registerCredentials,
  syncGoogleUser,
  verifyCredentials,
} from "../controllers/auth.controller.js";
import { requireAuthBridge } from "../middlewares/bridge-auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  bootstrapOrganizationBridgeSchema,
  googleBridgeSchema,
  membershipContextBridgeSchema,
  userContextBridgeSchema,
} from "../utils/auth.schemas.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  validateBody(registerSchema),
  registerCredentials,
);

authRouter.post(
  "/bridge/credentials",
  requireAuthBridge,
  validateBody(loginSchema),
  verifyCredentials,
);

authRouter.post(
  "/bridge/google",
  requireAuthBridge,
  validateBody(googleBridgeSchema),
  syncGoogleUser,
);

authRouter.post(
  "/bridge/user-context",
  requireAuthBridge,
  validateBody(userContextBridgeSchema),
  getBridgeUserContext,
);

authRouter.post(
  "/bridge/membership-context",
  requireAuthBridge,
  validateBody(membershipContextBridgeSchema),
  getBridgeMembershipContext,
);

authRouter.post(
  "/bridge/bootstrap-organization",
  requireAuthBridge,
  validateBody(bootstrapOrganizationBridgeSchema),
  bootstrapOrganization,
);
