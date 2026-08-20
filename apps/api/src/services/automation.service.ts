import { automationRepository } from "../models/repositories/automation.repository.js";

export const automationService = {
  list(organizationId: string) {
    return automationRepository.list(organizationId);
  },

  create(input: any) {
    return automationRepository.create(input);
  },

  async execute(event: {
    type: string;
    organizationId: string;
    payload?: unknown;
  }) {
    // Execution engine connects existing:
    // notificationService
    // activityService
    // email queue
    //
    // Future actions are intentionally isolated here.
    console.log("[automation]", event.type);
  },
};
