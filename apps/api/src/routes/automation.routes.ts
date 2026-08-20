import { Router } from "express";
import { automationController } from "../controllers/automation.controller.js";

const router = Router();

router.get("/", automationController.list);
router.post("/", automationController.create);

export default router;
