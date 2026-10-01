
export type ModelLod = "preview" | "high";
export type ModelLodFiles = { high: string; preview?: string };

export function modelLodFiles(
  highFile: string,
  previewFile?: string | null,
): ModelLodFiles | null {
  if (!highFile.toLowerCase().endsWith(".glb")) {
    return null;
  }

  if (previewFile && !previewFile.toLowerCase().endsWith(".glb")) {
    return null;
  }

  return {
    high: highFile,
    ...(previewFile ? { preview: previewFile } : {}),
  };
}

export function modelAssetPaths(
  highPath: string,
  previewPath?: string | null,
): string[] {
  return [...new Set([highPath, previewPath].filter((value): value is string => Boolean(value)))];
}

export function chooseModelLod(hasPreview = false): ModelLod {
  return hasPreview ? "preview" : "high";
}
