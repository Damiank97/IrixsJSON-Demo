export const TOOL_IDS = ["home", "planning", "config", "declarations", "schemas"] as const;
export type ToolboxTool = (typeof TOOL_IDS)[number];

export function toolFromHash(hash: string): ToolboxTool {
  const value = hash.replace(/^#/, "");
  return TOOL_IDS.includes(value as ToolboxTool) ? value as ToolboxTool : "home";
}
