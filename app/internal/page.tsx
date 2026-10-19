import { loadIndex } from "@/lib/data";
import { getEvidence } from "@/lib/studio/knowledge";
import { aiConfiguration } from "@/lib/aiProvider";
import { InternalKnowledge } from "@/components/studio/InternalKnowledge";
import "../studio/studio.css";

export const metadata = { title: "Knowledge Engine & Data Engineer · Irixs intern" };
export default async function InternalPage() {
  const connectors = await loadIndex();
  const evidence = await getEvidence("KnOrganisation");
  const ai = aiConfiguration(), receipt = aiConfiguration("receipt");
  return <InternalKnowledge connectors={connectors} initialEvidence={evidence} ai={{ configured: ai.configured, label: ai.label, model: ai.model, receiptModel: receipt.model }} />;
}
