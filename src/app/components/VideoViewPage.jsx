"use client";
import { useState, useEffect } from "react";
import { Download, Share2 } from "lucide-react";
import TikTokLoader from "./TikTokLoader";
import { motion, AnimatePresence, delay } from "framer-motion";

const FREECONVERT_API_KEY = process.env.NEXT_PUBLIC_FREECONVERT_API_KEY;

export default function VideoViewPage({ videoId }) {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState(null);
  const [convertedBlob, setConvertedBlob] = useState(null);
  const [preparingVideo, setPreparingVideo] = useState(false);
  // ADDED STATES FOR PROGRESS BAR
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionStage, setConversionStage] = useState("Starting...");

  useEffect(() => {
    // Detect iOS
    const iOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);
    fetchVideo();
  }, [videoId]);

  useEffect(() => {
    // Convert video immediately after it's loaded
    if (video && !convertedBlob) {
      prepareVideo();
    }
  }, [video]);

  // --- CORE CONVERSION LOGIC (WITH PROGRESS) ---

  const prepareVideo = async () => {
    setPreparingVideo(true);
    setConverting(true);
    setConversionProgress(0);
    setConversionStage("Starting process...");
    try {
      const mp4Url = await convertToMp4(video.videoUrl);
      setConvertedUrl(mp4Url);

      // Fetch and store the blob (Final step, set progress to 100 before fetch)
      setConversionStage("Almost There...");
      setConversionProgress(100);
      const response = await fetch(mp4Url);
      const blob = await response.blob();
      setConvertedBlob(blob);
    } catch (err) {
      console.error("Failed to prepare video:", err);
      // If conversion fails, use the original
      try {
        setConversionStage("Conversion failed, fetching original...");
        const response = await fetch(video.videoUrl);
        const blob = await response.blob();
        setConvertedBlob(blob);
        setConvertedUrl(video.videoUrl);
      } catch (fetchErr) {
        console.error("Failed to fetch original video:", fetchErr);
      }
    } finally {
      setPreparingVideo(false);
      setConverting(false);
      setConversionStage("Ready!");
    }
  };

  const fetchVideo = async () => {
    try {
      const response = await fetch(`/api/videos?id=${videoId}`);
      const data = await response.json();

      if (data.success) {
        setVideo(data.video);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load video");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const convertToMp4 = async (videoUrl) => {
    try {
      // Step 1: Import the video URL (Progress 0% - 33%)
      setConversionStage("1/3: Importing video...");
      const importResponse = await fetch(
        "https://api.freeconvert.com/v1/process/import/url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FREECONVERT_API_KEY}`,
          },
          body: JSON.stringify({
            url: videoUrl,
          }),
        },
      );

      if (!importResponse.ok) {
        throw new Error("Failed to import video");
      }

      const importData = await importResponse.json();
      const importTaskId = importData.id;

      // Wait for import to complete, tracking progress (0-33)
      await waitForTaskCompletion(importTaskId, 0, 33);

      // Step 2: Convert the video (Progress 34% - 66%)
      setConversionStage("2/3: Converting Video...");
      const convertResponse = await fetch(
        "https://api.freeconvert.com/v1/process/convert",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FREECONVERT_API_KEY}`,
          },
          body: JSON.stringify({
            input: importTaskId,
            input_format: "webm",
            output_format: "mp4",
            options: {
              video_codec: "libx264",
              audio_codec: "aac",
            },
          }),
        },
      );

      if (!convertResponse.ok) {
        throw new Error("Failed to convert video");
      }

      const convertData = await convertResponse.json();
      const convertTaskId = convertData.id;

      // Wait for conversion to complete, tracking progress (34-66)
      await waitForTaskCompletion(convertTaskId, 34, 66);

      // Step 3: Export the converted video (Progress 67% - 99%)
      setConversionStage("3/3: Exporting video...");
      const exportResponse = await fetch(
        "https://api.freeconvert.com/v1/process/export/url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FREECONVERT_API_KEY}`,
          },
          body: JSON.stringify({
            input: convertTaskId,
          }),
        },
      );

      if (!exportResponse.ok) {
        throw new Error("Failed to export video");
      }

      const exportData = await exportResponse.json();
      const exportTaskId = exportData.id;

      // Wait for export to complete, tracking progress (67-99)
      const finalTask = await waitForTaskCompletion(exportTaskId, 67, 99);

      // Get the download URL
      if (finalTask.result && finalTask.result.url) {
        return finalTask.result.url;
      } else {
        throw new Error("No download URL found");
      }
    } catch (err) {
      console.error("Conversion failed:", err);
      throw err;
    }
  };

  const waitForTaskCompletion = async (
    taskId,
    minProgress = 0,
    maxProgress = 100,
    maxAttempts = 120,
  ) => {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `https://api.freeconvert.com/v1/process/tasks/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${FREECONVERT_API_KEY}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to check task status");
      }

      const task = await response.json();

      if (task.status === "completed") {
        setConversionProgress(maxProgress);
        return task;
      } else if (task.status === "error" || task.status === "failed") {
        throw new Error("Task failed: " + (task.message || "Unknown error"));
      }

      // Calculate and update progress based on the task status
      if (task.progress !== undefined) {
        const overallProgress =
          minProgress + (task.progress / 100) * (maxProgress - minProgress);
        setConversionProgress(Math.floor(overallProgress));
      } else if (task.status === "processing" && maxProgress > 0) {
        const stepProgress =
          minProgress + (i / maxAttempts) * (maxProgress - minProgress);
        setConversionProgress(Math.floor(stepProgress));
      }

      await new Promise((resolve) => setTimeout(resolve, i < 10 ? 1000 : 2000));
    }

    throw new Error("Task timeout");
  };

  // --- HANDLEDOWNLOAD (MODIFIED FOR IMMEDIATE SHARE) ---

  const handleDownload = async () => {
    if (!video || !convertedBlob) return;

    setDownloading(true);

    const fileExtension =
      convertedUrl?.includes(".mp4") || convertedUrl?.includes("mp4")
        ? "mp4"
        : "webm";
    const mimeType = fileExtension === "mp4" ? "video/mp4" : "video/webm";

    // 1. Check for iOS and Share API availability first
    if (isIOS && navigator.share && navigator.canShare) {
      const file = new File(
        [convertedBlob],
        `Derana_Closeup_Music_Festival-${video.id}.${fileExtension}`,
        {
          type: mimeType,
        },
      );

      if (navigator.canShare({ files: [file] })) {
        try {
          // CRITICAL FIX: Initiate logging asynchronously without 'await'
          // to maintain the user gesture chain for navigator.share()
          fetch("/api/videos/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: video.id }),
          }).catch((err) => console.error("Logging failed:", err));

          // Call the Share API IMMEDIATELY after the click/tap.
          await navigator.share({
            title: "Derana Closeup Music Festival",
            text: "Derana Closeup Music Festival - Check out my video!",
            files: [file],
          });

          // Share successful
          setDownloading(false);
          return;
        } catch (err) {
          if (err.name === "AbortError") {
            // User cancelled
            setDownloading(false);
            return;
          }
          console.error("Web Share failed (falling back to download):", err);
          // Fall through to traditional download if share fails critically
        }
      }
    }

    // 2. Fallback: Traditional download (for non-iOS or if share fails)
    try {
      // If the code reaches here on iOS, the share failed. We must log the download
      // synchronously IF it hasn't been logged above (only applicable if we skip
      // the whole iOS block, but since we already tried to log above, we skip it here).

      // To be safe and avoid double logging in the original flow, we wrap the original log
      // and simply proceed to the download trigger.

      // The original logic relied on this outer catch block to handle errors.
      triggerDownload(
        convertedBlob,
        `Derana_Closeup_Music_Festival-${video.id}.${fileExtension}`,
      );
    } catch (err) {
      console.error("Download fallback failed:", err);
      alert("Failed to download video");
    } finally {
      setDownloading(false);
    }
  };
  // --- END HANDLEDOWNLOAD ---

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!video) return;

    setSharing(true);

    try {
      let downloadUrl = video.videoUrl;

      // Always convert to MP4
      try {
        downloadUrl = await convertToMp4(video.videoUrl);
      } catch (err) {
        console.error("Conversion failed:", err);
      }

      const response = await fetch(downloadUrl);
      const blob = await response.blob();

      const file = new File(
        [blob],
        `Derana_Closeup_Music_Festival-${video.id}.mp4`,
        {
          type: "video/mp4",
        },
      );

      if (navigator.share) {
        await navigator.share({
          title: "Derana Closeup Music Festival",
          text: "Derana Closeup Music Festival - Check out my video!",
          files: [file],
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-svh hs relative overflow-hidden flex items-center justify-center px-4 bg-gradient-to-br from-[#442E8D] via-[#702A8C] to-[#442E8D]">
        <div className="bg-[#2C2151] absolute top-0 z-10 px-16 py-4 rounded-b-3xl shadow-2xl">
          <img src="/images/closeup-logo.png" className="w-[14rem] h-auto" />
        </div>

        <div className="absolute bottom-5 z-0 opacity-5">
          <img src="/images/closeup-logo.png" className="w-[22rem] h-auto" />
        </div>

        <img
          src="/images/pattern.png"
          className="absolute top-0 w-full h-auto opacity-20 z-0 float"
        />
        <img
          src="/images/pattern.png"
          className="absolute bottom-0 rotate-180 w-full h-auto opacity-10 z-0 float"
        />

        <div className="text-center relative z-10">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0">
              <TikTokLoader />
            </div>
          </div>
          <p className="text-white text-xl font-medium font-righteous uppercase text-center">
            Video is Getting Ready...
          </p>
        </div>
        <style jsx>{`
          @keyframes orbit1 {
            0%,
            100% {
              transform: translate(-50%, -50%) translateX(-30px);
            }
            50% {
              transform: translate(-50%, -50%) translateX(30px);
            }
          }
          @keyframes orbit2 {
            0%,
            100% {
              transform: translate(-50%, -50%) translateX(30px);
            }
            50% {
              transform: translate(-50%, -50%) translateX(-30px);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-svh hs relative overflow-hidden flex items-center justify-center px-4 bg-gradient-to-br from-[#442E8D] via-[#702A8C] to-[#442E8D]">
        <div className="bg-[#2C2151] absolute top-0 z-10 px-16 py-4 rounded-b-3xl shadow-2xl">
          <img src="/images/closeup-logo.png" className="w-[14rem] h-auto" />
        </div>

        <div className="absolute bottom-5 z-0 opacity-5">
          <img src="/images/closeup-logo.png" className="w-[22rem] h-auto" />
        </div>

        <img
          src="/images/pattern.png"
          className="absolute top-0 w-full h-auto opacity-20 z-0 float"
        />
        <img
          src="/images/pattern.png"
          className="absolute bottom-0 rotate-180 w-full h-auto opacity-10 z-0 float"
        />
        <div className="text-center max-w-md">
          <div className="text-7xl mb-6">⚠️</div>
          <h2 className="text-white text-3xl font-bold mb-3 uppercase font-righteous">
            Video Not Found
          </h2>
          {/* <p className="text-gray-400 text-lg">{error}</p> */}
        </div>
      </div>
    );
  }

  return (
    <div className="h-svh bg-white relative overflow-hidden flex flex-col justify-center items-center bg-gradient-to-br from-[#442E8D] via-[#702A8C] to-[#442E8D] px-4">
      <div className="bg-[#2C2151] absolute top-0 z-10 px-16 py-4 rounded-b-3xl shadow-2xl">
        <img src="/images/closeup-logo.png" className="w-[14rem] h-auto" />
      </div>

      <div className="absolute bottom-5 z-0 opacity-5">
        <img src="/images/closeup-logo.png" className="w-[22rem] h-auto" />
      </div>

      <img
        src="/images/pattern.png"
        className="absolute top-0 w-full h-auto opacity-20 z-0 float"
      />
      <img
        src="/images/pattern.png"
        className="absolute bottom-0 rotate-180 w-full h-auto opacity-10 z-0 float"
      />
      {/* <header className=" top-0 z-50 relative w-full flex justify-center items-center">
        <motion.div
          className="container mx-auto px-4 pt-4 flex justify-center items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex flex-col w-fit items-end justify-center">
            <img
              src="/images/logoset.png"
              alt="logo"
              className=" w-28 h-auto"
            />
          </div>
        </motion.div>
      </header> */}

      <main className="container flex-col flex justify-center items-center mx-auto px-4 py-6 sm:py-10 max-w-2xl">
        <div className="relative rounded-2xl w-fit flex justify-center sm:rounded-3xl overflow-hidden mb-6 sm:mb-8 border-4 border-[#2C2151]">
          <AnimatePresence mode="wait">
            <motion.video
              key="video-ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
              src={video.videoUrl}
              controls
              playsInline
              autoPlay
              preload="metadata"
              className="w-fit h-auto max-h-[60vh]"
              controlsList="nodownload"
            />
          </AnimatePresence>

          {/* Overlay for preparing/converting */}
          <AnimatePresence>
            {(preparingVideo || converting) && (
              <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#702A8C]/90 backdrop-blur-md z-10"
              >
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0">
                    <TikTokLoader />
                  </div>
                </div>
                <p className="text-white text-xl font-medium text-center">
                  Video is Getting Ready...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* PROGRESS BAR DISPLAY */}
        {/* {(preparingVideo || converting) && (
          <div className="mb-6 sm:mb-8 bg-white/90 backdrop-blur-sm rounded-xl p-4 flex flex-col gap-2 shadow-lg">
            <p className="text-[#0A70B8] font-medium flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#4AB648]"></div>
              {conversionStage} ({conversionProgress}%)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-[#4AB648] h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${conversionProgress}%` }}
              ></div>
            </div>
          </div>
        )} */}
        {/* END NEW UI */}
        <AnimatePresence>
          {(!preparingVideo || !converting) && (
            <motion.div
              className="space-y-3 flex items-center justify-center sm:space-y-4 mb-6 sm:mb-8 relative"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
            >
              <button
                onClick={handleDownload}
                disabled={
                  downloading || converting || preparingVideo || !convertedBlob
                }
                className="relative bg-white font-righteous uppercase disabled:bg-gray-300 text-[#702A8C] font-bold py-4 sm:py-5 px-20 sm:px-8 rounded-full shadow-lg  flex items-center justify-center gap-3 text-xl"
              >
                {preparingVideo || converting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-[#702A8C]"></div>
                    Preparing your video...
                  </>
                ) : downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-[#702A8C]"></div>
                    {isIOS ? "Opening..." : "Downloading..."}
                  </>
                ) : (
                  <>{isIOS ? <>Share</> : <>Download</>}</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
