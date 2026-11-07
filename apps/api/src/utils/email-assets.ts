import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type EmailImage = { contentBase64: string; contentType: "image/png" };

export type EmailAssetReader = {
  /** Reads a bundled PNG by its public web path, or null when it is not an allowed asset. */
  readImage(publicPath: string): Promise<EmailImage | null>;
};

/**
 * Only the app icon and the bundled bank logos are embedded. User-provided URLs are never fetched,
 * so a logo cannot make the server request an arbitrary address or leak the recipient's IP.
 */
const allowedImagePath = /^\/(?:logos\/[A-Za-z0-9][\w.-]*|icon-192)\.png$/;

export function isEmailImagePath(publicPath: string) {
  return allowedImagePath.test(publicPath);
}

export function createEmailAssetReader(rootDirectory: string): EmailAssetReader {
  const cache = new Map<string, EmailImage>();

  return {
    async readImage(publicPath) {
      if (!isEmailImagePath(publicPath)) return null;
      const cached = cache.get(publicPath);
      if (cached) return cached;
      try {
        const content = await readFile(join(rootDirectory, publicPath));
        const image: EmailImage = {
          contentBase64: content.toString("base64"),
          contentType: "image/png",
        };
        cache.set(publicPath, image);
        return image;
      } catch {
        return null;
      }
    },
  };
}

/** The web's public folder in development; the Docker image copies the same files elsewhere. */
export function readEmailAssetsDirectory() {
  return (
    process.env.EMAIL_ASSETS_DIR?.trim() ||
    fileURLToPath(new URL("../../../web/public", import.meta.url))
  );
}
