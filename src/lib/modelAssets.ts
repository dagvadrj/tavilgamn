
export type ModelLod = "high";
export function modelLodFiles(
  highFile: string,
): Record<ModelLod, string> | null {
  if (!highFile.toLowerCase().endsWith(".glb")) {
    return null;
  }

  return {
    high: highFile,
  };
}

export function modelAssetPaths(
  highPath: string,
): string[] {
  return [highPath];
}

export function chooseModelLod(): ModelLod {
  return "high";
}
