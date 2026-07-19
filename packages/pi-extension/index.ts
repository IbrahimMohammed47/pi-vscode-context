import { StringEnum, Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { requestContext, requestDiagnostics } from "./client.js";

const vscodeDiagnosticsTool = defineTool({
  name: "vscode_diagnostics",
  label: "VS Code Diagnostics",
  description:
    "Read current VS Code Problems diagnostics from installed language extensions, including unsaved state. Use when the user asks about editor errors/warnings or to validate edits; not for general code review. active checks the active file, while workspace checks all matched roots. Results put errors first. An empty list means VS Code currently reports none; if truncated, fix returned items and call again. Diagnostics can briefly lag fresh edits, so retry once if results conflict. Read-only.",
  parameters: Type.Object({
    scope: StringEnum(["active", "workspace"] as const, {
      description:
        "active for the current file (prefer when relevant); workspace only when the task spans the project",
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
    "Read live context from the active local VS Code editor, including unsaved text. Use for prompts like 'explain this', 'refactor the selection', or 'review the current file'; use built-in read for explicitly named saved files. current returns selection or bounded cursor context; document returns the whole active file up to 48KB. Positions are zero-based and range ends are exclusive. If isDirty, trust returned text over disk; if truncated or too large, ask for a narrower selection or read the saved file. Read-only.",
  parameters: Type.Object({
    scope: StringEnum(["current", "document"] as const, {
      description:
        "current for 'this', selection, or cursor context; document only when the whole active file is needed",
    }),
  }),

  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    const result = await requestContext({
      cwd: ctx.cwd,
      scope: params.scope,
      signal,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: {
        source: result.source,
        errorCode: result.error?.code,
      },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(vscodeContextTool);
  pi.registerTool(vscodeDiagnosticsTool);
}
