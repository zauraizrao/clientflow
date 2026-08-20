import { automationService } from "../services/automation.service.js";

export const automationController = {
  async list(req: any, res: any) {
    const data = await automationService.list(
      req.user.organizationId,
    );

    res.json({ data });
  },

  async create(req: any, res: any) {
    const data = await automationService.create({
      organizationId: req.user.organizationId,
      ...req.body,
    });

    res.json({ data });
  },
};
