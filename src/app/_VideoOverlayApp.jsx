/** @format */

"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Play,
  Pause,
  Download,
  Plus,
  X,
  Type,
  Camera,
  Square,
  Video,
} from "lucide-react";

const VideoTextOverlayApp = () => {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [textOverlays, setTextOverlays] = useState([]);
  const [selectedOverlay, setSelectedOverlay] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 640 }); // 9:16 ratio

  // Webcam recording states
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isWebcamRecording, setIsWebcamRecording] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamBlob, setWebcamBlob] = useState(null);
  const [currentMode, setCurrentMode] = useState("upload"); // 'upload', 'webcam', 'edit'

  const videoRef = useRef(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const webcamRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const webcamChunksRef = useRef([]);
  const animationFrameRef = useRef(null);

  const [recordingTimer, setRecordingTimer] = useState(30);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const timerIntervalRef = useRef(null);

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, max: 4096 },
          height: { ideal: 1080, max: 2160 },
          facingMode: "user",
          frameRate: { ideal: 30, max: 60 },
        },
        audio: true,
      });

      setWebcamStream(stream);
      setIsWebcamActive(true);
      setCurrentMode("webcam");

      // Wait for next tick to ensure component has updated
      setTimeout(() => {
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          webcamRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (error) {
      console.error("Error accessing webcam:", error);
      alert("Could not access webcam. Please check permissions.");
    }
  };

  // Stop webcam
  // Update the existing stopWebcam function to include timer cleanup
  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      setWebcamStream(null);
    }
    setIsWebcamActive(false);
    setIsWebcamRecording(false);
    setShowRecordingModal(false);
    setWebcamBlob(null);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setRecordingTimer(30);
    if (webcamRef.current) {
      webcamRef.current.srcObject = null;
    }
  };

  // Start webcam recording
  // Replace the existing startWebcamRecording function
  const startWebcamRecording = () => {
    if (!webcamStream) return;

    try {
      const options = {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 8000000, // 8 Mbps for high quality
        audioBitsPerSecond: 128000, // 128 kbps for audio
      };

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "video/webm;codecs=vp8";
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "video/webm";
        delete options.videoBitsPerSecond; // Fallback without bitrate
        delete options.audioBitsPerSecond;
      }

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "video/webm";
      }

      webcamRecorderRef.current = new MediaRecorder(webcamStream, options);
      webcamChunksRef.current = [];

      webcamRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          webcamChunksRef.current.push(event.data);
        }
      };

      webcamRecorderRef.current.onstop = () => {
        const blob = new Blob(webcamChunksRef.current, { type: "video/webm" });
        setWebcamBlob(blob);
        setIsWebcamRecording(false);
        setShowRecordingModal(true);
        // Clear timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        setRecordingTimer(30);
      };

      webcamRecorderRef.current.start();
      setIsWebcamRecording(true);

      // Start 30-second timer
      setRecordingTimer(30);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTimer((prev) => {
          if (prev <= 1) {
            // Auto-stop recording when timer reaches 0
            if (
              webcamRecorderRef.current &&
              webcamRecorderRef.current.state === "recording"
            ) {
              webcamRecorderRef.current.stop();
            }
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Error starting webcam recording:", error);
      alert("Error starting recording: " + error.message);
    }
  };

  // Replace the existing stopWebcamRecording function
  const stopWebcamRecording = () => {
    if (webcamRecorderRef.current && isWebcamRecording) {
      webcamRecorderRef.current.stop();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Use webcam recording for editing
  const useWebcamRecording = () => {
    if (webcamBlob) {
      // Clean up previous video
      if (videoUrl && videoFile) {
        URL.revokeObjectURL(videoUrl);
      }

      const url = URL.createObjectURL(webcamBlob);
      setVideoFile(webcamBlob);
      setVideoUrl(url);
      setTextOverlays([]);
      setSelectedOverlay(null);
      setVideoLoaded(false);
      setRecordedBlob(null);
      setIsPlaying(false);
      setCurrentMode("edit");

      // Stop webcam
      stopWebcam();
    }
  };

  // Handle video file upload
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("video/")) {
      // Clean up previous video
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setTextOverlays([]);
      setSelectedOverlay(null);
      setVideoLoaded(false);
      setRecordedBlob(null);
      setIsPlaying(false);
      setCurrentMode("edit");

      // Stop webcam if active
      if (isWebcamActive) {
        stopWebcam();
      }
    }
  };

  // Handle video load
  const handleVideoLoad = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      // Fixed canvas size for consistent 9:16 aspect ratio
      const canvasWidth = 720;
      const canvasHeight = 1280;

      setCanvasSize({ width: canvasWidth, height: canvasHeight });
      setVideoLoaded(true);

      // Initialize both canvases with fixed 9:16 ratio
      if (canvasRef.current) {
        canvasRef.current.width = canvasWidth;
        canvasRef.current.height = canvasHeight;
      }
      if (displayCanvasRef.current) {
        displayCanvasRef.current.width = canvasWidth;
        displayCanvasRef.current.height = canvasHeight;

        // Remove any inline styles to allow CSS to handle responsive sizing
        displayCanvasRef.current.style.width = "";
        displayCanvasRef.current.style.height = "";
      }

      drawFrame();
    }
  };

  // Draw a single frame
  const drawFrame = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !displayCanvasRef.current ||
      !videoLoaded
    )
      return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displayCanvas = displayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const displayCtx = displayCanvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scaling and positioning for 9:16 format
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const canvasAspectRatio = canvas.width / canvas.height; // 9:16 = 0.5625

    let drawWidth, drawHeight, offsetX, offsetY;

    if (videoAspectRatio > canvasAspectRatio) {
      // Video is wider than 9:16, fit height and crop sides
      drawHeight = canvas.height;
      drawWidth = drawHeight * videoAspectRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      // Video is taller than 9:16, fit width and crop top/bottom
      drawWidth = canvas.width;
      drawHeight = drawWidth / videoAspectRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    }

    // Draw video frame with proper scaling for 9:16
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

    // Draw text overlays
    const currentTime = video.currentTime;
    textOverlays.forEach((overlay) => {
      if (currentTime >= overlay.startTime && currentTime <= overlay.endTime) {
        ctx.font = `${overlay.fontWeight} ${overlay.fontSize}px ${overlay.fontFamily}`;
        ctx.fillStyle = overlay.color;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(1, overlay.fontSize / 12);
        ctx.textBaseline = "top";

        // Add stroke for better visibility
        ctx.strokeText(overlay.text, overlay.x, overlay.y);
        ctx.fillText(overlay.text, overlay.x, overlay.y);
      }
    });

    // Copy to display canvas with exact 1:1 ratio
    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    displayCtx.drawImage(canvas, 0, 0);
  }, [textOverlays, videoLoaded]);

  // Animation loop for smooth updates
  const animate = useCallback(() => {
    drawFrame();
    if (isPlaying || isRecording) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [drawFrame, isPlaying, isRecording]);

  // Start animation loop when playing
  useEffect(() => {
    if (isPlaying || isRecording) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate, isPlaying, isRecording]);

  // Draw frame when overlays change
  useEffect(() => {
    if (videoLoaded && !isPlaying) {
      drawFrame();
    }
  }, [textOverlays, drawFrame, videoLoaded, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, []);

  // Add new text overlay
  const addTextOverlay = () => {
    const newOverlay = {
      id: Date.now(),
      text: "Your Text Here",
      x: 50,
      y: 100,
      fontSize: 28,
      color: "#ffffff",
      fontFamily: "Impact",
      fontWeight: "bold",
      startTime: 0,
      endTime: videoRef.current?.duration || 10,
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setSelectedOverlay(newOverlay.id);
  };

  // Update text overlay
  const updateTextOverlay = (id, updates) => {
    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  };

  // Remove text overlay
  const removeTextOverlay = (id) => {
    setTextOverlays((overlays) =>
      overlays.filter((overlay) => overlay.id !== id)
    );
    if (selectedOverlay === id) {
      setSelectedOverlay(null);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!videoRef.current || !videoLoaded) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Error playing video:", error);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!canvasRef.current || !videoLoaded) return;

    try {
      const canvas = canvasRef.current;

      if (!MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        if (!MediaRecorder.isTypeSupported("video/webm")) {
          alert("Video recording not supported in this browser");
          return;
        }
      }

      const stream = canvas.captureStream(30);

      const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? { mimeType: "video/webm;codecs=vp9" }
        : { mimeType: "video/webm" };

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        setIsRecording(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Start video playback
      videoRef.current.currentTime = 0;
      await videoRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Error starting recording: " + error.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Download recorded video
  const downloadVideo = () => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-with-overlays-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Handle canvas click for positioning - Fixed for proper scaling
  const handleCanvasClick = (event) => {
    if (!selectedOverlay || !displayCanvasRef.current || !videoLoaded) return;

    const canvas = displayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get the actual canvas dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Get the displayed dimensions
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // Calculate scale factors
    const scaleX = canvasWidth / displayWidth;
    const scaleY = canvasHeight / displayHeight;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    updateTextOverlay(selectedOverlay, { x: Math.round(x), y: Math.round(y) });
  };

  // Go back to mode selection
  const goBackToSelection = () => {
    setCurrentMode("upload");
    if (isWebcamActive) {
      stopWebcam();
    }
    // Clean up video
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl("");
      setVideoFile(null);
      setVideoLoaded(false);
      setTextOverlays([]);
      setSelectedOverlay(null);
      setRecordedBlob(null);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col justify-center items-center relative bg-white text-black overflow-hidden">
      <img src="/images/frameb.svg" className="absolute bottom-0 z-40" />
      <img src="/images/frameb.svg" className="absolute top-0 z-40" />
      <img src="/images/frame.svg" className="absolute bottom-0 right-0 z-40" />
      <img src="/images/frame.svg" className="absolute bottom-0 left-0 z-40" />
      <div className="w-full h-screen mx-auto flex relative ">
        {currentMode === "upload" && (
          <>
            <img src="/images/person.png" className="absolute bottom-0" />
            <div className="border-2 flex flex-col items-center backdrop-blur-2xl w-full h-full p-8 relative">
              <img src="/images/roaradx-logo.svg" className="" />
              <div className="flex-1 flex items-center justify-center relative z-10">
                {/* Upload Option */}
                {/* <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto mb-4 w-16 h-16 text-blue-400" />
                  <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
                  <p className="text-gray-400 mb-6">
                    Choose an existing video file from your device
                  </p>
                  <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors inline-block">
                    <Upload className="inline w-5 h-5 mr-2" />
                    Select Video File
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-3">
                    Supported: MP4, WebM, MOV
                  </p>
                </div>
              </div> */}

                {/* Webcam Option */}

                <div className="flex flex-col items-center gap-4 text-center">
                  <button
                    onClick={startWebcam}
                    className="active:scale-90 transition">
                    <img
                      src="/images/start-button.svg"
                      className="flex self-center"
                    />
                  </button>
                  <p className="text-4xl text-white animate-pulse">START</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-t from-black to-transparent w-full h-96 absolute bottom-0 z-20"></div>
          </>
        )}

        {currentMode === "webcam" && (
          <>
            <div className="w-full h-full bg-[#0F0F0F] flex flex-col items-center justify-center px-8">
              <button
                onClick={goBackToSelection}
                className="text-gray-400 hover:text-white bg-blue-800 p-2 absolute top-5 right-5">
                ← Back
              </button>

              {/* 9:16 Video Container */}
              <div
                className="relative bg-black rounded-lg overflow-hidden"
                style={{
                  aspectRatio: "9/16",
                  height: "100vh",
                  maxWidth: "56.25vh",
                }}>
                <video
                  ref={webcamRef}
                  autoPlay
                  muted
                  playsInline
                  onLoadedMetadata={() => {
                    if (webcamRef.current) {
                      webcamRef.current.play().catch(console.error);
                    }
                  }}
                  className="w-full h-full object-cover"
                />

                {/* Webcam Controls */}
                <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3 z-20">
                  {isWebcamRecording && (
                    <div className="text-white text-2xl font-mono bg-black/50 px-3 py-4 rounded-full">
                      {formatTimer(recordingTimer)}
                    </div>
                  )}

                  {!isWebcamRecording ? (
                    <button
                      onClick={startWebcamRecording}
                      className="relative w-32 h-32 bg-white rounded-full  border-4 border-white transition-colors flex items-center justify-center group">
                      <div className="w-28 h-28 bg-[#E6436D] rounded-full transition-colors"></div>
                    </button>
                  ) : (
                    <button
                      onClick={stopWebcamRecording}
                      className="relative w-32 h-32 bg-white/40 rounded-full flex items-center justify-center">
                      {/* Progress ring */}
                      <svg
                        className="absolute inset-0 w-full h-full -rotate-90"
                        viewBox="0 0 80 80">
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 36}`}
                          strokeDashoffset={`${
                            2 * Math.PI * 36 * (recordingTimer / 30)
                          }`}
                          className="transition-all duration-1000 ease-linear"
                        />
                      </svg>
                      {/* Stop square */}
                      <div className="w-12 h-12 bg-[#E6436D] rounded-sm"></div>
                    </button>
                  )}
                </div>
              </div>

              {/* Recording Complete Modal */}
              {showRecordingModal && webcamBlob && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                  <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full text-center">
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg
                          className="w-8 h-8 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        Recording Complete!
                      </h3>
                      <p className="text-gray-300 text-sm">
                        Would you like to use this recording?
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowRecordingModal(false);
                          setWebcamBlob(null);
                        }}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition-colors">
                        Retake
                      </button>
                      <button
                        onClick={() => {
                          useWebcamRecording();
                          setShowRecordingModal(false);
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors">
                        Use Recording
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* {webcamBlob && (
                <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4 text-center max-w-md w-full">
                  <p className="text-green-200 mb-3">Recording completed!</p>
                  <button
                    onClick={useWebcamRecording}
                    className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors">
                    Use This Recording
                  </button>
                </div>
              )} */}
            </div>
            <div className="bg-gradient-to-t from-black to-transparent w-full h-96 absolute bottom-0 z-0"></div>
          </>
        )}

        {currentMode === "edit" && (
          <div className="flex flex-col justify-center items-center gap-6 bg-blue-950 w-full">
            {/* Video Preview Section - Mobile-first layout */}
            <div className="xl:col-span-2 border w-fit xl:order-1 order-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">TikTok Editor (9:16)</h2>
                <button
                  onClick={goBackToSelection}
                  className="text-gray-400 hover:text-white text-sm">
                  ← New Video
                </button>
              </div>

              {/* Video Player */}
              <div className="space-y-4">
                {/* Hidden video element */}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="hidden"
                  onLoadedMetadata={handleVideoLoad}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false);
                    if (isRecording) {
                      stopRecording();
                    }
                  }}
                  crossOrigin="anonymous"
                />

                {/* Display canvas - TikTok 9:16 format with responsive sizing */}
                <div className="relative w-fit rounded-xl overflow-hidden mx-auto flex justify-center h-12">
                  {videoLoaded ? (
                    <div className="h-24">
                      {/* DONT REMOVE THE CANVAS BELOW VINOD */}
                      <canvas
                        ref={displayCanvasRef}
                        className="cursor-crosshair rounded-xl hidden border-2  border-gray-600"
                        onClick={handleCanvasClick}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "80vh",
                          height: "auto",
                          width: "auto",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full flex items-center justify-center text-gray-400 bg-gray-800 rounded-xl"
                      style={{ aspectRatio: "9/16", maxWidth: "360px" }}>
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                        Loading video...
                      </div>
                    </div>
                  )}

                  {/* Video Controls - TikTok style */}
                  {videoLoaded && (
                    <div className="flex gap-2">
                      <button
                        onClick={togglePlay}
                        disabled={isRecording}
                        className="bg-white/20 backdrop-blur-sm hover:bg-white/30 disabled:bg-gray-600/50 p-3 rounded-full transition-colors">
                        {isPlaying ? (
                          <Pause className="w-6 h-6 text-white" />
                        ) : (
                          <Play className="w-6 h-6 text-white" />
                        )}
                      </button>

                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          className="bg-red-500/80 backdrop-blur-sm hover:bg-red-600/80 p-3 rounded-full transition-colors"
                          title="Export TikTok Video">
                          <Video className="w-6 h-6 text-white" />
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="bg-red-700/80 backdrop-blur-sm p-3 rounded-full animate-pulse"
                          title="Stop Export">
                          <Square className="w-6 h-6 text-white" />
                        </button>
                      )}

                      {recordedBlob && (
                        <button
                          onClick={downloadVideo}
                          className="bg-green-500/80 backdrop-blur-sm hover:bg-green-600/80 p-3 rounded-full transition-colors"
                          title="Download TikTok Video">
                          <Download className="w-6 h-6 text-white" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Hidden processing canvas */}
                <canvas ref={canvasRef} className="border max-h-[500px]" />
                {/* Export Status */}
                {recordedBlob && (
                  <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4 text-center">
                    <p className="text-green-200 mb-2">
                      ✅ TikTok video exported successfully!
                    </p>
                    <p className="text-green-300/80 text-sm">
                      Perfect 9:16 aspect ratio for social media
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Text Overlay Controls - Mobile-friendly */}
            <div className="xl:col-span-2 xl:order-2 order-2 space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Type className="w-5 h-5" />
                    Text Overlays
                  </h3>
                  {videoLoaded && (
                    <button
                      onClick={addTextOverlay}
                      className="bg-blue-600 hover:bg-blue-700 p-2 rounded-full transition-colors"
                      title="Add text overlay">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {!videoLoaded && videoFile && (
                  <p className="text-gray-400 text-sm mb-4">Loading video...</p>
                )}

                {/* Overlay List */}
                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                  {textOverlays.map((overlay, index) => (
                    <div
                      key={overlay.id}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        selectedOverlay === overlay.id
                          ? "border-blue-500 bg-blue-900/20"
                          : "border-gray-600 bg-gray-700 hover:bg-gray-650"
                      }`}
                      onClick={() => setSelectedOverlay(overlay.id)}>
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm">
                          {index + 1}. {overlay.text || "Empty text"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTextOverlay(overlay.id);
                          }}
                          className="text-red-400 hover:text-red-300"
                          title="Remove overlay">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Overlay Controls */}
                {selectedOverlay && (
                  <div className="space-y-3 border-t border-gray-600 pt-4">
                    <p className="text-sm text-gray-400">
                      👆 Tap on video to position text
                    </p>
                    {(() => {
                      const overlay = textOverlays.find(
                        (o) => o.id === selectedOverlay
                      );
                      if (!overlay) return null;

                      return (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Text Content
                            </label>
                            <input
                              type="text"
                              value={overlay.text}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  text: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-sm"
                              placeholder="Enter your text..."
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                X Position
                              </label>
                              <input
                                type="number"
                                value={overlay.x}
                                onChange={(e) =>
                                  updateTextOverlay(overlay.id, {
                                    x: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Y Position
                              </label>
                              <input
                                type="number"
                                value={overlay.y}
                                onChange={(e) =>
                                  updateTextOverlay(overlay.id, {
                                    y: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Font Size: {overlay.fontSize}px
                            </label>
                            <input
                              type="range"
                              min="16"
                              max="48"
                              value={overlay.fontSize}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  fontSize: parseInt(e.target.value),
                                })
                              }
                              className="w-full accent-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Text Color
                            </label>
                            <div className="flex gap-2 items-center">
                              <input
                                type="color"
                                value={overlay.color}
                                onChange={(e) =>
                                  updateTextOverlay(overlay.id, {
                                    color: e.target.value,
                                  })
                                }
                                className="w-12 h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                              />
                              <span className="text-sm text-gray-400">
                                {overlay.color}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Font Style
                            </label>
                            <select
                              value={overlay.fontFamily}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  fontFamily: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-sm">
                              <option value="Arial">Arial (Clean)</option>
                              <option value="Impact">Impact (Bold)</option>
                              <option value="Georgia">Georgia (Elegant)</option>
                              <option value="Courier New">
                                Courier (Typewriter)
                              </option>
                              <option value="Comic Sans MS">
                                Comic Sans (Fun)
                              </option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Show at (s)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={overlay.startTime}
                                onChange={(e) =>
                                  updateTextOverlay(overlay.id, {
                                    startTime: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Hide at (s)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={overlay.endTime}
                                onChange={(e) =>
                                  updateTextOverlay(overlay.id, {
                                    endTime: parseFloat(e.target.value) || 10,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-sm"
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* TikTok Instructions */}
              <div className="bg-gradient-to-r from-pink-900/20 to-purple-900/20 border border-pink-600/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2 text-pink-200">
                  📱 TikTok Creator Guide:
                </h3>
                <ol className="text-xs space-y-1 text-pink-100/80 list-decimal list-inside">
                  <li>Record or upload your video</li>
                  <li>Add catchy text overlays</li>
                  <li>Tap video to position text perfectly</li>
                  <li>Set timing for text appearance</li>
                  <li>Export in perfect 9:16 ratio</li>
                  <li>Share on TikTok, Instagram Stories!</li>
                </ol>
              </div>

              {/* Quick Text Presets */}
              {selectedOverlay && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    🎨 Quick Text Styles:
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        updateTextOverlay(selectedOverlay, {
                          fontSize: 32,
                          color: "#ffffff",
                          fontFamily: "Impact",
                          fontWeight: "bold",
                        })
                      }
                      className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 p-2 rounded text-xs transition-colors">
                      Bold White
                    </button>
                    <button
                      onClick={() =>
                        updateTextOverlay(selectedOverlay, {
                          fontSize: 28,
                          color: "#fbbf24",
                          fontFamily: "Arial",
                          fontWeight: "bold",
                        })
                      }
                      className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 p-2 rounded text-xs transition-colors">
                      Golden Glow
                    </button>
                    <button
                      onClick={() =>
                        updateTextOverlay(selectedOverlay, {
                          fontSize: 24,
                          color: "#a78bfa",
                          fontFamily: "Georgia",
                          fontWeight: "normal",
                        })
                      }
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 p-2 rounded text-xs transition-colors">
                      Purple Elegant
                    </button>
                    <button
                      onClick={() =>
                        updateTextOverlay(selectedOverlay, {
                          fontSize: 30,
                          color: "#10b981",
                          fontFamily: "Impact",
                          fontWeight: "bold",
                        })
                      }
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 p-2 rounded text-xs transition-colors">
                      Neon Green
                    </button>
                  </div>
                </div>
              )}

              {/* Format Info */}
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                <p className="text-blue-200 text-xs">
                  <strong>📐 Perfect Format:</strong> Videos export in 9:16
                  aspect ratio (360x640) - ideal for TikTok, Instagram Stories,
                  YouTube Shorts, and all vertical social platforms!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default VideoTextOverlayApp;
