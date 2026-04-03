import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AlertState } from "../types.js";
import { log } from "../utils/logger.js";

const DEFAULT_STATE: AlertState = {
  lastKnownHealth: "healthy"
};

export async function loadAlertState(path: string): Promise<AlertState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as AlertState;
    return {
      ...DEFAULT_STATE,
      ...parsed
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown alert state load error";
    log("INFO", "Using default alert state", { path, reason });
    return DEFAULT_STATE;
  }
}

export async function saveAlertState(path: string, state: AlertState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
  log("INFO", "Alert state saved", { path, lastKnownHealth: state.lastKnownHealth });
}
