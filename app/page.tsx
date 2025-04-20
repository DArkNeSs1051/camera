"use client";

import React, { useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

interface Point {
  x: number;
  y: number;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  const count = useRef(0);
  const isDownPushUp = useRef(false);
  const isDownSquat = useRef(false);
  const lastDetectedPose = useRef<string | null>(null);
  let lastCountTime = 0;
  const COUNT_DELAY = 800;

  const canCountNow = () => Date.now() - lastCountTime > COUNT_DELAY;

  const isValidLandmarks = (...points: (Point | undefined)[]) =>
    points.every(
      (p) => p && typeof p.x === "number" && typeof p.y === "number"
    );

  const getAngle = (p1: Point, p2: Point, p3: Point): number => {
    const radians =
      Math.atan2(p3.y - p2.y, p3.x - p2.x) -
      Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs(radians * (180 / Math.PI));
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  const drawAngleLine = (p1: Point, p2: Point, p3: Point, angle: number) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#00FFFF";
    ctx.lineWidth = 2;

    // วาดเส้น
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();

    // แสดงมุม
    ctx.fillStyle = "yellow";
    ctx.font = "16px Arial";
    ctx.fillText(`${Math.round(angle)}°`, p2.x + 10, p2.y + 10);
  };

  // Add refs to track how long the pose is held
  const pushUpHoldFrames = useRef(0);
  const squatHoldFrames = useRef(0);

  // Add refs to track previous positions for stability check
  const prevRightElbow = useRef<Point | null>(null);
  const prevRightKnee = useRef<Point | null>(null);

  // Helper to check if movement is stable (not jittery)
  const isStable = (prev: Point | null, curr: Point, threshold = 10) => {
    if (!prev) return false;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  };

  const detectExercise = (lm: any[]) => {
    if (!lm || lm.length < 17) return;

    // Helper to check keypoint confidence
    const isConfident = (kp: any) => kp && kp.score > 0.6;

    const rightShoulder = lm[6];
    const rightElbow = lm[8];
    const rightWrist = lm[10];

    const rightHip = lm[12];
    const rightKnee = lm[14];
    const rightAnkle = lm[16];

    // Push-up (use right side for mirrored front camera)
    if (
      isValidLandmarks(rightShoulder, rightElbow, rightWrist) &&
      isConfident(rightShoulder) &&
      isConfident(rightElbow) &&
      isConfident(rightWrist)
    ) {
      const angle = getAngle(rightShoulder, rightElbow, rightWrist);
      drawAngleLine(rightShoulder, rightElbow, rightWrist, angle);

      // Only increment hold frames if elbow is stable
      if (angle < 65 && isStable(prevRightElbow.current, rightElbow)) {
        pushUpHoldFrames.current++;
        if (pushUpHoldFrames.current >= 3 && !isDownPushUp.current) {
          isDownPushUp.current = true;
        }
      } else {
        pushUpHoldFrames.current = 0;
      }

      if (angle > 165 && isDownPushUp.current && canCountNow()) {
        count.current++;
        isDownPushUp.current = false;
        lastCountTime = Date.now();
        lastDetectedPose.current = "Push-up";
      }

      // Update previous elbow position
      prevRightElbow.current = { x: rightElbow.x, y: rightElbow.y };
    } else {
      pushUpHoldFrames.current = 0;
      prevRightElbow.current = null;
    }

    // Squat (use right side for mirrored front camera)
    if (
      isValidLandmarks(rightHip, rightKnee, rightAnkle) &&
      isConfident(rightHip) &&
      isConfident(rightKnee) &&
      isConfident(rightAnkle)
    ) {
      const angle = getAngle(rightHip, rightKnee, rightAnkle);
      drawAngleLine(rightHip, rightKnee, rightAnkle, angle);

      // Only increment hold frames if knee is stable
      if (angle < 85 && isStable(prevRightKnee.current, rightKnee)) {
        squatHoldFrames.current++;
        if (squatHoldFrames.current >= 3 && !isDownSquat.current) {
          isDownSquat.current = true;
        }
      } else {
        squatHoldFrames.current = 0;
      }

      if (angle > 165 && isDownSquat.current && canCountNow()) {
        count.current++;
        isDownSquat.current = false;
        lastCountTime = Date.now();
        lastDetectedPose.current = "Squat";
      }

      // Update previous knee position
      prevRightKnee.current = { x: rightKnee.x, y: rightKnee.y };
    } else {
      squatHoldFrames.current = 0;
      prevRightKnee.current = null;
    }

    const nameEl = document.getElementById("exerciseName");
    const countEl = document.getElementById("repCounter");
    if (nameEl) nameEl.innerText = lastDetectedPose.current ?? "-";
    if (countEl) countEl.innerText = `${count.current}`;
  };

  useEffect(() => {
    const init = async () => {
      tf.env().set("WEBGL_CPU_FORWARD", false);
      tf.env().set("WEBGL_PACK", true);
      tf.env().set("WEBGL_VERSION", 1);
      await tf.setBackend("webgl");
      await tf.ready();

      const detector = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        }
      );
      detectorRef.current = detector;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          detectPose();
        };
      }
    };

    const detectPose = async () => {
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d");
      if (!ctx || !detectorRef.current) return;

      const render = async () => {
        if (!video || !canvas || !ctx || !detectorRef.current) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const poses = await detectorRef.current!.estimatePoses(video);
        ctx.save();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        poses.forEach((pose) => {
          pose.keypoints.forEach((keypoint) => {
            if (keypoint.score && keypoint.score > 0.4) {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
              ctx.fillStyle = "#00FF00";
              ctx.fill();
            }
          });
          detectExercise(pose.keypoints);
        });

        ctx.restore();
        requestAnimationFrame(render);
      };

      render();
    };

    init();
  }, []);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-black relative">
      <div className="relative w-full h-full aspect-video">
        <video
          ref={videoRef}
          className="absolute w-full h-full object-contain"
          style={{
            transform: "scaleX(-1)",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute w-full h-full object-contain"
          style={{
            pointerEvents: "none",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>

      <div className="absolute top-5 left-5 z-20 bg-black/50 text-white rounded p-4 space-y-2">
        <div className="text-xl">
          ท่าปัจจุบัน:{" "}
          <span id="exerciseName" className="font-bold">
            -
          </span>
        </div>
        <div className="text-xl">
          จำนวนครั้ง:{" "}
          <span id="repCounter" className="font-bold">
            0
          </span>
        </div>
      </div>
    </div>
  );
}
