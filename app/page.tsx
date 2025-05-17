"use client";

import React, { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import { handlePose, POSES } from "@/utils/pose";
import { drawSkeleton } from "@/utils/drawSkeleton";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  const [selectedPose, setSelectedPose] = useState("auto");
  const selectedPoseRef = useRef(selectedPose);
  const [count, setCount] = useState(0);
  const [plankTime, setPlankTime] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const isHoldingRef = useRef(isHolding);
  const [summary, setSummary] = useState("");

  const holdStart = useRef<number | null>(null);
  const lastCountTime = useRef<number>(0);
  const releaseTimeout = useRef<NodeJS.Timeout | null>(null);

  const COUNT_DELAY = 1500;

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
          enableSmoothing: true,
        }
      );
      detectorRef.current = detector;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
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
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!video || !canvas || !ctx || !detectorRef.current) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const loop = async () => {
        const poses = await detectorRef.current!.estimatePoses(video);
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        poses.forEach((pose) => {
          drawSkeleton(ctx, pose.keypoints);
          handlePose({
            keypoints: pose.keypoints,
            selectedPose,
            selectedPoseRef,
            isHolding,
            isHoldingRef,
            holdStart,
            lastCountTime,
            releaseTimeout,
            COUNT_DELAY,
            plankTime,
            setCount,
            setSummary,
            setIsHolding,
            setPlankTime,
          });
        });

        ctx.restore();
        requestAnimationFrame(loop);
      };
      loop();
    };

    init();
  }, []);

  useEffect(() => {
    selectedPoseRef.current = selectedPose;
  }, [selectedPose]);

  return (
    <div className="w-screen min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center justify-start gap-2">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center">
        🧠 AI Pose Tracker
      </h1>
      <div className="mb-4 flex justify-center">
        <select
          className="px-4 py-2 rounded-lg"
          style={{
            backgroundColor: "lightblue",
            color: "black",
          }}
          value={selectedPose}
          onChange={(e) => {
            const pose = e.target.value;
            setSelectedPose(pose);
            setCount(0);
            setPlankTime(0);
            setSummary("");
          }}
        >
          <option value="" disabled>
            เลือกท่า
          </option>
          {POSES.map((pose) => (
            <option key={pose} value={pose}>
              {pose}
            </option>
          ))}
        </select>
      </div>

      <div className="relative w-full max-w-5xl aspect-video flex items-center justify-center px-4 rounded-lg bg-gray-800">
        <video
          ref={videoRef}
          className="hidden absolute object-contain"
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute object-contain"
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>

      <div className="mt-4 text-lg text-center">
        {selectedPose === "Plank" || selectedPose === "Side Plank" ? (
          <div>
            ⏱ เวลาที่ทำได้: {Math.floor(plankTime / 60)}:
            {("0" + (plankTime % 60)).slice(-2)} นาที
          </div>
        ) : (
          <div>🧮 จำนวนครั้ง: {count}</div>
        )}
      </div>

      {summary && (
        <div className="mt-2 bg-green-100 text-black px-4 py-2 rounded shadow text-center max-w-md w-full">
          ✅ สรุปผล: {summary}
        </div>
      )}
    </div>
  );
}
