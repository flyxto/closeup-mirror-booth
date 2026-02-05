import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import https from "https";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  // Add these options to fix SSL issues
  requestHandler: {
    httpsAgent: new https.Agent({
      rejectUnauthorized: true,
      keepAlive: true,
      timeout: 60000,
    }),
  },
  forcePathStyle: false,
  // Increase timeout
  requestTimeout: 60000,
});

export async function POST(request) {
  try {
    const { video, filename } = await request.json();

    console.log("📤 Starting upload:", filename);
    console.log("🔧 Using Account ID:", process.env.CLOUDFLARE_ACCOUNT_ID);
    console.log("🪣 Bucket:", process.env.CLOUDFLARE_R2_BUCKET_NAME);

    // Convert base64 to buffer
    const base64Data = video.replace(/^data:video\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    console.log("📦 File size:", buffer.length, "bytes");

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: "video/webm",
    });

    await r2Client.send(command);

    // Construct public URL
    const publicUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}${filename}`;

    console.log("✅ Upload successful!");
    console.log("🔗 Public URL:", publicUrl);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("❌ R2 upload error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
    });

    return NextResponse.json(
      {
        error: "Upload failed",
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}
