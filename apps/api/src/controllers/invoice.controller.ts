import type {
  CreateInvoiceDraftInput,
  InvoiceIdParam,
  InvoiceListQuery,
  UpdateInvoiceDraftInput,
  UpdateInvoiceSettingsInput,
} from "@clientflow/contracts";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  invoiceService,
} from "../services/invoice.service.js";
import type { ProjectActor } from "../services/project.service.js";
import { AppError } from "../utils/app-error.js";

function getActor(
  request: Request,
): ProjectActor {
  const auth = request.auth;

  if (!auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication context is missing.",
    );
  }

  return {
    userId: auth.userId,
    membershipId: auth.membershipId,
    organizationId:
      auth.organizationId,
    role: auth.role,
    clientId: auth.clientId,
  };
}

export const invoiceController = {
  async settings(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await invoiceService.settings(
            getActor(request),
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async updateSettings(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await invoiceService.updateSettings(
            getActor(request),
            request.body as UpdateInvoiceSettingsInput,
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async list(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await invoiceService.list(
            getActor(request),
            response.locals
              .validatedQuery as InvoiceListQuery,
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async get(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      response.status(200).json({
        data:
          await invoiceService.get(
            getActor(request),
            invoiceId,
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async pdf(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      const pdf =
        await invoiceService.pdf(
          getActor(request),
          invoiceId,
        );

      response.status(200);
      response.setHeader(
        "Content-Type",
        pdf.contentType,
      );
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${pdf.filename}"`,
      );
      response.setHeader(
        "Cache-Control",
        "private, no-store",
      );
      response.setHeader(
        "Content-Length",
        String(pdf.buffer.length),
      );
      response.end(pdf.buffer);
    } catch (error) {
      next(error);
    }
  },

  async createDraft(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(201).json({
        data:
          await invoiceService.createDraft(
            getActor(request),
            request.body as CreateInvoiceDraftInput,
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async updateDraft(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      response.status(200).json({
        data:
          await invoiceService.updateDraft(
            getActor(request),
            invoiceId,
            request.body as UpdateInvoiceDraftInput,
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteDraft(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      await invoiceService.deleteDraft(
        getActor(request),
        invoiceId,
      );

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async finalize(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      response.status(200).json({
        data:
          await invoiceService.finalize(
            getActor(request),
            invoiceId,
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async void(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      response.status(200).json({
        data:
          await invoiceService.void(
            getActor(request),
            invoiceId,
          ),
      });
    } catch (error) {
      next(error);
    }
  },
};
