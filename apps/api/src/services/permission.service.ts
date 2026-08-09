import { authRepository } from "../models/repositories/auth.repository.js";
import { AppError } from "../utils/app-error.js";

export const permissionService = {
  async resolveRequestContext(userId: string, organizationId: string) {
    const membership = await authRepository.findMembership(
      userId,
      organizationId,
    );

    if (!membership) {
      throw new AppError(
        403,
        "ORGANIZATION_ACCESS_DENIED",
        "Your account does not have access to this organization.",
      );
    }

    return {
      userId,
      membershipId: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      clientId: membership.clientId,
    };
  },
};
