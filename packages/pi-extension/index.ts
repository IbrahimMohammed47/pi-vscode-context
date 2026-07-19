import { StringEnum, Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { requestContext, requestDiagnostics } from "./client.js";

const vscodeDiagnosticsTool = defineTool({
  name: "vscode_diagnostics",
  label: "VS Code Diagnostics",
  description:
    "Read diagnostics currently reported by VS Code language extensions, including unsaved buffers. Use when the user mentions VS Code errors, warnings, red squiggles, or the Problems panel, or when no dedicated language validator is available. Prefer compiler, test, lint, or dedicated LSP tools for authoritative project-wide validation. active checks the active editor; workspace checks matching workspace roots. Empty means VS Code currently reports none. Results are bounded snapshots and may briefly lag edits. Read-only.",
  parameters: Type.Object({
    scope: StringEnum(["active", "workspace"] as const, {
      description:
        "active for current-editor squiggles and unsaved diagnostics; workspace only for an explicit project-wide VS Code Problems request",
    }),
  }),

  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    const result = await requestDiagnostics({
      cwd: ctx.cwd,
      scope: params.scope,
      signal,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: {
        diagnosticCount: result.diagnostics?.length,
        truncated: result.truncated,
        errorCode: result.error?.code,
      },
    };
  },
});

const vscodeContextTool = defineTool({
  name: "vscode_context",
  label: "VS Code Context",
  description:
    "Read active VS Code editor metadata and current selectedCode, including unsaved selection. Use only when the user refers to selected/highlighted/'this' code, current file, or cursor. selectedCode remains after focus moves to the terminal and is null when selection collapses. For current file/cursor, use returned path with normal read, grep, and edit tools; never use this for named files or generic exploration. If isDirty and unselected content is needed, ask the user to save or select it. Read-only.",
  parameters: Type.Object({}),

  async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
    const result = await requestContext({ cwd: ctx.cwd, signal });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: {
        hasSelectedCode: Boolean(result.selectedCode),
        errorCode: result.error?.code,
      },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(vscodeContextTool);
  pi.registerTool(vscodeDiagnosticsTool);
}
