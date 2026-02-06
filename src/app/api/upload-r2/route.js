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
  requestHandler: {
    httpsAgent: new https.Agent({
      rejectUnauthorized: true,
      keepAlive: true,
      timeout: 60000,
    }),
  },
  forcePathStyle: false,
  requestTimeout: 60000,
});

export async function POST(request) {
  try {
    console.log("🔍 Request received");

    // Parse FormData
    const formData = await request.formData();
    console.log("📋 FormData parsed");

    const videoFile = formData.get("video");
    console.log("📹 Video file:", videoFile ? "Found" : "Missing");

    if (!videoFile) {
      console.error("❌ No video file in FormData");
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 },
      );
    }

    const filename = videoFile.name;
    console.log("📤 Filename:", filename);
    console.log("🔧 Account ID:", process.env.CLOUDFLARE_ACCOUNT_ID);
    console.log("🪣 Bucket:", process.env.CLOUDFLARE_R2_BUCKET_NAME);

    // Convert File to Buffer
    console.log("🔄 Converting to buffer...");
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log("📦 File size:", sizeMB, "MB");

    // Upload to R2
    console.log("☁️ Uploading to R2...");
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: "video/webm",
    });

    await r2Client.send(command);
    console.log("✅ Upload complete");

    // Construct public URL
    const baseUrl = process.env.CLOUDFLARE_PUBLIC_URL.endsWith("/")
      ? process.env.CLOUDFLARE_PUBLIC_URL
      : `${process.env.CLOUDFLARE_PUBLIC_URL}/`;

    const publicUrl = `${baseUrl}${filename}`;

    console.log("🔗 Public URL:", publicUrl);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("❌ R2 upload error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return NextResponse.json(
      {
        error: "Upload failed",
        details: error.message,
        name: error.name,
      },
      { status: 500 },
    );
  }
}
