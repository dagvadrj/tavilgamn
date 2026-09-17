
export type ModelLod = "high" | "medium" | "low";
export type ModelLodFiles = Record<ModelLod, string>;
export function modelLodFiles(highFile: string,): ModelLodFiles | null {
  const file = highFile
  .replaceAll("\\", "/")
  .split("/")
  .pop();
  if (!file){
    return null;
  }
  if (file.toLowerCase() === "high.glb") {
    return {
      high: "high.glb",
      medium: "medium.glb",
      low: "low.glb",
    };
  }
  const legacy = /^model-([0-9a-f-]{36})-0\.glb$/i.exec(
    file,
  );
  if (legacy) {
    const version = legacy[1];
    return {
      high: `model-${version}-0.glb`,
      medium: `model-${version}-1.glb`,
      low: `model-${version}-2.glb`
    };
  }
  return null 
}
export function modelAssetPaths(
  highPath: string,
): string[]{
  const normalized = highPath.replaceAll("\\", "/");
  const slash = normalized.lastIndexOf("/");
  const directory = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const filename = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const files = modelLodFiles(filename);
  if(!files) {
    return [highPath];  }
return [
  directory + files.high,
  directory + files.medium,
  directory + files.low,
];    
}

export function chooseModelLod(distance: number, previous: ModelLod): ModelLod {
  if (previous === "high" && distance < 4.6) { 
    return "high"
  }
  if (previous === "low" && distance > 8.5) {
    return "low"
  }
  if (distance < 3.4) {
    return "high"
  }
  if (distance > 11.5) {
    return "low"
  }
  return "medium";
}
