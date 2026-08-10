import type {
  ClientContactIdParam,
  ClientIdParam,
  ClientListQuery,
  CreateClientContactInput,
  CreateClientInput,
  UpdateClientContactInput,
  UpdateClientInput,
} from "@clientflow/contracts";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  clientService,
  type CrmActor,
} from "../services/client.service.js";
import { AppError } from "../utils/app-error.js";

function getActor(request: Request): CrmActor {
  const auth = request.auth;

  if (!auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication context is missing.",
    );
  }

  return {
    organizationId: auth.organizationId,
    role: auth.role,
    clientId: auth.clientId,
  };
}

export const clientController = {
  async list(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const query =
        response.locals.validatedQuery as ClientListQuery;

      const result = await clientService.listClients(
        actor,
        query,
      );

      response.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const { clientId } =
        response.locals.validatedParams as ClientIdParam;

      const client = await clientService.getClient(
        actor,
        clientId,
      );

      response.status(200).json({
        data: client,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const input = request.body as CreateClientInput;

      const client = await clientService.createClient(
        actor,
        input,
      );

      response.status(201).json({
        data: client,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const { clientId } =
        response.locals.validatedParams as ClientIdParam;

      const input = request.body as UpdateClientInput;

      const client = await clientService.updateClient(
        actor,
        clientId,
        input,
      );

      response.status(200).json({
        data: client,
      });
    } catch (error) {
      next(error);
    }
  },

  async listContacts(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const { clientId } =
        response.locals.validatedParams as ClientIdParam;

      const contacts =
        await clientService.listContacts(
          actor,
          clientId,
        );

      response.status(200).json({
        data: contacts,
      });
    } catch (error) {
      next(error);
    }
  },

  async createContact(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const { clientId } =
        response.locals.validatedParams as ClientIdParam;

      const input =
        request.body as CreateClientContactInput;

      const contact =
        await clientService.createContact(
          actor,
          clientId,
          input,
        );

      response.status(201).json({
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateContact(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const { clientId, contactId } =
        response.locals
          .validatedParams as ClientContactIdParam;

      const input =
        request.body as UpdateClientContactInput;

      const contact =
        await clientService.updateContact(
          actor,
          clientId,
          contactId,
          input,
        );

      response.status(200).json({
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteContact(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);

      const { clientId, contactId } =
        response.locals
          .validatedParams as ClientContactIdParam;

      await clientService.deleteContact(
        actor,
        clientId,
        contactId,
      );

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};