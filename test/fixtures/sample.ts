import { readFile } from "fs/promises";

export function parseContent(raw: string): string[] {
  return raw.split("\n");
}

export const DEFAULT_ENCODING = "utf-8";

export class FileReader {
  async read(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }
}
