import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

const STORAGE_DIR = path.resolve(process.cwd(), "private_storage", "receipts");

/**
 * Ensures private storage directory exists.
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create storage directory:", err);
  }
}

export interface UploadReceiptResult {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Validates and safely saves an uploaded receipt file.
 * Accepts a Base64 string or ArrayBuffer/Buffer.
 */
export async function saveReceiptFile(params: {
  filename: string;
  mimeType: string;
  fileBuffer: Buffer | Uint8Array;
}): Promise<UploadReceiptResult> {
  const { filename, mimeType, fileBuffer } = params;

  // 1. Validate MIME type
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new Error("نوع الملف غير مسموح به. يرجى رفع صورة بصيغة JPG أو PNG أو WEBP فقط.");
  }

  // 2. Validate file size
  if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.");
  }

  if (fileBuffer.byteLength === 0) {
    throw new Error("الملف فارغ أو تالف.");
  }

  await ensureStorageDir();

  // 3. Generate secure, collision-resistant storage key
  const extension = path.extname(filename).toLowerCase() || (normalizedMime === "image/png" ? ".png" : ".jpg");
  const randomId = crypto.randomUUID();
  const storageKey = `${randomId}${extension}`;
  const filePath = path.join(STORAGE_DIR, storageKey);

  // 4. Save to private directory
  await fs.writeFile(filePath, Buffer.from(fileBuffer));

  return {
    storageKey,
    originalFilename: path.basename(filename).slice(0, 150),
    mimeType: normalizedMime,
    fileSize: fileBuffer.byteLength,
  };
}

/**
 * Reads a stored receipt by storageKey.
 */
export async function readReceiptFile(storageKey: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  // Prevent directory traversal attacks
  const sanitizedKey = path.basename(storageKey);
  const filePath = path.join(STORAGE_DIR, sanitizedKey);

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(sanitizedKey).toLowerCase();
    let contentType = "image/jpeg";
    if (ext === ".png") contentType = "image/png";
    if (ext === ".webp") contentType = "image/webp";

    return { buffer, contentType };
  } catch (err) {
    return null;
  }
}
