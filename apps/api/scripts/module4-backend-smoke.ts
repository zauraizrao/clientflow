import { randomUUID } from "node:crypto";

import {
  createTaskSchema,
  projectListQuerySchema,
  taskListQuerySchema,
} from "@clientflow/contracts";

import { prisma } from "../src/config/database.js";
import {
  projectService,
  type ProjectActor,
} from "../src/services/project.service.js";
import { taskService } from "../src/services/task.service.js";
import { AppError } from "../src/utils/app-error.js";

const PROJECT_NAME = "Northstar Website Redesign";
const PARENT_TASK_TITLE = "Create website information architecture";
const SUBTASK_TITLE = "Draft primary navigation sitemap";

type Result = {
  name: string;
  status: "PASS" | "FAIL";
  detail: string;
};

const results: Result[] = [];

function pass(name: string, detail: string) {
  results.push({ name, status: "PASS", detail });
  console.log(`PASS  ${name} — ${detail}`);
}

function fail(name: string, detail: string): never {
  results.push({ name, status: "FAIL", detail });
  throw new Error(`${name}: ${detail}`);
}

function assert(condition: unknown, name: string, detail: string): asserts condition {
  if (!condition) {
    fail(name, detail);
  }
}

async function expectAppError(
  name: string,
  fn: () => Promise<unknown>,
  expectedStatus: number,
) {
  try {
    await fn();
    fail(name, `Expected HTTP-style ${expectedStatus} AppError, but the operation was allowed.`);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === expectedStatus) {
      pass(name, `${error.statusCode} ${error.code}`);
      return;
    }

    throw error;
  }
}

async function main() {
  console.log("");
  console.log("ClientFlow Module 4.2 consolidated backend smoke");
  console.log("Mode: read-only, except intentionally rejected permission checks.");
  console.log("");

  const project = await prisma.project.findFirst({
    where: { name: PROJECT_NAME },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      name: true,
      status: true,
    },
  });

  assert(
    project,
    "Fixture project",
    `Could not find "${PROJECT_NAME}". Keep the project created during M4.2 verification.`,
  );
  assert(
    project.clientId,
    "Fixture client link",
    "The Northstar project must remain linked to its CRM client.",
  );

  const lead = await prisma.projectMember.findFirst({
    where: {
      projectId: project.id,
      role: "LEAD",
    },
    include: {
      organizationMember: {
        include: {
          user: true,
        },
      },
    },
  });

  assert(
    lead,
    "Fixture project lead",
    "No LEAD ProjectMember exists for the verification project.",
  );

  const parentTask = await prisma.task.findFirst({
    where: {
      projectId: project.id,
      title: PARENT_TASK_TITLE,
      parentTaskId: null,
    },
    select: {
      id: true,
      projectColumnId: true,
    },
  });

  assert(
    parentTask,
    "Fixture parent task",
    `Could not find "${PARENT_TASK_TITLE}".`,
  );

  const subtask = await prisma.task.findFirst({
    where: {
      projectId: project.id,
      title: SUBTASK_TITLE,
      parentTaskId: parentTask.id,
    },
    select: {
      id: true,
    },
  });

  assert(
    subtask,
    "Fixture subtask",
    `Could not find "${SUBTASK_TITLE}" under the parent task.`,
  );

  const managerActor: ProjectActor = {
    userId: lead.organizationMember.userId,
    membershipId: lead.organizationMemberId,
    organizationId: project.organizationId,
    role: "MANAGER",
    clientId: null,
  };

  const projectDetail = await projectService.getProject(
    managerActor,
    project.id,
  );

  assert(
    projectDetail.id === project.id,
    "Manager project read",
    "Manager could not read the verification project.",
  );
  pass("Manager project read", projectDetail.name);

  const projectSearch = await projectService.listProjects(
    managerActor,
    projectListQuerySchema.parse({
      search: "Northstar Website",
      status: "ACTIVE",
      page: 1,
      pageSize: 1,
      sortBy: "name",
      sortOrder: "asc",
    }),
  );

  assert(
    projectSearch.items.some((item) => item.id === project.id),
    "Project search + status filter",
    "Search/status filter did not return the verification project.",
  );
  pass(
    "Project search + status filter",
    `total=${projectSearch.pagination.totalItems}, pageSize=${projectSearch.pagination.pageSize}`,
  );

  const taskSearch = await taskService.listTasks(
    managerActor,
    project.id,
    taskListQuerySchema.parse({
      search: "information architecture",
      scope: "ALL",
      page: 1,
      pageSize: 10,
      sortBy: "title",
      sortOrder: "asc",
    }),
  );

  assert(
    taskSearch.items.some((task) => task.id === parentTask.id),
    "Task search",
    "Task title search did not return the parent task.",
  );
  pass("Task search", `matched=${taskSearch.pagination.totalItems}`);

  const priorityFilter = await taskService.listTasks(
    managerActor,
    project.id,
    taskListQuerySchema.parse({
      priority: "HIGH",
      scope: "ALL",
      page: 1,
      pageSize: 10,
    }),
  );

  assert(
    priorityFilter.items.some((task) => task.id === parentTask.id),
    "Task priority filter",
    "HIGH priority filter did not return the parent task.",
  );
  pass("Task priority filter", `matched=${priorityFilter.pagination.totalItems}`);

  const assigneeFilter = await taskService.listTasks(
    managerActor,
    project.id,
    taskListQuerySchema.parse({
      assigneeId: lead.organizationMemberId,
      scope: "ALL",
      page: 1,
      pageSize: 10,
    }),
  );

  assert(
    assigneeFilter.items.some((task) => task.id === parentTask.id) &&
      assigneeFilter.items.some((task) => task.id === subtask.id),
    "Task assignee filter",
    "Assignee filter must include both the parent task and its assigned subtask.",
  );
  pass("Task assignee filter", `matched=${assigneeFilter.pagination.totalItems}`);

  const rootOnly = await taskService.listTasks(
    managerActor,
    project.id,
    taskListQuerySchema.parse({
      scope: "ROOT",
      page: 1,
      pageSize: 50,
    }),
  );

  assert(
    rootOnly.items.some((task) => task.id === parentTask.id),
    "Root task scope",
    "ROOT scope did not include the parent task.",
  );
  assert(
    !rootOnly.items.some((task) => task.id === subtask.id),
    "Root task scope",
    "ROOT scope incorrectly included a subtask.",
  );
  pass("Root task scope", `rootTasks=${rootOnly.pagination.totalItems}`);

  const pageOne = await taskService.listTasks(
    managerActor,
    project.id,
    taskListQuerySchema.parse({
      scope: "ALL",
      page: 1,
      pageSize: 1,
      sortBy: "createdAt",
      sortOrder: "asc",
    }),
  );

  assert(
    pageOne.pagination.totalItems >= 2 &&
      pageOne.pagination.totalPages >= 2 &&
      pageOne.pagination.hasNextPage,
    "Task pagination page 1",
    "Expected at least two tasks and a next page.",
  );
  pass(
    "Task pagination page 1",
    `total=${pageOne.pagination.totalItems}, pages=${pageOne.pagination.totalPages}`,
  );

  const pageTwo = await taskService.listTasks(
    managerActor,
    project.id,
    taskListQuerySchema.parse({
      scope: "ALL",
      page: 2,
      pageSize: 1,
      sortBy: "createdAt",
      sortOrder: "asc",
    }),
  );

  assert(
    pageTwo.pagination.hasPreviousPage && pageTwo.items.length === 1,
    "Task pagination page 2",
    "Second page did not report a previous page or return one task.",
  );
  pass("Task pagination page 2", "hasPreviousPage=true");

  const memberActor: ProjectActor = {
    ...managerActor,
    role: "MEMBER",
  };

  const memberProject = await projectService.getProject(
    memberActor,
    project.id,
  );

  assert(
    memberProject.id === project.id,
    "MEMBER project access",
    "A project member could not read their project.",
  );
  pass("MEMBER project access", "project membership grants read access");

  await expectAppError(
    "MEMBER structure write denied",
    () =>
      projectService.updateProject(memberActor, project.id, {
        description: projectDetail.description,
      }),
    403,
  );

  const nonMemberActor: ProjectActor = {
    ...memberActor,
    membershipId: randomUUID(),
  };

  await expectAppError(
    "Non-member project isolation",
    () => projectService.getProject(nonMemberActor, project.id),
    404,
  );

  const clientActor: ProjectActor = {
    userId: randomUUID(),
    membershipId: randomUUID(),
    organizationId: project.organizationId,
    role: "CLIENT",
    clientId: project.clientId,
  };

  const clientProject = await projectService.getProject(
    clientActor,
    project.id,
  );

  assert(
    clientProject.id === project.id,
    "CLIENT linked-project read",
    "Linked client could not read its project.",
  );
  pass("CLIENT linked-project read", "clientId scope matched");

  const activeColumn = projectDetail.columns.find(
    (column) => !column.isArchived && column.category === "ACTIVE",
  );

  assert(
    activeColumn,
    "Active workflow fixture",
    "No active workflow column exists for the client permission check.",
  );

  const deniedTaskInput = createTaskSchema.parse({
    title: "Permission smoke task",
    projectColumnId: activeColumn.id,
    assigneeIds: [],
  });

  await expectAppError(
    "CLIENT task write denied",
    () => taskService.createTask(clientActor, project.id, deniedTaskInput),
    403,
  );

  const wrongClientActor: ProjectActor = {
    ...clientActor,
    clientId: randomUUID(),
  };

  await expectAppError(
    "CLIENT cross-account isolation",
    () => projectService.getProject(wrongClientActor, project.id),
    404,
  );

  const otherTenantMembership =
    await prisma.organizationMember.findFirst({
      where: {
        organizationId: {
          not: project.organizationId,
        },
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
      },
    });

  assert(
    otherTenantMembership,
    "Second tenant fixture",
    "Could not find a membership in another organization for tenant isolation.",
  );

  const otherTenantActor: ProjectActor = {
    userId: otherTenantMembership.userId,
    membershipId: otherTenantMembership.id,
    organizationId: otherTenantMembership.organizationId,
    role: "ADMIN",
    clientId: null,
  };

  await expectAppError(
    "Cross-tenant project isolation",
    () => projectService.getProject(otherTenantActor, project.id),
    404,
  );

  const finalTask = await taskService.getTask(
    managerActor,
    project.id,
    parentTask.id,
  );

  assert(
    finalTask.completedAt === null &&
      finalTask.subtaskCount >= 1 &&
      finalTask.subtasks.some((task) => task.id === subtask.id),
    "Final task integrity",
    "Parent task must remain reopened and retain its subtask.",
  );
  pass(
    "Final task integrity",
    `completedAt=null, subtaskCount=${finalTask.subtaskCount}`,
  );

  console.log("");
  console.log("==============================================");
  console.log(`MODULE 4.2 SMOKE: ${results.length} / ${results.length} PASS`);
  console.log("No successful write operation was performed.");
  console.log("==============================================");
  console.log("");
}

main()
  .catch((error) => {
    console.error("");
    console.error("MODULE 4.2 SMOKE FAILED");
    console.error(error);

    if (results.length > 0) {
      console.error("");
      console.error("Completed checks:");
      for (const result of results) {
        console.error(`${result.status.padEnd(4)}  ${result.name} — ${result.detail}`);
      }
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
