"use client";

import React, { useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // 🔧 Force WebGL backend พร้อม debug config
        tf.env().set("WEBGL_CPU_FORWARD", false);
        tf.env().set("WEBGL_PACK", true);
        tf.env().set("WEBGL_VERSION", 1); // ลองใช้ WebGL1 แทน WebGL2

        await tf.setBackend("webgl");
        await tf.ready();

        const backend = tf.getBackend();
        console.log("✅ TF backend in use:", backend);

        // 🔍 เช็คว่า backend ใช้ webgl จริงไหม
        if (backend !== "webgl") {
          throw new Error("WebGL backend not active, fallback in progress");
        }

        // ✅ สร้าง detector
        const detector = await posedetection.createDetector(
          posedetection.SupportedModels.MoveNet,
          {
            modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          }
        );
        detectorRef.current = detector;

        // ✅ เปิดกล้อง
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
      } catch (err) {
        console.warn(
          "❌ WebGL failed or not supported, switching to CPU...",
          err
        );
        await tf.setBackend("cpu");
        await tf.ready();
        console.log("🧠 TF fallback to:", tf.getBackend());

        alert(
          "⚠️ อุปกรณ์นี้ไม่รองรับ WebGL สำหรับ TensorFlow.js\nระบบจะเปลี่ยนไปใช้ CPU ซึ่งอาจช้าลง"
        );
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
        console.log("🎯 poses", poses);

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        poses.forEach((pose) => {
          pose.keypoints.forEach((keypoint) => {
            if (keypoint.score && keypoint.score > 0.2) {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
              ctx.fillStyle = "#00FF00";
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
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: "scaleX(-1)",
        }}
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full z-10 pointer-events-none"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
