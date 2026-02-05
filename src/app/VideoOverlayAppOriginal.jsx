/** @format */

"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Play,
  Pause,
  Download,
  X,
  Square,
  Video,
  Share,
  Home,
  Camera,
  StopCircle,
} from "lucide-react";
import TikTokLoader from "./components/TikTokLoader";
import ReactDOM from "react-dom";
import { QRCodeSVG } from "qrcode.react";

const VideoTextOverlayApp = () => {
  // Configurable recording settings
  const MAX_RECORDING_DURATION = 30; // seconds
  const COUNTDOWN_DURATION = 3; // seconds

  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasAutoRecorded, setHasAutoRecorded] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [shareUrl, setShareUrl] = useState("");

  // Webcam recording states
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isWebcamRecording, setIsWebcamRecording] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [countdown, setCountdown] = useState(0); // 3, 2, 1, 0 (0 means not counting)
  const [recordingProgress, setRecordingProgress] = useState(0); // 0-100 percentage
  const [recordingTimeElapsed, setRecordingTimeElapsed] = useState(0); // seconds

  const webcamVideoRef = useRef(null);
  const webcamRecorderRef = useRef(null);
  const webcamChunksRef = useRef([]);
  const countdownTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const animationFrameRef = useRef(null);

  const [logo, setLogo] = useState(null);
  const [frame, setFrame] = useState(null);

  const [customDiv, setCustomDiv] = useState({
    text: "I was at TikTok Accelerate",
    x: 100,
    y: 150,
    startTime: 1,
    endTime: 10,
    width: 500,
    height: 64,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [cloudinaryUrl, setCloudinaryUrl] = useState("");
  const [showQRPopup, setShowQRPopup] = useState(false);

  const CLOUDINARY_CLOUD_NAME = "vccpsacloud";
  const CLOUDINARY_UPLOAD_PRESET = "my-uploads";
  const [musicAudio, setMusicAudio] = useState(null);
  const [countdownAudio, setCountdownAudio] = useState(null);

  // Initialize background music
  useEffect(() => {
    const audio = new Audio("/audio/tiktokaudio2.mp3");
    audio.loop = true;
    audio.muted = true;
    audio.preload = "auto";
    setMusicAudio(audio);

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Initialize countdown audio
  useEffect(() => {
    const audio = new Audio("/audio/countdown.mp3");
    audio.loop = false;
    audio.preload = "auto";
    setCountdownAudio(audio);

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = "/images/roaradx-logo.svg";
    img.onload = () => setLogo(img);
  }, []);

  useEffect(() => {
    if (videoUrl) {
      setHasAutoRecorded(false);
      setIsProcessing(false);
    }
  }, [videoUrl]);

  useEffect(() => {
    const img = new Image();
    img.src = "/images/white-frame.png";
    img.onload = () => setFrame(img);
  }, []);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
      }
      // Cleanup timers
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [webcamStream]);

  // Set webcam video srcObject when stream is available
  useEffect(() => {
    if (webcamStream && webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 1280 },
          facingMode: "user",
        },
        audio: true,
      });

      setWebcamStream(stream);
      setIsWebcamActive(true);
    } catch (error) {
      console.error("Error accessing webcam:", error);
      alert(
        "Could not access webcam. Please ensure you've granted permission."
      );
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    // Clear all timers
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Stop countdown audio if playing
    if (countdownAudio && !countdownAudio.paused) {
      countdownAudio.pause();
      countdownAudio.currentTime = 0;
    }

    // Reset states
    setCountdown(0);
    setRecordingProgress(0);
    setRecordingTimeElapsed(0);

    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      setWebcamStream(null);
    }
    setIsWebcamActive(false);
    setIsWebcamRecording(false);
  };

  // Start countdown before recording
  const startRecordingWithCountdown = () => {
    if (!webcamStream) return;

    // Play countdown audio
    if (countdownAudio) {
      countdownAudio.currentTime = 0;
      countdownAudio
        .play()
        .catch((e) => console.log("Countdown audio play failed:", e));
    }

    // Start countdown from COUNTDOWN_DURATION
    setCountdown(COUNTDOWN_DURATION);

    let currentCount = COUNTDOWN_DURATION;
    countdownTimerRef.current = setInterval(() => {
      currentCount--;
      if (currentCount > 0) {
        setCountdown(currentCount);
      } else {
        setCountdown(0);
        clearInterval(countdownTimerRef.current);
        // Start actual recording after countdown
        startActualRecording();
      }
    }, 1000);
  };

  // Start the actual recording after countdown
  const startActualRecording = () => {
    if (!webcamStream) return;

    webcamChunksRef.current = [];
    recordingStartTimeRef.current = Date.now();
    setRecordingTimeElapsed(0);
    setRecordingProgress(0);

    // Create audio stream with only background music (no webcam microphone)
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const destination = audioContext.createMediaStreamDestination();

    // Add only background music (removed webcam microphone audio)
    if (musicAudio) {
      try {
        musicAudio.currentTime = 0;
        musicAudio.muted = false;
        musicAudio.play().catch((e) => console.log("Audio play failed:", e));

        const musicSource = audioContext.createMediaElementSource(musicAudio);
        musicSource.connect(destination);
        musicSource.connect(audioContext.destination); // Also play through speakers
      } catch (error) {
        console.error("Error adding background music:", error);
      }
    }

    // Create combined stream with video from webcam and music audio only
    const combinedStream = new MediaStream([
      ...webcamStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    const options = {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 2500000,
    };

    try {
      webcamRecorderRef.current = new MediaRecorder(combinedStream, options);
    } catch (e) {
      // Fallback to default if vp9 not supported
      webcamRecorderRef.current = new MediaRecorder(combinedStream);
    }

    webcamRecorderRef.current.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        webcamChunksRef.current.push(event.data);
      }
    };

    webcamRecorderRef.current.onstop = () => {
      const blob = new Blob(webcamChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      // Stop background music
      if (musicAudio && !musicAudio.paused) {
        musicAudio.pause();
        musicAudio.currentTime = 0;
      }

      // Reset recording states
      setRecordingProgress(0);
      setRecordingTimeElapsed(0);

      // Stop the webcam
      stopWebcam();

      // Load the recorded video into the editor
      setVideoUrl(url);
      setVideoLoaded(false);
      setRecordedBlob(null);
      setIsPlaying(false);
      setUserHasInteracted(true);
    };

    webcamRecorderRef.current.start();
    setIsWebcamRecording(true);

    // Start progress tracking
    recordingTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
      const progress = (elapsed / MAX_RECORDING_DURATION) * 100;

      setRecordingTimeElapsed(elapsed);
      setRecordingProgress(Math.min(progress, 100));

      // Auto-stop at max duration
      if (elapsed >= MAX_RECORDING_DURATION) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;

        // Stop recording
        if (
          webcamRecorderRef.current &&
          webcamRecorderRef.current.state !== "inactive"
        ) {
          webcamRecorderRef.current.stop();
          setIsWebcamRecording(false);
        }
      }
    }, 100); // Update every 100ms for smooth progress
  };

  // Stop recording from webcam
  const stopWebcamRecording = () => {
    console.log("stopWebcamRecording called"); // Debug log
    console.log("Timer ref:", recordingTimerRef.current); // Debug log
    console.log("Recorder state:", webcamRecorderRef.current?.state); // Debug log

    // Clear the timer first to prevent multiple calls
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Stop the media recorder if it's recording
    if (
      webcamRecorderRef.current &&
      webcamRecorderRef.current.state !== "inactive"
    ) {
      console.log("Stopping recorder..."); // Debug log
      webcamRecorderRef.current.stop();
      setIsWebcamRecording(false);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      const canvasWidth = 720;
      const canvasHeight = 1280;
      setVideoLoaded(true);

      if (canvasRef.current) {
        canvasRef.current.width = canvasWidth;
        canvasRef.current.height = canvasHeight;
      }
      if (displayCanvasRef.current) {
        displayCanvasRef.current.width = canvasWidth;
        displayCanvasRef.current.height = canvasHeight;
        displayCanvasRef.current.style.width = "";
        displayCanvasRef.current.style.height = "";
      }

      drawFrame();
    }
  };

  useEffect(() => {
    if (
      videoLoaded &&
      videoUrl &&
      !hasAutoRecorded &&
      videoRef.current &&
      userHasInteracted
    ) {
      console.log("Auto-starting recording after user interaction...");
      setHasAutoRecorded(true);
      setTimeout(() => {
        startRecording();
      }, 500);
    }
  }, [videoLoaded, videoUrl, hasAutoRecorded, userHasInteracted]);

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

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (videoAspect > canvasAspect) {
      drawHeight = canvasHeight;
      drawWidth = drawHeight * videoAspect;
      offsetX = (canvasWidth - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / videoAspect;
      offsetX = 0;
      offsetY = (canvasHeight - drawHeight) / 2;
    }

    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

    const currentTime = video.currentTime;

    // if (logo) {
    //   const logoWidth = 150;
    //   const logoHeight = (logo.height / logo.width) * logoWidth;
    //   const logoX = canvasWidth - logoWidth - 20;
    //   const logoY = 20;
    //   ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
    // }

    if (frame) {
      ctx.drawImage(frame, 0, 0, canvasWidth, canvasHeight);
    }

    // if (
    //   currentTime >= customDiv.startTime &&
    //   currentTime <= customDiv.endTime
    // ) {
    //   const divX = customDiv.x;
    //   const divY = customDiv.y;
    //   const divWidth = customDiv.width;
    //   const divHeight = customDiv.height;
    //   const offset = 8;

    //   ctx.fillStyle = "#60A5FA";
    //   ctx.fillRect(divX - offset, divY - offset, divWidth, divHeight);

    //   ctx.fillStyle = "#EC4899";
    //   ctx.fillRect(divX + offset, divY + offset, divWidth, divHeight);

    //   ctx.fillStyle = "#000000";
    //   ctx.fillRect(divX, divY, divWidth, divHeight);

    //   ctx.fillStyle = "#FFFFFF";
    //   ctx.font = "bold 32px Arial";
    //   ctx.textAlign = "center";
    //   ctx.textBaseline = "middle";
    //   ctx.fillText(customDiv.text, divX + divWidth / 2, divY + divHeight / 2);
    // }

    displayCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    displayCtx.drawImage(canvas, 0, 0);

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    }
  }, [
    videoLoaded,
    isPlaying,
    logo,
    frame,
    customDiv.x,
    customDiv.y,
    customDiv.width,
    customDiv.height,
    customDiv.text,
    customDiv.startTime,
    customDiv.endTime,
  ]);

  useEffect(() => {
    if (isPlaying && videoLoaded) {
      drawFrame();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, videoLoaded, drawFrame]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    setUserHasInteracted(true);

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const startRecording = async () => {
    if (!canvasRef.current || !videoRef.current) return;

    videoRef.current.currentTime = 0;
    chunksRef.current = [];

    const stream = canvasRef.current.captureStream(30);

    // Get audio from the original webcam recording (which already has music)
    if (videoRef.current.srcObject) {
      const audioTracks = videoRef.current.srcObject.getAudioTracks();
      audioTracks.forEach((track) => stream.addTrack(track));
    }
    // If video is a blob/url (from webcam recording), get its audio track
    else {
      // The video already has the music baked in from webcam recording
      // We need to extract and use that audio
      try {
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(videoRef.current);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioContext.destination);

        destination.stream.getAudioTracks().forEach((track) => {
          stream.addTrack(track);
        });
      } catch (error) {
        console.error("Error adding audio to recording:", error);
      }
    }

    const options = {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 2500000,
    };

    try {
      mediaRecorderRef.current = new MediaRecorder(stream, options);
    } catch (e) {
      mediaRecorderRef.current = new MediaRecorder(stream);
    }

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);

    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }

      if (musicAudio && !musicAudio.paused) {
        musicAudio.pause();
      }
    }
  };

  useEffect(() => {
    const handleVideoEnd = () => {
      if (isRecording) {
        stopRecording();
      }
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener("ended", handleVideoEnd);
      return () => video.removeEventListener("ended", handleVideoEnd);
    }
  }, [isRecording]);

  const downloadVideo = () => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "video-with-text.webm";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const uploadToCloudinary = async () => {
    if (!recordedBlob) {
      alert("Please record a video first");
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", recordedBlob);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Upload successful:", data);
      setCloudinaryUrl(data.secure_url);

      try {
        const shareResponse = await fetch("/api/videos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            videoUrl: data.secure_url,
          }),
        });

        if (shareResponse.ok) {
          const shareData = await shareResponse.json();
          const fullShareUrl = `${window.location.origin}/${shareData.videoId}`;
          setShareUrl(fullShareUrl);
          setVideoId(shareData.id);
          console.log("Share link created:", fullShareUrl);
        }
      } catch (shareError) {
        console.error("Error creating share link:", shareError);
      }

      setShowQRPopup(true);
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      alert("Failed to upload video. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const goBackToHome = () => {
    window.location.reload();
    setShowQRPopup(false);
    setVideoUrl("");
    setRecordedBlob(null);
    setVideoLoaded(false);
    setIsPlaying(false);
    setHasAutoRecorded(false);
    setCloudinaryUrl("");
    setShareUrl("");
    setVideoId(null);
  };

  return (
    <div className="h-svh w-full flex justify-center items-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="w-full p-4 h-svh flex flex-col justify-center items-center">
        <div className="flex flex-col lg:flex-row gap-6 h-full w-full">
          {/* Video Player */}
          <div className="flex-1 flex flex-col justify-center items-center ">
            <div className="p-6 w-full flex flex-col justify-center items-center">
              <div className="relative bg-black rounded-lg overflow-hidden mb-4 w-full">
                {/* Canvas for edited video playback */}
                <canvas
                  ref={displayCanvasRef}
                  className="w-full h-auto"
                  style={{ display: videoUrl ? "block" : "none" }}
                />

                {/* Webcam preview - visible when webcam is active and no video loaded */}
                {isWebcamActive && !videoUrl && (
                  <div className="relative">
                    <video
                      ref={webcamVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-auto"
                    />

                    {/* Countdown Display - overlay on video */}
                    {countdown > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
                        <div className="text-white text-9xl font-bold animate-ping">
                          {countdown}
                        </div>
                      </div>
                    )}

                    {/* Recording Button Overlay - Camera UI style */}
                    {countdown === 0 && (
                      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 z-50 pointer-events-auto">
                        {/* Recording Button with Circular Progress */}
                        <div className="relative flex items-center justify-center pointer-events-auto">
                          {/* Circular Progress Ring */}
                          {isWebcamRecording && (
                            <svg className="absolute w-24 h-24 -rotate-90 pointer-events-none">
                              <circle
                                cx="48"
                                cy="48"
                                r="44"
                                stroke="rgba(255, 255, 255, 0.3)"
                                strokeWidth="4"
                                fill="none"
                              />
                              <circle
                                cx="48"
                                cy="48"
                                r="44"
                                stroke="#ffffff"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 44}`}
                                strokeDashoffset={`${
                                  2 *
                                  Math.PI *
                                  44 *
                                  (1 - recordingProgress / 100)
                                }`}
                                strokeLinecap="round"
                                style={{
                                  transition: "stroke-dashoffset 0.1s linear",
                                }}
                              />
                            </svg>
                          )}

                          {/* Recording Button */}
                          {!isWebcamRecording ? (
                            <button
                              onClick={startRecordingWithCountdown}
                              className="w-20 h-20 rounded-full bg-white border-4 border-white transition-all flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 pointer-events-auto z-50">
                              <div className="w-16 h-16 rounded-full bg-red-600"></div>
                            </button>
                          ) : (
                            <button
                              onClick={stopWebcamRecording}
                              className="w-20 h-20 rounded-full bg-white border-4 border-white transition-all flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 pointer-events-auto z-50 cursor-pointer">
                              <div className="w-8 h-8 bg-red-600 rounded"></div>
                            </button>
                          )}
                        </div>

                        {/* Recording Time Display */}
                        {isWebcamRecording && (
                          <div className="text-white text-xl font-semibold bg-black/50 px-4 py-2 rounded-full pointer-events-none">
                            {Math.floor(recordingTimeElapsed)}s /{" "}
                            {MAX_RECORDING_DURATION}s
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Start Screen - Only show when no webcam active */}
                {!videoUrl && !isWebcamActive && (
                  <div className="aspect-[9/16] flex items-center justify-center bg-gray-800">
                    <button
                      onClick={startWebcam}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-8 px-12 rounded-2xl text-6xl font-bold transition flex items-center justify-center gap-6 shadow-2xl">
                      <Camera className="w-16 h-16" />
                      Start
                    </button>
                  </div>
                )}

                {/* Hidden video element for processed video */}
                {videoUrl && (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onLoadedMetadata={handleVideoLoad}
                    className="hidden"
                    playsInline
                  />
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Video Controls */}
              {videoUrl && (
                <div className="flex gap-3">
                  {recordedBlob && !isRecording && (
                    <button
                      onClick={handlePlayPause}
                      disabled={isRecording}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2">
                      {isPlaying ? (
                        <>
                          <Pause className="w-5 h-5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Play
                        </>
                      )}
                    </button>
                  )}

                  {!isRecording ? (
                    recordedBlob ? (
                      <>
                        <button
                          onClick={downloadVideo}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2">
                          <Download className="w-5 h-5" />
                          Download
                        </button>
                        <button
                          onClick={uploadToCloudinary}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2">
                          <Share className="w-5 h-5" />
                          Share
                        </button>
                        <button
                          onClick={goBackToHome}
                          className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2">
                          <Home className="w-5 h-5" />
                        </button>
                      </>
                    ) : null
                  ) : (
                    <></>
                    // <button
                    //   onClick={stopRecording}
                    //   className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2">
                    //   <Square className="w-5 h-5" />
                    //   Stop Recording
                    // </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* QR pop up */}
          {showQRPopup && cloudinaryUrl !== "" && (
            <div
              className="absolute bg-black/10 backdrop-blur-lg w-full inset-0 z-50 flex items-center justify-center"
              onClick={() => setShowQRPopup(false)}>
              <div
                className="flex min-h-[60rem] mx-12 justify-center items-center w-3xl relative"
                onClick={(e) => e.stopPropagation()}>
                <div className="bg-[#65D2E9] rounded-2xl h-full w-full absolute -translate-x-6 translate-y-6"></div>
                <div className="bg-white border-2 border-gray-200 rounded-2xl h-full w-full absolute z-10 flex flex-col items-center p-10">
                  {/* <img
                    src="/images/roaradx-logo.svg"
                    className="w-72 h-auto"
                    alt="Logo"
                  /> */}
                  <div className="flex flex-col border-amber-700 justify-center items-center w-full text-center">
                    <p className="text-4xl w-full font-medium text-[#FA2D6C] py-12">
                      Scan to Share
                    </p>
                    <QRCodeSVG
                      value={shareUrl || cloudinaryUrl}
                      size={500}
                      className="h-auto"
                    />

                    <button
                      className="text-white text-4xl mt-20 active:scale-95 min-w-52 bg-black py-8 px-16 rounded-full z-50 transition"
                      onClick={goBackToHome}>
                      Record a New Video
                    </button>
                  </div>
                </div>
                <div className="bg-[#FA2D6C] rounded-2xl h-full w-full absolute translate-x-6 -translate-y-6"></div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="fixed inset-0 bg-gradient-to-t from-[#040404] to-[#141414] text-white flex items-center justify-center p-4 z-50">
              {/* <img
                src="/images/roaradx-white-logo.svg"
                className="absolute top-12 w-56 h-auto"
                alt="Logo"
              />
              <img
                src="/images/tik-tok-logo.svg"
                className="absolute bottom-12 w-56 h-auto"
                alt="TikTok Logo"
              /> */}
              <div className="text-center flex flex-col gap-2">
                <TikTokLoader />
                <p className="text-gray-400 text-2xl">Getting Ready...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoTextOverlayApp;
