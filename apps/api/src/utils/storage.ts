import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { normalizeAttachmentFileName } from "@openmonetis/domain/attachments";

const uploadUrlTtlSeconds = 5 * 60;
const downloadUrlTtlSeconds = 5 * 60;
const inspectionByteCount = 1024;

type AttachmentObjectInspection = {
  size: number | null;
  mimeType: string | null;
  etag: string | null;
  bytes: Uint8Array;
};

export type AttachmentStorage = {
  enabled: boolean;
  prepareUpload(
    fileKey: string,
    mimeType: string,
    fileSize: number,
  ): Promise<{ uploadUrl: string }>;
  inspect(fileKey: string): Promise<AttachmentObjectInspection>;
  commit(sourceKey: string, targetKey: string, sourceEtag: string): Promise<void>;
  signDownload(
    fileKey: string,
    fileName: string,
    disposition: "inline" | "attachment",
  ): Promise<{ url: string; expiresAt: string }>;
  remove(fileKey: string): Promise<void>;
};

type AttachmentStorageConfiguration = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string | undefined;
  region: string;
};

export const attachmentStorage = createAttachmentStorage();

function createAttachmentStorage(): AttachmentStorage {
  const configuration = readAttachmentStorageConfiguration();
  if (!configuration) return createDisabledAttachmentStorage();

  const { bucket, accessKeyId, secretAccessKey, endpoint, region } = configuration;
  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: Boolean(endpoint),
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  return {
    enabled: true,
    async prepareUpload(fileKey, mimeType, fileSize) {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: fileKey,
          ContentLength: fileSize,
          ContentType: mimeType,
        }),
        {
          expiresIn: uploadUrlTtlSeconds,
          signableHeaders: new Set(["content-type"]),
        },
      );
      return { uploadUrl };
    },

    async inspect(fileKey) {
      const metadata = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: fileKey }));
      const size = metadata.ContentLength ?? null;
      const etag = metadata.ETag ?? null;

      if (size === 0) {
        return { size, mimeType: metadata.ContentType ?? null, etag, bytes: new Uint8Array() };
      }

      const object = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: fileKey,
          Range: `bytes=0-${inspectionByteCount - 1}`,
          IfMatch: etag ?? undefined,
        }),
      );
      const bytes = object.Body ? await object.Body.transformToByteArray() : new Uint8Array();

      return {
        size,
        mimeType: metadata.ContentType ?? null,
        etag,
        bytes: bytes.slice(0, inspectionByteCount),
      };
    },

    async commit(sourceKey, targetKey, sourceEtag) {
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${sourceKey}`,
          CopySourceIfMatch: sourceEtag,
          Key: targetKey,
          MetadataDirective: "COPY",
        }),
      );
    },

    async signDownload(fileKey, fileName, disposition) {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: fileKey,
          ResponseCacheControl: "private, no-store",
          ResponseContentDisposition: createContentDisposition(disposition, fileName),
        }),
        { expiresIn: downloadUrlTtlSeconds },
      );

      return {
        url,
        expiresAt: new Date(Date.now() + downloadUrlTtlSeconds * 1000).toISOString(),
      };
    },

    async remove(fileKey) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
    },
  };
}

function readAttachmentStorageConfiguration(): AttachmentStorageConfiguration | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const configuredValues = [bucket, accessKeyId, secretAccessKey].filter(Boolean).length;

  if (configuredValues === 0 && !endpoint) return null;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together",
    );
  }

  if (endpoint) validateStorageEndpoint(endpoint);

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint,
    region: process.env.S3_REGION?.trim() || "us-east-1",
  };
}

function validateStorageEndpoint(endpoint: string) {
  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new Error("S3_ENDPOINT must be a valid HTTP(S) URL");
  }
  if (!["http:", "https:"].includes(parsedEndpoint.protocol)) {
    throw new Error("S3_ENDPOINT must be a valid HTTP(S) URL");
  }
  if (process.env.NODE_ENV === "production" && parsedEndpoint.protocol !== "https:") {
    throw new Error("S3_ENDPOINT must use HTTPS in production");
  }
}

function createDisabledAttachmentStorage(): AttachmentStorage {
  const unavailable = async (): Promise<never> => {
    throw new Error("Attachment storage is not configured");
  };

  return {
    enabled: false,
    prepareUpload: unavailable,
    inspect: unavailable,
    commit: unavailable,
    signDownload: unavailable,
    remove: unavailable,
  };
}

function createContentDisposition(disposition: "inline" | "attachment", input: string) {
  const fileName = normalizeAttachmentFileName(input);
  const asciiFileName = fileName
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\x20-\x7e]+/g, "_")
    .replace(/["\\]/g, "_");
  const encodedFileName = encodeURIComponent(fileName).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`;
}
