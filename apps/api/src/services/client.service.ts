import type {
  ClientContactDto,
  ClientDetailDto,
  ClientDto,
  ClientListItemDto,
  ClientListQuery,
  ClientListResponse,
  CreateClientContactInput,
  CreateClientInput,
  OrganizationRole,
  UpdateClientContactInput,
  UpdateClientInput,
} from "@clientflow/contracts";

import {
  clientRepository,
  type ClientDetailRow,
  type ClientListRow,
} from "../models/repositories/client.repository.js";
import { AppError } from "../utils/app-error.js";

export type CrmActor = {
  organizationId: string;
  role: OrganizationRole;
  clientId: string | null;
};

type ClientRecord = {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

type ContactRecord = {
  id: string;
  clientId: string;
  organizationId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  notes: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toClientDto(client: ClientRecord): ClientDto {
  return {
    id: client.id,
    organizationId: client.organizationId,
    name: client.name,
    email: client.email,
    phone: client.phone,
    website: client.website,
    industry: client.industry,
    description: client.description,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

function toContactDto(
  contact: ContactRecord,
): ClientContactDto {
  return {
    id: contact.id,
    clientId: contact.clientId,
    organizationId: contact.organizationId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    notes: contact.notes,
    isPrimary: contact.isPrimary,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

function toClientListItemDto(
  client: ClientListRow,
): ClientListItemDto {
  return {
    ...toClientDto(client),

    primaryContact:
      client.contacts[0]
        ? toContactDto(client.contacts[0])
        : null,

    contactCount: client._count.contacts,
    projectCount: client._count.projects,
  };
}

function toClientDetailDto(
  client: ClientDetailRow,
): ClientDetailDto {
  return {
    ...toClientDto(client),

    contacts: client.contacts.map((contact) =>
      toContactDto(contact),
    ),
  };
}

function assertWritePermission(actor: CrmActor): void {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "MANAGER"
  ) {
    throw new AppError(
      403,
      "INSUFFICIENT_PERMISSION",
      "Your role does not allow CRM changes.",
    );
  }
}

function getClientScope(
  actor: CrmActor,
): string | undefined {
  if (actor.role !== "CLIENT") {
    return undefined;
  }

  if (!actor.clientId) {
    throw new AppError(
      403,
      "CLIENT_SCOPE_MISSING",
      "This client account is not linked to a client record.",
    );
  }

  return actor.clientId;
}

function assertClientAccess(
  actor: CrmActor,
  clientId: string,
): void {
  if (actor.role !== "CLIENT") {
    return;
  }

  if (!actor.clientId) {
    throw new AppError(
      403,
      "CLIENT_SCOPE_MISSING",
      "This client account is not linked to a client record.",
    );
  }

  if (actor.clientId !== clientId) {
    throw new AppError(
      404,
      "CLIENT_NOT_FOUND",
      "Client not found.",
    );
  }
}

function clientNotFound(): AppError {
  return new AppError(
    404,
    "CLIENT_NOT_FOUND",
    "Client not found.",
  );
}

function contactNotFound(): AppError {
  return new AppError(
    404,
    "CLIENT_CONTACT_NOT_FOUND",
    "Client contact not found.",
  );
}

export const clientService = {
  async listClients(
    actor: CrmActor,
    query: ClientListQuery,
  ): Promise<ClientListResponse> {
    const scopedClientId = getClientScope(actor);

    const result = await clientRepository.listClients(
      actor.organizationId,
      query,
      scopedClientId,
    );

    const totalPages =
      result.total === 0
        ? 0
        : Math.ceil(result.total / query.pageSize);

    return {
      items: result.clients.map(toClientListItemDto),

      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  },

  async getClient(
    actor: CrmActor,
    clientId: string,
  ): Promise<ClientDetailDto> {
    assertClientAccess(actor, clientId);

    const client =
      await clientRepository.findClientById(
        actor.organizationId,
        clientId,
      );

    if (!client) {
      throw clientNotFound();
    }

    return toClientDetailDto(client);
  },

  async createClient(
    actor: CrmActor,
    input: CreateClientInput,
  ): Promise<ClientDto> {
    assertWritePermission(actor);

    const client = await clientRepository.createClient(
      actor.organizationId,
      input,
    );

    return toClientDto(client);
  },

  async updateClient(
    actor: CrmActor,
    clientId: string,
    input: UpdateClientInput,
  ): Promise<ClientDto> {
    assertWritePermission(actor);

    const client = await clientRepository.updateClient(
      actor.organizationId,
      clientId,
      input,
    );

    if (!client) {
      throw clientNotFound();
    }

    return toClientDto(client);
  },

  async listContacts(
    actor: CrmActor,
    clientId: string,
  ): Promise<ClientContactDto[]> {
    assertClientAccess(actor, clientId);

    const client =
      await clientRepository.findClientById(
        actor.organizationId,
        clientId,
      );

    if (!client) {
      throw clientNotFound();
    }

    const contacts =
      await clientRepository.listContacts(
        actor.organizationId,
        clientId,
      );

    return contacts.map(toContactDto);
  },

  async createContact(
    actor: CrmActor,
    clientId: string,
    input: CreateClientContactInput,
  ): Promise<ClientContactDto> {
    assertWritePermission(actor);

    const contact =
      await clientRepository.createContact(
        actor.organizationId,
        clientId,
        input,
      );

    if (!contact) {
      throw clientNotFound();
    }

    return toContactDto(contact);
  },

  async updateContact(
    actor: CrmActor,
    clientId: string,
    contactId: string,
    input: UpdateClientContactInput,
  ): Promise<ClientContactDto> {
    assertWritePermission(actor);

    const contact =
      await clientRepository.updateContact(
        actor.organizationId,
        clientId,
        contactId,
        input,
      );

    if (!contact) {
      throw contactNotFound();
    }

    return toContactDto(contact);
  },

  async deleteContact(
    actor: CrmActor,
    clientId: string,
    contactId: string,
  ): Promise<void> {
    assertWritePermission(actor);

    const deleted =
      await clientRepository.deleteContact(
        actor.organizationId,
        clientId,
        contactId,
      );

    if (!deleted) {
      throw contactNotFound();
    }
  },
};