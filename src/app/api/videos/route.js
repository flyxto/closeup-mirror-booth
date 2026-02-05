import { MongoClient, ObjectId } from "mongodb";
import { NextResponse } from "next/server";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME;
const COLLECTION_NAME = "videos";

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(MONGODB_URI);

  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// POST - Save new video
export async function POST(request) {
  try {
    const body = await request.json();
    const { videoUrl, createdAt } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: "Video URL is required" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.insertOne({
      videoUrl,
      createdAt: createdAt || new Date().toISOString(),
      views: 0,
      downloads: 0,
    });

    return NextResponse.json({
      success: true,
      videoId: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("Error saving video:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// GET - Fetch video by ID
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("id");

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "Video ID is required" },
        { status: 400 },
      );
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(videoId)) {
      return NextResponse.json(
        { success: false, error: "Invalid video ID format" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    const video = await collection.findOne({
      _id: new ObjectId(videoId),
    });

    if (!video) {
      return NextResponse.json(
        { success: false, error: "Video not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      video: {
        id: video._id.toString(),
        videoUrl: video.videoUrl,
        createdAt: video.createdAt,
        downloads: video.downloads,
      },
    });
  } catch (error) {
    console.error("Error fetching video:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
