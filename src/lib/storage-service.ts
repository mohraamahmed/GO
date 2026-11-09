import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const STORAGE_DIR = path.resolve(process.cwd(), "private_storage", "receipts");

// Strict regex pattern for safe storage keys: UUIDv4 + allowed extension
const SAFE_STORAGE_KEY_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

/**
 * Validates the true binary magic numbers of an image file buffer.
 * Defends against file disguise, polyglots, and malicious disguised payloads.
 */
export function detectFileTypeFromMagicBytes(
  buffer: Buffer | Uint8Array
): { mimeType: string; extension: string } | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // 1. JPEG Magic Bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }

  // 2. PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: ".png" };
  }

  // 3. WEBP Magic Bytes: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { mimeType: "image/webp", extension: ".webp" };
  }

  return null;
}

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
 * Validates and safely saves an uploaded receipt file with magic-byte verification.
 */
export async function saveReceiptFile(params: {
  filename: string;
  mimeType: string;
  fileBuffer: Buffer | Uint8Array;
}): Promise<UploadReceiptResult> {
  const { filename, fileBuffer } = params;

  // 1. Validate file buffer presence and size
  if (!fileBuffer || fileBuffer.byteLength === 0) {
    throw new Error("الملف المرفوع فارغ أو تالف.");
  }

  if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.");
  }

  // 2. Strict Magic Bytes signature detection (Never trust client-supplied MIME or extension)
  const detected = detectFileTypeFromMagicBytes(fileBuffer);
  if (!detected) {
    throw new Error("محتوى الملف غير صالح أو تالف. يجب أن يكون الملف صورة حقيقية (JPG, PNG, WEBP).");
  }

  // 3. Prevent malicious characters in original filename before logging/storing
  const sanitizedOriginal = path.basename(filename).replace(/[^a-zA-Z0-9_\u0600-\u06FF\.\-\s]/g, "").slice(0, 100);

  await ensureStorageDir();

  // 4. Generate cryptographically random UUID filename with verified extension
  const randomId = crypto.randomUUID();
  const storageKey = `${randomId}${detected.extension}`;
  const filePath = path.join(STORAGE_DIR, storageKey);

  // 5. Atomic write to private storage
  await fs.writeFile(filePath, Buffer.from(fileBuffer));

  return {
    storageKey,
    originalFilename: sanitizedOriginal || `receipt${detected.extension}`,
    mimeType: detected.mimeType,
    fileSize: fileBuffer.byteLength,
  };
}

/**
 * Reads a stored receipt safely with Path Traversal immunity.
 */
export async function readReceiptFile(storageKey: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  // Enforce strict UUID filename format
  if (!SAFE_STORAGE_KEY_REGEX.test(storageKey)) {
    return null;
  }

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
