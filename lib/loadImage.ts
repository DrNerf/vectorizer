import type { SourceImage } from "./types";

export const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

/** Decode a user-supplied file into a SourceImage. Throws on unsupported / undecodable input. */
export async function decodeImageFile(file: File): Promise<SourceImage> {
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}. Use PNG or JPG.`);
  }
  const bitmap = await createImageBitmap(file);
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    name: file.name,
  };
}

/** First accepted image file in a DataTransfer, or null. */
export function firstImageFile(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  const files = Array.from(dt.files);
  return files.find((f) => ACCEPTED_TYPES.includes(f.type)) ?? files[0] ?? null;
}
