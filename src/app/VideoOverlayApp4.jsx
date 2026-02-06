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
  RefreshCcw,
} from "lucide-react";
import TikTokLoader from "./components/TikTokLoader";
import ReactDOM from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import LetsStartAnimation from "./components/LetsStartAnimation";
import { motion, AnimatePresence } from "framer-motion";

const VideoTextOverlayApp = () => {
  // Configurable recording settings
  const MAX_RECORDING_DURATION = parseInt(
    process.env.NEXT_PUBLIC_MAX_RECORDING_DURATION || "30",
  ); // seconds
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
  const [isQRLoading, setIsQRLoading] = useState(false);

  // Webcam recording states
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isWebcamRecording, setIsWebcamRecording] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [countdown, setCountdown] = useState(0); // 3, 2, 1, 0 (0 means not counting)
  const [recordingProgress, setRecordingProgress] = useState(0); // 0-100 percentage
  const [recordingTimeElapsed, setRecordingTimeElapsed] = useState(0); // seconds
  const [isWebcamUIVisible, setIsWebcamUIVisible] = useState(false); // webcam UI visibility
  const [showLogo, setShowLogo] = useState(false); // post process logo visibility

  const webcamVideoRef = useRef(null);
  const webcamRecorderRef = useRef(null);
  const webcamChunksRef = useRef([]);
  const countdownTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const musicAudioRef = useRef(null);
  const countdownAudioRef = useRef(null);

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

  const CLOUDINARY_CLOUD_NAME =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "vccpsacloud";
  const CLOUDINARY_UPLOAD_PRESET =
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "my-uploads";
  const [musicAudio, setMusicAudio] = useState(null);
  const [countdownAudio, setCountdownAudio] = useState(null);

  // Initialize background music
  useEffect(() => {
    if (!musicAudioRef.current) {
      const audio = new Audio("/audio/bg_music.mp3");
      audio.loop = true;
      audio.muted = true;
      audio.preload = "auto";
      musicAudioRef.current = audio;
      setMusicAudio(audio);
    }

    return () => {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current.src = "";
      }
    };
  }, []);

  // Initialize countdown audio
  useEffect(() => {
    if (!countdownAudioRef.current) {
      const audio = new Audio("/audio/countdown.mp3");
      audio.loop = false;
      audio.preload = "auto";
      countdownAudioRef.current = audio;
      setCountdownAudio(audio);
    }

    return () => {
      if (countdownAudioRef.current) {
        countdownAudioRef.current.pause();
        countdownAudioRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    if (videoUrl) {
      setHasAutoRecorded(false);
      setIsProcessing(false);
    }
  }, [videoUrl]);

  useEffect(() => {
    const img = new Image();
    img.src = "/images/closeup-frame.png";
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

  // Start webcam - MODIFIED TO REQUEST LANDSCAPE
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 }, // Swapped: now requesting landscape
          height: { ideal: 720 }, // Will be rotated to portrait in display
          facingMode: "user",
        },
        audio: false, // No audio needed from camera since we're using background music only
      });

      setWebcamStream(stream);
      setIsWebcamActive(true);
      setIsWebcamUIVisible(true); // Show UI
    } catch (error) {
      console.error("Error accessing webcam:", error);
      alert(
        "Could not access webcam. Please ensure you've granted permission.",
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
        .catch((e) => console.error("Countdown audio error:", e));
    }

    // Set initial countdown
    setCountdown(COUNTDOWN_DURATION);

    // Start countdown timer
    let count = COUNTDOWN_DURATION;
    countdownTimerRef.current = setInterval(() => {
      count--;
      setCountdown(count);

      if (count === 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        startWebcamRecording();
      }
    }, 1000);
  };

  // Start webcam recording - MODIFIED TO HANDLE ROTATED VIDEO WITH OVERLAYS AND FREEZE FRAME
  const startWebcamRecording = () => {
    try {
      // Create a canvas to handle the rotation
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Set canvas size to portrait (swap width/height from landscape source)
      canvas.width = 720; // Portrait width
      canvas.height = 1280; // Portrait height

      // Capture the canvas stream
      const canvasStream = canvas.captureStream(30); // 30 fps

      // Add only background music (no microphone audio)
      if (musicAudio) {
        try {
          const audioContext = new (
            window.AudioContext || window.webkitAudioContext
          )();
          const musicSource = audioContext.createMediaElementSource(musicAudio);
          const destination = audioContext.createMediaStreamDestination();

          // Connect music to destination
          musicSource.connect(destination);

          // Also connect to audio context destination so we can hear it during recording
          musicSource.connect(audioContext.destination);

          // Unmute and play music
          musicAudio.muted = false;
          musicAudio.currentTime = 0;
          musicAudio
            .play()
            .catch((e) => console.error("Music playback error:", e));

          // Add music track to the canvas stream
          destination.stream.getAudioTracks().forEach((track) => {
            canvasStream.addTrack(track);
          });
        } catch (error) {
          console.error("Error setting up music:", error);
        }
      }

      // Start drawing rotated video to canvas
      const videoElement = webcamVideoRef.current;
      let animationId;
      let startTime = Date.now();
      let isFreezing = false;
      let freezeFrameImage = null;
      let freezeStartTime = null;
      const FREEZE_DURATION = 5000; // 5 seconds in milliseconds

      const drawFrame = () => {
        // If we're in freeze mode
        if (isFreezing) {
          const freezeElapsed = Date.now() - freezeStartTime;

          if (freezeElapsed >= FREEZE_DURATION) {
            // Freeze duration complete, stop recording
            cancelAnimationFrame(animationId);
            if (
              webcamRecorderRef.current &&
              webcamRecorderRef.current.state !== "inactive"
            ) {
              webcamRecorderRef.current.stop();
            }
            return;
          }

          // Draw the frozen frame
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (freezeFrameImage) {
            ctx.drawImage(freezeFrameImage, 0, 0, canvas.width, canvas.height);
          }

          // Draw frame overlay on frozen image
          if (frame) {
            const frameWidth = canvas.width;
            const frameHeight = canvas.height;
            ctx.drawImage(frame, 0, 0, frameWidth, frameHeight);
          }

          animationId = requestAnimationFrame(drawFrame);
          return;
        }

        // Normal recording mode
        if (!videoElement || videoElement.readyState < 2) {
          animationId = requestAnimationFrame(drawFrame);
          return;
        }

        // Calculate current time in seconds
        const currentTime = (Date.now() - startTime) / 1000;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Save context state
        ctx.save();

        // Move to center of canvas
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // flip the feed
        ctx.scale(-1, 1);

        // Rotate 90 degrees clockwise
        ctx.rotate(Math.PI / 2);

        // Draw video (centered, rotated)
        // Source is 1280x720 (landscape), drawing as if it were portrait
        ctx.drawImage(
          videoElement,
          -canvas.height / 2, // x position (using height because rotated)
          -canvas.width / 2, // y position (using width because rotated)
          canvas.height, // width (swapped)
          canvas.width, // height (swapped)
        );

        // Restore context state
        ctx.restore();

        // Now draw overlays on the portrait canvas (not rotated)

        // Draw frame if available
        if (frame) {
          const frameWidth = canvas.width;
          const frameHeight = canvas.height;
          ctx.drawImage(frame, 0, 0, frameWidth, frameHeight);
        }

        animationId = requestAnimationFrame(drawFrame);
      };

      drawFrame();

      // Create MediaRecorder with the canvas stream
      const options = { mimeType: "video/webm;codecs=vp9" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "video/webm;codecs=vp8";
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = "video/webm";
        }
      }

      const recorder = new MediaRecorder(canvasStream, options);
      webcamChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          webcamChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Stop animation
        cancelAnimationFrame(animationId);

        const blob = new Blob(webcamChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setRecordedBlob(blob);
        setShowLogo(false);

        // Stop webcam after recording
        stopWebcam();

        // Auto-upload to get QR code
        setIsQRLoading(true);

        // uploadToCloudinaryForQR(blob); // Uncomment this to use CLOUDINARY instead of Cloudlflare
        uploadToR2ForQR(blob); // comment this to use CLOUDINARY instead of Cloudlflare
      };

      webcamRecorderRef.current = recorder;
      recorder.start(100); // Collect data every 100ms
      setIsWebcamRecording(true);

      // Store animation ID and canvas context for access in stop function
      recorder.animationId = animationId;
      recorder.canvas = canvas;
      recorder.ctx = ctx;
      recorder.drawFrame = drawFrame;

      // Start recording timer
      recordingStartTimeRef.current = Date.now();
      setRecordingTimeElapsed(0);
      setRecordingProgress(0);

      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingTimeElapsed(elapsed);
        setRecordingProgress((elapsed / MAX_RECORDING_DURATION) * 100);

        // Auto-stop when max duration reached
        if (elapsed >= MAX_RECORDING_DURATION) {
          stopWebcamRecording();
        }
      }, 100);
    } catch (error) {
      console.error("Error starting webcam recording:", error);
      alert("Could not start recording. Please try again.");
    }
  };

  const stopWebcamRecording = () => {
    if (
      webcamRecorderRef.current &&
      webcamRecorderRef.current.state !== "inactive"
    ) {
      // IMMEDIATELY hide webcam UI, recording controls, and stop music
      setIsWebcamUIVisible(false);
      setShowLogo(true);
      setIsWebcamRecording(false);

      // Stop background music immediately
      if (musicAudio) {
        musicAudio.pause();
        musicAudio.currentTime = 0;
        musicAudio.muted = true;
      }

      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // Capture the last frame BEFORE stopping the stream
      const canvas = webcamRecorderRef.current.canvas;
      const ctx = webcamRecorderRef.current.ctx;
      const videoElement = webcamVideoRef.current;

      if (canvas && ctx && videoElement) {
        // Create a snapshot of the current canvas state
        const freezeCanvas = document.createElement("canvas");
        freezeCanvas.width = canvas.width;
        freezeCanvas.height = canvas.height;
        const freezeCtx = freezeCanvas.getContext("2d");

        // Draw current frame to snapshot canvas
        freezeCtx.clearRect(0, 0, freezeCanvas.width, freezeCanvas.height);

        // Save and rotate
        freezeCtx.save();
        freezeCtx.translate(freezeCanvas.width / 2, freezeCanvas.height / 2);
        ctx.scale(-1, 1);
        freezeCtx.rotate(Math.PI / 2);
        freezeCtx.drawImage(
          videoElement,
          -freezeCanvas.height / 2,
          -freezeCanvas.width / 2,
          freezeCanvas.height,
          freezeCanvas.width,
        );
        freezeCtx.restore();

        // NOW stop the webcam stream immediately (we have the freeze frame)
        if (webcamStream) {
          webcamStream.getTracks().forEach((track) => track.stop());
        }

        // Create image from the frozen canvas
        const freezeFrameImage = new Image();
        freezeFrameImage.src = freezeCanvas.toDataURL();

        // Trigger freeze mode in the drawFrame loop
        freezeFrameImage.onload = () => {
          let freezeStartTime = Date.now();
          const FREEZE_DURATION = 5000; // 5 seconds

          // Create new draw loop for freeze frame (happens in background)
          const drawFreezeFrame = () => {
            const freezeElapsed = Date.now() - freezeStartTime;

            if (freezeElapsed >= FREEZE_DURATION) {
              // Freeze duration complete, stop recording
              if (
                webcamRecorderRef.current &&
                webcamRecorderRef.current.state !== "inactive"
              ) {
                webcamRecorderRef.current.stop();
              }
              return;
            }

            // Draw the frozen frame (static image, not live webcam)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(freezeFrameImage, 0, 0, canvas.width, canvas.height);

            // Draw frame overlay on frozen image
            if (frame) {
              const frameWidth = canvas.width;
              const frameHeight = canvas.height;
              ctx.drawImage(frame, 0, 0, frameWidth, frameHeight);
            }

            requestAnimationFrame(drawFreezeFrame);
          };

          // Cancel the current animation frame and start freeze frame loop
          if (webcamRecorderRef.current.animationId) {
            cancelAnimationFrame(webcamRecorderRef.current.animationId);
          }
          drawFreezeFrame();
        };
      }
    }
  };

  const handleVideoLoad = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(true);

    const canvas = canvasRef.current;
    const displayCanvas = displayCanvasRef.current;

    if (!canvas || !displayCanvas) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    displayCanvas.width = video.videoWidth;
    displayCanvas.height = video.videoHeight;

    setVideoLoaded(true);

    // Auto-play and auto-record
    if (!hasAutoRecorded) {
      video.play();
      setIsPlaying(true);
      setTimeout(() => {
        startRecording();
      }, 100);
    }
  }, [hasAutoRecorded]);

  const startRecording = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displayCanvas = displayCanvasRef.current;

    if (!video || !canvas || !displayCanvas || !logo || !frame) {
      console.error("Missing required elements for recording");
      return;
    }

    const ctx = canvas.getContext("2d");
    const displayCtx = displayCanvas.getContext("2d");

    let startTime = null;

    const drawFrame = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const currentTime = video.currentTime;

      // Clear both canvases
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

      // Draw video frame to both canvases
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      displayCtx.drawImage(
        video,
        0,
        0,
        displayCanvas.width,
        displayCanvas.height,
      );

      // Draw logo to both canvases
      const logoWidth = 300;
      const logoHeight = (logo.height / logo.width) * logoWidth;
      const logoX = 50;
      const logoY = 50;

      ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      displayCtx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

      // Draw frame to both canvases
      const frameWidth = canvas.width;
      const frameHeight = canvas.height;
      ctx.drawImage(frame, 0, 0, frameWidth, frameHeight);
      displayCtx.drawImage(frame, 0, 0, frameWidth, frameHeight);

      // Draw custom div if within time range
      if (
        currentTime >= customDiv.startTime &&
        currentTime <= customDiv.endTime
      ) {
        // Draw to recording canvas
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(
          customDiv.x,
          customDiv.y,
          customDiv.width,
          customDiv.height,
        );

        ctx.fillStyle = "#000000";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          customDiv.text,
          customDiv.x + customDiv.width / 2,
          customDiv.y + customDiv.height / 2,
        );

        // Draw to display canvas
        displayCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
        displayCtx.fillRect(
          customDiv.x,
          customDiv.y,
          customDiv.width,
          customDiv.height,
        );

        displayCtx.fillStyle = "#000000";
        displayCtx.font = "bold 48px Arial";
        displayCtx.textAlign = "center";
        displayCtx.textBaseline = "middle";
        displayCtx.fillText(
          customDiv.text,
          customDiv.x + customDiv.width / 2,
          customDiv.y + customDiv.height / 2,
        );
      }

      if (!video.paused && !video.ended && isRecording) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      }
    };

    // Start the MediaRecorder
    const stream = canvas.captureStream(30);

    // Add audio from video
    if (video.captureStream) {
      const videoStream = video.captureStream();
      const audioTracks = videoStream.getAudioTracks();
      audioTracks.forEach((track) => stream.addTrack(track));
    }

    // Add background music
    if (musicAudio) {
      try {
        // Create audio context and connect music
        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        const musicSource = audioContext.createMediaElementSource(musicAudio);
        const destination = audioContext.createMediaStreamDestination();
        musicSource.connect(destination);
        musicSource.connect(audioContext.destination);

        // Unmute and play music
        musicAudio.muted = false;
        musicAudio.currentTime = 0;
        musicAudio
          .play()
          .catch((e) => console.error("Music playback error:", e));

        // Add music track to stream
        destination.stream
          .getAudioTracks()
          .forEach((track) => stream.addTrack(track));
      } catch (error) {
        console.error("Error setting up music:", error);
      }
    }

    const options = { mimeType: "video/webm;codecs=vp9" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = "video/webm;codecs=vp8";
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "video/webm";
      }
    }

    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);

      // Stop music
      if (musicAudio) {
        musicAudio.pause();
        musicAudio.currentTime = 0;
        musicAudio.muted = true;
      }
    };

    video.onended = () => {
      if (isRecording) {
        recorder.stop();
        setIsRecording(false);
        setIsPlaying(false);
        setHasAutoRecorded(true);
      }
    };

    recorder.start(100);
    setIsRecording(true);
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  }, [logo, frame, customDiv, isRecording, musicAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      const video = videoRef.current;
      if (video) {
        video.pause();
        setIsPlaying(false);
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setHasAutoRecorded(true);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Stop music
      if (musicAudio) {
        musicAudio.pause();
        musicAudio.currentTime = 0;
        musicAudio.muted = true;
      }
    }
  }, [isRecording, musicAudio]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const downloadVideo = useCallback(() => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  //   if (!recordedBlob) return;

  //   setIsProcessing(true);

  //   try {
  //     // Convert blob to base64
  //     const reader = new FileReader();
  //     reader.readAsDataURL(recordedBlob);

  //     reader.onloadend = async () => {
  //       const base64data = reader.result;
  //       const filename = `video-${Date.now()}.webm`;

  //       const response = await fetch("/api/upload-r2", {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({
  //           video: base64data,
  //           filename: filename,
  //         }),
  //       });

  //       const data = await response.json();

  //       if (data.url) {
  //         setCloudinaryUrl(data.url); // Reusing this state variable for R2 URL

  //         // Send to backend API
  //         try {
  //           const backendResponse = await fetch("/api/video", {
  //             method: "POST",
  //             headers: {
  //               "Content-Type": "application/json",
  //             },
  //             body: JSON.stringify({
  //               videoUrl: data.url,
  //             }),
  //           });

  //           const backendData = await backendResponse.json();
  //           console.log("Backend response:", backendData);
  //           const generatedVideoId = backendData.id;
  //           setVideoId(generatedVideoId);

  //           const shareUrl = `${window.location.origin}/share/${generatedVideoId}`;
  //           setShareUrl(shareUrl);

  //           setIsProcessing(false);
  //           setShowQRPopup(true);
  //         } catch (backendError) {
  //           console.error("Error sending to backend:", backendError);
  //           setIsProcessing(false);
  //           setShowQRPopup(true);
  //         }
  //       } else {
  //         throw new Error("Upload failed");
  //       }
  //     };

  //     reader.onerror = () => {
  //       throw new Error("Failed to read video file");
  //     };
  //   } catch (error) {
  //     console.error("Error uploading to R2:", error);
  //     alert("Failed to upload video. Please try again.");
  //     setIsProcessing(false);
  //   }
  // };

  // const uploadToR2ForQR = async (blob) => {
  //   try {
  //     // Convert blob to base64
  //     const reader = new FileReader();
  //     reader.readAsDataURL(blob);

  //     reader.onloadend = async () => {
  //       const base64data = reader.result;
  //       const filename = `video-${Date.now()}.webm`;

  //       const response = await fetch("/api/upload-r2", {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({
  //           video: base64data,
  //           filename: filename,
  //         }),
  //       });

  //       const data = await response.json();

  //       if (data.url) {
  //         setCloudinaryUrl(data.url);

  //         // Send to backend API
  //         try {
  //           const backendResponse = await fetch("/api/videos", {
  //             method: "POST",
  //             headers: {
  //               "Content-Type": "application/json",
  //             },
  //             body: JSON.stringify({
  //               videoUrl: data.url,
  //             }),
  //           });

  //           const backendData = await backendResponse.json();
  //           console.log("Backend response:", backendData);
  //           const generatedVideoId = backendData.videoId;
  //           setVideoId(generatedVideoId);

  //           const shareUrl = `${window.location.origin}/${generatedVideoId}`;
  //           setShareUrl(shareUrl);
  //           setIsQRLoading(false);
  //         } catch (backendError) {
  //           console.error("Error sending to backend:", backendError);
  //           setIsQRLoading(false);
  //           alert("Failed to save to database. Please try again.");
  //         }
  //       } else {
  //         throw new Error("Upload failed");
  //       }
  //     };

  //     reader.onerror = () => {
  //       setIsQRLoading(false);
  //       alert("Failed to process video. Please try again.");
  //     };
  //   } catch (error) {
  //     console.error("Error uploading to R2:", error);
  //     setIsQRLoading(false);
  //   }
  // };

  const uploadToR2 = async (blob) => {
    setIsProcessing(true);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        const base64data = reader.result;
        const filename = `video-${Date.now()}.webm`;

        // Upload to R2
        const response = await fetch("/api/upload-r2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video: base64data, filename }),
        });

        const data = await response.json();

        if (data.url) {
          setCloudinaryUrl(data.url); // Reuse this state for R2 URL

          // Save to MongoDB
          const backendResponse = await fetch("/api/videos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoUrl: data.url }),
          });

          const backendData = await backendResponse.json();
          const generatedVideoId = backendData.videoId;
          setVideoId(generatedVideoId);

          const shareUrl = `${window.location.origin}/${generatedVideoId}`;
          setShareUrl(shareUrl);

          setIsProcessing(false);
          setShowQRPopup(true);
        }
      };
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const uploadToR2ForQR = async (blob) => {
    try {
      const filename = `video-${Date.now()}.webm`;

      console.log(
        "📤 Starting upload, file size:",
        (blob.size / 1024 / 1024).toFixed(2),
        "MB",
      );

      // Create FormData
      const formData = new FormData();
      formData.append("video", blob, filename);

      console.log("📦 FormData created");

      // Upload to R2
      const response = await fetch("/api/upload-r2", {
        method: "POST",
        body: formData,
      });

      console.log("📡 Response status:", response.status);
      console.log("📡 Response ok:", response.ok);

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const text = await response.text();
        console.error("❌ Response not ok. Body:", text);
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Upload response:", data);

      if (data.url) {
        setCloudinaryUrl(data.url);

        // Save to MongoDB
        try {
          const backendResponse = await fetch("/api/videos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoUrl: data.url }),
          });

          const backendData = await backendResponse.json();
          console.log("Backend response:", backendData);
          const generatedVideoId = backendData.videoId;
          setVideoId(generatedVideoId);

          const shareUrl = `${window.location.origin}/${generatedVideoId}`;
          setShareUrl(shareUrl);
          setIsQRLoading(false);
        } catch (backendError) {
          console.error("Error sending to backend:", backendError);
          setIsQRLoading(false);
          alert("Failed to save to database. Please try again.");
        }
      } else {
        throw new Error("No URL in response");
      }
    } catch (error) {
      console.error("Error uploading to R2:", error);
      setIsQRLoading(false);
      alert("Upload failed: " + error.message);
    }
  };

  const uploadToCloudinary = async () => {
    if (!recordedBlob) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", recordedBlob);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (data.secure_url) {
        setCloudinaryUrl(data.secure_url);

        // Send to backend API
        try {
          const backendResponse = await fetch("/api/video", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              videoUrl: data.secure_url,
            }),
          });

          const backendData = await backendResponse.json();
          console.log("Backend response:", backendData);
          const generatedVideoId = backendData.id;
          setVideoId(generatedVideoId);

          const shareUrl = `${window.location.origin}/share/${generatedVideoId}`;
          setShareUrl(shareUrl);

          setIsProcessing(false);
          setShowQRPopup(true);
        } catch (backendError) {
          console.error("Error sending to backend:", backendError);
          setIsProcessing(false);
          setShowQRPopup(true);
        }
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      alert("Failed to upload video. Please try again.");
      setIsProcessing(false);
    }
  };

  const uploadToCloudinaryForQR = async (blob) => {
    try {
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (data.secure_url) {
        setCloudinaryUrl(data.secure_url);

        // Send to backend API
        try {
          const backendResponse = await fetch("/api/videos", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              videoUrl: data.secure_url,
            }),
          });

          const backendData = await backendResponse.json();
          console.log("Backend response:", backendData);
          const generatedVideoId = backendData.videoId;
          setVideoId(generatedVideoId);

          const shareUrl = `${window.location.origin}/${generatedVideoId}`;
          setShareUrl(shareUrl);
          setIsQRLoading(false);
        } catch (backendError) {
          console.error("Error sending to backend:", backendError);
          setIsQRLoading(false);
          alert("Failed to save to database. Please try again.");
        }
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      setIsQRLoading(false);
      // alert("Failed to generate QR code. Please try again.");
    }
  };

  const goBackToHome = () => {
    // Clean up previous recording
    if (videoUrl && videoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }

    // Reset all states
    setVideoUrl("");
    setRecordedBlob(null);
    setIsPlaying(false);
    setIsRecording(false);
    setVideoLoaded(false);
    setHasAutoRecorded(false);
    setCloudinaryUrl("");
    setVideoId(null);
    setShareUrl("");
    setShowQRPopup(false);

    // Reset webcam states
    setIsWebcamActive(false);
    setIsWebcamRecording(false);
    setCountdown(0);
    setRecordingProgress(0);
    setRecordingTimeElapsed(0);

    // Stop music if playing
    if (musicAudio) {
      musicAudio.pause();
      musicAudio.currentTime = 0;
      musicAudio.muted = true;
    }
  };

  return (
    <div className="h-svh w-full flex flex-col justify-center items-center bg-gradient-to-br from-[#442E8D] via-[#702A8C] to-[#442E8D] overflow-hidden relative">
      {/* Reset button --------------------------- */}
      <button
        className="w-12 h-12 flex items-center justify-center p-2 absolute z-[999] bottom-10 left-10 bg-red-500/40 text-white rounded-full"
        onClick={() => window.location.reload()}
      >
        <RefreshCcw />{" "}
      </button>
      {/* Reset button --------------------------- */}

      {!videoUrl && (
        <div className="bg-[#2C2151] absolute top-0 z-10 py-14 px-32 rounded-b-3xl shadow-2xl">
          <img src="/images/closeup-logo.png" className="w-[32rem] h-auto" />
        </div>
      )}
      <div className="absolute bottom-20 z-0 opacity-5">
        <img src="/images/closeup-logo.png" className="w-[52rem] h-auto" />
      </div>

      <img
        src="/images/pattern.png"
        className="absolute top-0 w-full h-auto opacity-20 z-0 float"
      />
      <img
        src="/images/pattern.png"
        className="absolute bottom-0 rotate-180 w-full h-auto opacity-10 z-0 float"
      />

      <div className="flex flex-col justify-center items-center w-full ">
        <div className="h-svh w-full flex flex-col justify-center items-center">
          <div
            className={`overflow-hidden ${
              videoUrl ? "" : "w-full"
            }   rounded-2xl`}
          >
            <div className="flex flex-col">
              <div className="flex-1 flex flex-col gap-6">
                {/* Webcam Preview */}
                {isWebcamUIVisible && !videoUrl && (
                  <div
                    className="w-full aspect-[9/16] mx-auto relative bg-black overflow-hidden"
                    onClick={() => {
                      if (countdown === 0) {
                        if (!isWebcamRecording) {
                          startRecordingWithCountdown();
                        } else {
                          stopWebcamRecording();
                        }
                      }
                    }}
                  >
                    {/* MODIFIED: Added rotation styles to video element */}
                    <video
                      ref={webcamVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-contain z-20"
                      style={{
                        transform: "rotate(90deg) scale(1.8) scaley(-1)",
                        transformOrigin: "center center",
                      }}
                    />

                    {/* Countdown Overlay */}
                    {countdown > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40 pointer-events-none">
                        <div className="text-white text-[20rem] font-bold animate-pulse">
                          {countdown}
                        </div>
                      </div>
                    )}

                    {/* Close Button */}
                    {/* {!isWebcamRecording && countdown === 0 && (
                      <button
                        onClick={() => window.location.reload()}
                        className="absolute top-6 right-6 bg-white/10 text-white/20 p-4 rounded-full transition shadow-2xl z-50 pointer-events-auto">
                        <X className="w-8 h-8" />
                      </button>
                    )} */}

                    {/* Recording Controls */}
                    {countdown === 0 && (
                      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 z-50 pointer-events-auto">
                        {/* Recording Button with Circular Progress */}
                        <div className="relative flex items-center justify-center pointer-events-auto">
                          {/* Circular Progress Ring */}
                          {isWebcamRecording && (
                            <svg className="absolute w-52 h-52 mb-10 -rotate-90 pointer-events-none">
                              <circle
                                cx="104"
                                cy="104"
                                r="100"
                                stroke="rgba(255, 255, 255, 0.3)"
                                strokeWidth="4"
                                fill="none"
                              />
                              <circle
                                cx="104"
                                cy="104"
                                r="100"
                                stroke="#ffffff"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 100}`}
                                strokeDashoffset={`${
                                  2 *
                                  Math.PI *
                                  100 *
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
                              onClick={(e) => {
                                e.stopPropagation();
                                startRecordingWithCountdown();
                              }}
                              className="w-44 h-44 rounded-full bg-white border-4 border-white transition-all flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 pointer-events-auto z-50 mb-10"
                            >
                              <div className="w-36 h-36 rounded-full bg-red-600"></div>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stopWebcamRecording();
                              }}
                              className="w-44 h-44 rounded-full bg-white border-4 border-white transition-all flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 pointer-events-auto z-50 cursor-pointer mb-10"
                            >
                              <div className="w-20 h-20 bg-red-600 rounded-lg"></div>
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
                  <div
                    className="w-full aspect-[9/16] mx-auto relative z-[900] flex flex-col justify-center items-center"
                    onClick={startWebcam}
                  >
                    {/* <LetsStartAnimation /> */}
                    <div className="flex flex-col gap-56 -translate-y-16">
                      {/* <button
                      // onClick={startWebcam}
                      className=" relative z-50 bg-white text-black cursor-pointer py-16 px-24 rounded-2xl text-7xl uppercase font-bold transition flex items-center justify-center gap-12 shadow-2xl">
                      <Camera className="w-20 h-20" />
                      Start
                    </button> */}
                    </div>

                    <img
                      src="/images/union.svg"
                      className="absolute inset-0 w-[28rem] h-auto z-0  top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 slow-spin"
                    />

                    <h1 className="text-8xl text-white font-bold absolute font-righteous ">
                      START
                    </h1>
                  </div>
                )}

                {/* Post process UI */}
                {showLogo && (
                  <div className="fixed inset-0 flex flex-col justify-center items-center ">
                    <TikTokLoader />
                  </div>
                )}

                {/* Hidden video element for processed video */}
                {/* Video preview after recording */}
                <AnimatePresence mode="wait">
                  {videoUrl && (
                    <motion.div
                      className="relative w-fit h-full border-[12px] border-[#2C2151] overflow-hidden"
                      key="video-preview"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4 }}
                    >
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        onLoadedMetadata={handleVideoLoad}
                        className="w-full h-full object-contain"
                        playsInline
                        autoPlay
                        loop
                      />

                      {/* Center Play/Pause Button */}
                      {/* <button
                      onClick={handlePlayPause}
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-6 rounded-full transition backdrop-blur-sm">
                      {isPlaying ? (
                        <Pause className="w-12 h-12" />
                      ) : (
                        <Play className="w-12 h-12" />
                      )}
                    </button> */}
                    </motion.div>
                  )}
                </AnimatePresence>

                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Video Controls */}
              {/* {videoUrl && (
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
                  )}
                </div>
              )} */}
            </div>
          </div>

          {/* QR Code Section - Show under preview */}
          <AnimatePresence>
            {videoUrl && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col items-center gap-6 h-[560px]"
              >
                <div className="mt-12 p-6 h-[370px] bg-white rounded-lg border-2 border-gray-200 w-sm flex flex-col justify-center items-center relative z-30">
                  {isQRLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#2C2151] mb-4"></div>
                      <p className="text-gray-600 text-lg">
                        Generating QR Code...
                      </p>
                    </div>
                  ) : cloudinaryUrl ? (
                    <div className="flex flex-col items-center w-full p-8">
                      <p className="text-2xl font-medium text-gray-800 mb-4">
                        Scan to Share
                      </p>
                      <QRCodeSVG
                        value={shareUrl || cloudinaryUrl}
                        size={200}
                        className="h-auto w-full"
                      />
                    </div>
                  ) : null}
                </div>
                <AnimatePresence>
                  {cloudinaryUrl && (
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                      className="text-[#702A8C] text-4xl active:scale-95 min-w-52 bg-white py-8 px-16 rounded-full z-20 transition font-righteous uppercase"
                      onClick={() => window.location.reload()}
                    >
                      Record a New Video
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {cloudinaryUrl && (
            <div
              className="h-svh w-full absolute inset-0 z-40 cursor-pointer"
              onClick={() => {
                if (cloudinaryUrl) {
                  window.location.reload();
                }
              }}
            ></div>
          )}

          {/* QR pop up */}
          <AnimatePresence>
            {showQRPopup && cloudinaryUrl !== "" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute bg-black/10 backdrop-blur-lg w-full inset-0 z-50 flex items-center justify-center"
                onClick={() => setShowQRPopup(false)}
              >
                <motion.div
                  initial={{ scale: 0.8, y: 50 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.8, y: 50 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex min-h-[60rem] mx-12 justify-center items-center w-3xl relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className=" rounded-2xl h-full w-full absolute -translate-x-6 translate-y-6"></div>
                  <div className="bg-white border-2 border-gray-200 rounded-2xl h-full w-full absolute z-10 flex flex-col items-center p-10">
                    <div className="flex flex-col border-amber-700 justify-center items-center w-full text-center">
                      <p className="text-4xl w-full font-medium text-[#FA2D6C] py-12">
                        Scan to Share
                      </p>
                      <QRCodeSVG
                        value={shareUrl || cloudinaryUrl}
                        size={500}
                        className="h-auto"
                      />

                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.5 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-white text-4xl mt-20 active:scale-95 min-w-52 bg-black py-8 px-16 rounded-full z-50 transition"
                        onClick={goBackToHome}
                      >
                        Record a New Video
                      </motion.button>
                    </div>
                  </div>
                  <div className="bg-[#FA2D6C] rounded-2xl h-full w-full absolute translate-x-6 -translate-y-6"></div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {isProcessing && (
            <div className="fixed inset-0 bg-gradient-to-br from-[#AFE3F9] via-white to-[#AFE3F9]  flex items-center justify-center z-50">
              <div className="text-center flex flex-col gap-12">
                <TikTokLoader />
                <p className="text-white/40 text-3xl">Getting Ready...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoTextOverlayApp;
