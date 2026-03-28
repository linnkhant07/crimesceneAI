import type { GenerateVideosOperation } from "@google/genai";

const operationCache = new Map<string, GenerateVideosOperation>();

export function storeOperation(id: string, operation: GenerateVideosOperation) {
  operationCache.set(id, operation);
}

export function getOperation(id: string): GenerateVideosOperation | undefined {
  return operationCache.get(id);
}

export function removeOperation(id: string) {
  operationCache.delete(id);
}
