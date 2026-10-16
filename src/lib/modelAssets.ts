
export type ModelLod = "preview" | "high";
export type ModelLodFiles = { high: string; preview?: string };

export function modelLodFiles(
  highFile: string,
  previewFile?: string | null,
): ModelLodFiles | null {
  if (!highFile.toLowerCase().endsWith(".glb")) {
    return null;
  }

  // Legacy preview references are accepted but never selected for rendering.
  void previewFile;
  return { high: highFile };
}

export function modelAssetPaths(
  highPath: string,
  previewPath?: string | null,
): string[] {
  return [...new Set([highPath, previewPath].filter((value): value is string => Boolean(value)))];
}

export function chooseModelLod(hasPreview = false): ModelLod {
  void hasPreview;
  return "high";
}
