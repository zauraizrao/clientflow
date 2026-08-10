import type {
  ClientListQuery,
  CreateClientContactInput,
  CreateClientInput,
  UpdateClientContactInput,
  UpdateClientInput,
} from "@clientflow/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

const clientListInclude = {
  contacts: {
    where: {
      isPrimary: true,
    },
    orderBy: {
      createdAt: "asc" as const,
    },
    take: 1,
  },

  _count: {
    select: {
      contacts: true,
      projects: true,
    },
  },
} satisfies Prisma.ClientInclude;

const clientDetailInclude = {
  contacts: {
    orderBy: [
      {
        isPrimary: "desc" as const,
      },
      {
        firstName: "asc" as const,
      },
      {
        lastName: "asc" as const,
      },
    ],
  },
} satisfies Prisma.ClientInclude;

export type ClientListRow = Prisma.ClientGetPayload<{
  include: typeof clientListInclude;
}>;

export type ClientDetailRow = Prisma.ClientGetPayload<{
  include: typeof clientDetailInclude;
}>;

function buildClientWhere(
  organizationId: string,
  query: ClientListQuery,
  scopedClientId?: string,
): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {
    organizationId,
  };

  if (scopedClientId) {
    where.id = scopedClientId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.industry) {
    where.industry = {
      equals: query.industry,
      mode: "insensitive",
    };
  }

  if (query.search) {
    const search = query.search;

    where.OR = [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        phone: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        website: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        industry: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        contacts: {
          some: {
            OR: [
              {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                jobTitle: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      },
    ];
  }

  return where;
}

function buildClientOrderBy(
  query: ClientListQuery,
): Prisma.ClientOrderByWithRelationInput {
  switch (query.sortBy) {
    case "name":
      return {
        name: query.sortOrder,
      };

    case "createdAt":
      return {
        createdAt: query.sortOrder,
      };

    case "updatedAt":
    default:
      return {
        updatedAt: query.sortOrder,
      };
  }
}

export const clientRepository = {
  async listClients(
    organizationId: string,
    query: ClientListQuery,
    scopedClientId?: string,
  ) {
    const where = buildClientWhere(
      organizationId,
      query,
      scopedClientId,
    );

    const orderBy = buildClientOrderBy(query);

    const skip = (query.page - 1) * query.pageSize;

    const [clients, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        include: clientListInclude,
        orderBy,
        skip,
        take: query.pageSize,
      }),

      prisma.client.count({
        where,
      }),
    ]);

    return {
      clients,
      total,
    };
  },

  findClientById(
    organizationId: string,
    clientId: string,
  ): Promise<ClientDetailRow | null> {
    return prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },

      include: clientDetailInclude,
    });
  },

  createClient(
    organizationId: string,
    input: CreateClientInput,
  ) {
    return prisma.client.create({
      data: {
        organizationId,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        industry: input.industry ?? null,
        description: input.description ?? null,
        status: input.status,
      },
    });
  },

  async updateClient(
    organizationId: string,
    clientId: string,
    input: UpdateClientInput,
  ) {
    const data: Prisma.ClientUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.email !== undefined) {
      data.email = input.email;
    }

    if (input.phone !== undefined) {
      data.phone = input.phone;
    }

    if (input.website !== undefined) {
      data.website = input.website;
    }

    if (input.industry !== undefined) {
      data.industry = input.industry;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.client.findFirst({
        where: {
          id: clientId,
          organizationId,
        },

        select: {
          id: true,
        },
      });

      if (!existing) {
        return null;
      }

      return tx.client.update({
        where: {
          id: clientId,
        },

        data,
      });
    });
  },

  listContacts(
    organizationId: string,
    clientId: string,
  ) {
    return prisma.clientContact.findMany({
      where: {
        organizationId,
        clientId,
      },

      orderBy: [
        {
          isPrimary: "desc",
        },
        {
          firstName: "asc",
        },
        {
          lastName: "asc",
        },
      ],
    });
  },

  async createContact(
    organizationId: string,
    clientId: string,
    input: CreateClientContactInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: {
          id: clientId,
          organizationId,
        },

        select: {
          id: true,
        },
      });

      if (!client) {
        return null;
      }

      if (input.isPrimary) {
        await tx.clientContact.updateMany({
          where: {
            organizationId,
            clientId,
            isPrimary: true,
          },

          data: {
            isPrimary: false,
          },
        });
      }

      return tx.clientContact.create({
        data: {
          organizationId,
          clientId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          jobTitle: input.jobTitle ?? null,
          notes: input.notes ?? null,
          isPrimary: input.isPrimary,
        },
      });
    });
  },

  async updateContact(
    organizationId: string,
    clientId: string,
    contactId: string,
    input: UpdateClientContactInput,
  ) {
    const data: Prisma.ClientContactUpdateInput = {};

    if (input.firstName !== undefined) {
      data.firstName = input.firstName;
    }

    if (input.lastName !== undefined) {
      data.lastName = input.lastName;
    }

    if (input.email !== undefined) {
      data.email = input.email;
    }

    if (input.phone !== undefined) {
      data.phone = input.phone;
    }

    if (input.jobTitle !== undefined) {
      data.jobTitle = input.jobTitle;
    }

    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    if (input.isPrimary !== undefined) {
      data.isPrimary = input.isPrimary;
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.clientContact.findFirst({
        where: {
          id: contactId,
          clientId,
          organizationId,
        },

        select: {
          id: true,
        },
      });

      if (!existing) {
        return null;
      }

      if (input.isPrimary === true) {
        await tx.clientContact.updateMany({
          where: {
            organizationId,
            clientId,
            isPrimary: true,

            id: {
              not: contactId,
            },
          },

          data: {
            isPrimary: false,
          },
        });
      }

      return tx.clientContact.update({
        where: {
          id: contactId,
        },

        data,
      });
    });
  },

  async deleteContact(
    organizationId: string,
    clientId: string,
    contactId: string,
  ): Promise<boolean> {
    const result = await prisma.clientContact.deleteMany({
      where: {
        id: contactId,
        clientId,
        organizationId,
      },
    });

    return result.count > 0;
  },
};