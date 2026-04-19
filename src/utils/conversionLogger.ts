import { invoke } from "@tauri-apps/api/core";

export type PluginName =
  | "markdownEditOnTouch"
  | "mathEditOnTouch"
  | "mathMigration";

export type ConversionEvent =
  | {
      kind: "trigger";
      plugin: PluginName;
      selectionSet: boolean;
      docChanged: boolean;
      selection: { from: number; to: number; empty: boolean };
    }
  | {
      kind: "detect";
      plugin: PluginName;
      nodeType: string;
      range: { from: number; to: number };
      details?: Record<string, unknown>;
    }
  | {
      kind: "convert";
      plugin: PluginName;
      from: string;
      to: string;
      range: { from: number; to: number };
      cursorBefore: number;
      cursorAfter: number;
      details?: Record<string, unknown>;
    }
  | {
      kind: "skip";
      plugin: PluginName;
      reason: string;
      details?: Record<string, unknown>;
    };

const RUNTIME_KEY = "prose:log:conversions";

function readRuntimeOverride(): boolean | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(RUNTIME_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

let cachedEnabled: boolean | null = null;

function computeEnabled(): boolean {
  const override = readRuntimeOverride();
  if (override !== null) return override;
  return Boolean(import.meta.env?.DEV);
}

export function isConversionLoggingEnabled(): boolean {
  if (cachedEnabled === null) cachedEnabled = computeEnabled();
  return cachedEnabled;
}

let openGroups = 0;
let groupSeq = 0;
let currentGroupId = 0;
let currentPlugin: PluginName | null = null;

function sendToFile(line: string): void {
  invoke("log_conversion", { line }).catch(() => {});
}

export function beginConversionGroup(plugin: PluginName): void {
  cachedEnabled = computeEnabled();
  if (!cachedEnabled) return;
  openGroups++;
  groupSeq++;
  currentGroupId = groupSeq;
  currentPlugin = plugin;
  console.groupCollapsed(`[conv] ${plugin} #${currentGroupId}`);
  sendToFile(
    JSON.stringify({
      ts: Date.now(),
      groupId: currentGroupId,
      plugin,
      kind: "group-begin",
    }),
  );
}

export function endConversionGroup(): void {
  if (!cachedEnabled || openGroups === 0) return;
  openGroups--;
  console.groupEnd();
  sendToFile(
    JSON.stringify({
      ts: Date.now(),
      groupId: currentGroupId,
      plugin: currentPlugin,
      kind: "group-end",
    }),
  );
  currentPlugin = null;
}

export function logConversion(event: ConversionEvent): void {
  if (!cachedEnabled) return;
  switch (event.kind) {
    case "trigger":
      console.log("trigger", {
        selectionSet: event.selectionSet,
        docChanged: event.docChanged,
        selection: event.selection,
      });
      break;
    case "detect":
      console.log(`detect ${event.nodeType}`, {
        range: event.range,
        ...(event.details ?? {}),
      });
      break;
    case "convert":
      console.log(`convert ${event.from} → ${event.to}`, {
        range: event.range,
        cursorBefore: event.cursorBefore,
        cursorAfter: event.cursorAfter,
        ...(event.details ?? {}),
      });
      break;
    case "skip":
      console.log(`skip: ${event.reason}`, event.details ?? {});
      break;
  }
  sendToFile(JSON.stringify({ ts: Date.now(), groupId: currentGroupId, ...event }));
}
