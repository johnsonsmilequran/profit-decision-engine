import type { FastifyBaseLogger } from "fastify";
import type { Database } from "../database/client.js";
import { processImportBatch } from "./service.js";

const activeTasks = new Map<string, Promise<void>>();

export function scheduleImportBatch(
  database: Database,
  uploadDirectory: string,
  batchId: string,
  logger: FastifyBaseLogger,
): Promise<void> {
  const existing = activeTasks.get(batchId);
  if (existing) return existing;
  const task = processImportBatch(database, uploadDirectory, batchId)
    .catch((error: unknown) => {
      logger.error({ batchId, error: error instanceof Error ? error.message : "unknown" }, "batch processing failed");
    })
    .finally(() => {
      activeTasks.delete(batchId);
    });
  activeTasks.set(batchId, task);
  return task;
}

export async function waitForImportTasks(): Promise<void> {
  await Promise.all(activeTasks.values());
}
