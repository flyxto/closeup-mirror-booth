import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import https from "https";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: "YOUR_ACCESS_KEY_ID",
    secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
  },
  requestHandler: {
    httpsAgent: new https.Agent({
      rejectUnauthorized: true,
      keepAlive: true,
      timeout: 60000,
    }),
  },
  forcePathStyle: false,
});

async function testUpload() {
  try {
    console.log("🚀 Testing R2 connection...");

    // Test upload
    const uploadCommand = new PutObjectCommand({
      Bucket: "YOUR_BUCKET_NAME",
      Key: "test-file.txt",
      Body: "Hello from R2!",
      ContentType: "text/plain",
    });

    await r2Client.send(uploadCommand);
    console.log("✅ Upload successful!");

    // List files to verify
    const listCommand = new ListObjectsV2Command({
      Bucket: "YOUR_BUCKET_NAME",
    });

    const response = await r2Client.send(listCommand);
    console.log("📁 Files in bucket:");
    response.Contents?.forEach((file) => {
      console.log(`  - ${file.Key} (${file.Size} bytes)`);
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Code:", error.code);
    if (error.$metadata) {
      console.error("HTTP Status:", error.$metadata.httpStatusCode);
    }
  }
}

testUpload();
