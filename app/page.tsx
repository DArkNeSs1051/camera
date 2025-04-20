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

  // Add refs to track previous positions for stability check
  const prevRightElbow = useRef<Point | null>(null);
  const prevRightShoulder = useRef<Point | null>(null);

  // Helper to check if movement is stable (not jittery)
  const isStable = (prev: Point | null, curr: Point, threshold = 10) => {
    if (!prev) return false;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  };

  // Helper to draw a line between two points
  const drawLine = (p1: Point, p2: Point, color = "#00FFFF", width = 2) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
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

    // Draw all relevant lines for push-up detection
    if (
      isValidLandmarks(
        rightShoulder,
        rightElbow,
        rightWrist,
        rightHip,
        rightKnee,
        rightAnkle
      ) &&
      isConfident(rightShoulder) &&
      isConfident(rightElbow) &&
      isConfident(rightWrist) &&
      isConfident(rightHip) &&
      isConfident(rightKnee) &&
      isConfident(rightAnkle)
    ) {
      // Draw arm (shoulder-elbow-wrist)
      drawLine(rightShoulder, rightElbow, "#FFEB3B", 3); // yellow
      drawLine(rightElbow, rightWrist, "#FFEB3B", 3);

      // Draw body (shoulder-hip-knee-ankle)
      drawLine(rightShoulder, rightHip, "#00E676", 3); // green
      drawLine(rightHip, rightKnee, "#00E676", 3);
      drawLine(rightKnee, rightAnkle, "#00E676", 3);

      // Draw angle at elbow
      const angle = getAngle(rightShoulder, rightElbow, rightWrist);
      drawAngleLine(rightShoulder, rightElbow, rightWrist, angle);

      const bodyAngle = getAngle(rightShoulder, rightHip, rightKnee);
      const shoulderElbowYDiff = rightElbow.y - rightShoulder.y;
      const elbowWristYDiff = rightWrist.y - rightElbow.y;
      const isShoulderLowered = shoulderElbowYDiff > 0.05;
      const isWristBelowElbow = elbowWristYDiff > 0.05;
      const isBodyStraight = bodyAngle > 160;

      drawAngleLine(rightShoulder, rightElbow, rightWrist, angle);

      // Check for push-up down position
      if (
        angle < 65 &&
        isStable(prevRightElbow.current, rightElbow) &&
        isShoulderLowered &&
        isWristBelowElbow
      ) {
        pushUpHoldFrames.current++;
        if (pushUpHoldFrames.current >= 3 && !isDownPushUp.current) {
          isDownPushUp.current = true;
        }
      } else {
        pushUpHoldFrames.current = 0;
      }

      // Check for push-up up position
      if (
        angle > 165 &&
        isDownPushUp.current &&
        isBodyStraight &&
        canCountNow() &&
        Date.now() - lastCountTime > 500
      ) {
        count.current++;
        isDownPushUp.current = false;
        lastCountTime = Date.now();
        lastDetectedPose.current = "Push-up";
      }

      prevRightElbow.current = { x: rightElbow.x, y: rightElbow.y };
      prevRightShoulder.current = { x: rightShoulder.x, y: rightShoulder.y };
    } else {
      pushUpHoldFrames.current = 0;
      prevRightElbow.current = null;
      prevRightShoulder.current = null;
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
          modelType: posedetection.movenet.modelType.SINGLEPOSE_THUNDER,
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
