export type ModelLod = "high" | "medium" | "low";
export function modelLodFiles(highFile: string): Record<ModelLod, string> | null {
  const match = /^model-([0-9a-f-]{36})-0\.glb$/i.exec(highFile);
  return match ? { high: highFile, medium: `model-${match[1]}-1.glb`, low: `model-${match[1]}-2.glb` } : null;
}
export function modelAssetPaths(highPath: string): string[] {
  const slash = highPath.lastIndexOf("/");
  const files = modelLodFiles(highPath.slice(slash + 1));
  return files ? Object.values(files).map(file => highPath.slice(0, slash + 1) + file) : [highPath];
}
export function chooseModelLod(distance: number, previous: ModelLod): ModelLod {
  if (previous === "high" && distance < 4.6) return "high";
  if (previous === "low" && distance > 8.5) return "low";
  if (distance < 3.4) return "high";
  if (distance > 11.5) return "low";
  return "medium";
}
