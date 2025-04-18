"use client";

import React, { useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  const count = useRef(0);
  const isDown = useRef(false);
  const lastDetectedPose = useRef<string | null>(null);
  let lastCountTime = 0;
  const COUNT_DELAY = 800; // ms

  interface Point {
    x: number;
    y: number;
  }

  const canCountNow = () => {
    return Date.now() - lastCountTime > COUNT_DELAY;
  };

  const isValidLandmarks = (...points: (Point | undefined)[]): boolean => {
    return points.every(
      (p) => p && typeof p.x === "number" && typeof p.y === "number"
    );
  };

  const getAngle = (p1: Point, p2: Point, p3: Point): number => {
    const radians =
      Math.atan2(p3.y - p2.y, p3.x - p2.x) -
      Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs(radians * (180 / Math.PI));
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  const detectExercise = (lm: any[]) => {
    if (!lm || lm.length < 33) return;

    const leftShoulder = lm[11];
    const leftElbow = lm[13];
    const leftWrist = lm[15];

    const leftHip = lm[23];
    const leftKnee = lm[25];
    const leftAnkle = lm[27];

    // Push-up Detection
    if (isValidLandmarks(leftShoulder, leftElbow, leftWrist)) {
      const pushupAngle = getAngle(leftShoulder, leftElbow, leftWrist);
      if (pushupAngle < 70 && !isDown.current) {
        isDown.current = true;
      }
      if (pushupAngle > 160 && isDown.current && canCountNow()) {
        count.current++;
        isDown.current = false;
        lastCountTime = Date.now();
        lastDetectedPose.current = "Push-up";
      }
    }

    // Squat Detection
    if (isValidLandmarks(leftHip, leftKnee, leftAnkle)) {
      const squatAngle = getAngle(leftHip, leftKnee, leftAnkle);
      if (squatAngle < 90 && !isDown.current) {
        isDown.current = true;
      }
      if (squatAngle > 160 && isDown.current && canCountNow()) {
        count.current++;
        isDown.current = false;
        lastCountTime = Date.now();
        lastDetectedPose.current = "Squat";
      }
    }

    // อัปเดต UI
    const nameEl = document.getElementById("exerciseName");
    const countEl = document.getElementById("repCounter");
    if (nameEl) nameEl.innerText = lastDetectedPose.current ?? "-";
    if (countEl) countEl.innerText = `${count.current}`;
  };

  useEffect(() => {
    const init = async () => {
      // 🔧 Force WebGL backend พร้อม debug config
      tf.env().set("WEBGL_CPU_FORWARD", false);
      tf.env().set("WEBGL_PACK", true);
      tf.env().set("WEBGL_VERSION", 1); // ลองใช้ WebGL1 แทน WebGL2

      await tf.setBackend("webgl");
      await tf.ready();

      const backend = tf.getBackend();

      // 🔍 เช็คว่า backend ใช้ webgl จริงไหม
      if (backend !== "webgl") {
        throw new Error("WebGL backend not active, fallback in progress");
      }

      const detector = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        }
      );
      detectorRef.current = detector;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          detectPose();
        };
      }
    };

    const detectPose = async () => {
      if (!videoRef.current || !canvasRef.current || !detectorRef.current)
        return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const render = async () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const poses = await detectorRef.current!.estimatePoses(video);

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        poses.forEach((pose) => {
          const lm = pose.keypoints;
          detectExercise(lm);

          lm.forEach((keypoint) => {
            if (keypoint.score != null && keypoint.score > 0.3) {
              const adjustedX = canvas.width - keypoint.x; // แปลงพิกัด X ให้ตรงกับวิดีโอที่ถูกพลิก
              const adjustedY = keypoint.y; // Y ไม่ต้องแปลง เพราะไม่ได้มีการพลิกแนวตั้ง

              ctx.beginPath();
              ctx.arc(adjustedX, adjustedY, 5, 0, 2 * Math.PI);
              ctx.fillStyle = "lime";
              ctx.fill();
            }
          });
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
      <video
        ref={videoRef}
        className="absolute w-full h-full z-0"
        style={{ objectFit: "cover", transform: "scaleX(-1)" }}
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full z-10 pointer-events-none"
        style={{ objectFit: "cover" }}
      />
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
