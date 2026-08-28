import { loadIndex } from "@/lib/data";
import { ToolboxHome } from "@/components/ToolboxHome";

export default async function Home() {
  const connectors = await loadIndex();
  return <ToolboxHome connectors={connectors} />;
}
