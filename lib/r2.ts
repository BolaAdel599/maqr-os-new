import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

const hasConfig = !!(
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET
)

const client = hasConfig
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null

/**
 * Uploads a file buffer to Cloudflare R2 and returns its public URL.
 * Requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 * and R2_PUBLIC_BASE_URL (the public bucket domain or custom domain) to be
 * configured. Without them, this throws instead of silently returning ""
 * as it used to - a caller that ignores the return value should not think
 * an upload succeeded when it didn't.
 */
export async function uploadToR2(file: { buffer: Buffer; contentType: string; extension?: string }): Promise<string> {
  if (!client || !process.env.R2_BUCKET) {
    throw new Error('R2 is not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL)')
  }
  const key = `uploads/${crypto.randomBytes(16).toString('hex')}${file.extension ? '.' + file.extension : ''}`
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.contentType,
  }))
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '') || ''
  return `${base}/${key}`
}
