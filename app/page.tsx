// โค้ดนี้รวมฟังก์ชันตรวจจับ Push-up, Squat, Bench Press, Leg Lunge เพิ่มจากเวอร์ชันเดิมแล้ว

"use client";

import React, { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

interface Point {
  x: number;
  y: number;
  score?: number;
}

const SKELETON_CONNECTIONS: [number, number][] = [
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [5, 6],
  [5, 11],
  [6, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
];

const POSES = [
  "auto",
  "Push-up",
  "Bench Press",
  "Squat",
  "Leg Lunge",
  "Plank",
  "Side Plank",
];

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  const [selectedPose, setSelectedPose] = useState("auto");
  const [count, setCount] = useState(0);
  const [plankTime, setPlankTime] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [summary, setSummary] = useState("");

  const holdStart = useRef<number | null>(null);
  const lastCountTime = useRef<number>(0);

  const COUNT_DELAY = 800;

  useEffect(() => {
    const init = async () => {
      await tf.setBackend("webgl");
      await tf.ready();

      const detector = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        { modelType: "singlepose-thunder", enableSmoothing: true }
      );

      detectorRef.current = detector;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }

      detectPose();
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        poses.forEach((pose) => {
          drawSkeleton(ctx, pose.keypoints);
          handlePose(pose.keypoints);
        });

        requestAnimationFrame(loop);
      };
      loop();
    };

    init();
  }, [selectedPose]);

  const drawSkeleton = (ctx: CanvasRenderingContext2D, keypoints: Point[]) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#00FFFF";
    ctx.fillStyle = "#00FF00";

    SKELETON_CONNECTIONS.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (kp1?.score && kp2?.score && kp1.score > 0.5 && kp2.score > 0.5) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    keypoints.forEach((kp) => {
      if (kp?.score && kp.score > 0.5) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  const handlePose = (keypoints: Point[]) => {
    const now = Date.now();
    const valid = keypoints.every((k) => k?.score && k.score > 0.5);
    if (!valid) return;

    const get = (i: number) => keypoints[i];

    const angle = (a: number, b: number, c: number) =>
      getAngle(get(a), get(b), get(c));

    const detect = (upCond: boolean, downCond: boolean, poseName: string) => {
      if (downCond) {
        if (!isHolding) {
          holdStart.current = now;
          setIsHolding(true);
        }
      } else if (
        upCond &&
        isHolding &&
        now - lastCountTime.current > COUNT_DELAY
      ) {
        setCount((prev) => prev + 1);
        lastCountTime.current = now;
        setSummary(`คุณทำ ${poseName} ไปแล้ว ${count + 1} ครั้ง`);
        setIsHolding(false);
        holdStart.current = null;
      } else if (!downCond) {
        setIsHolding(false);
      }
    };

    switch (selectedPose) {
      case "Push-up": {
        const angleElbow = angle(5, 7, 9);
        const angleBody = angle(5, 11, 13);
        detect(
          angleElbow > 160,
          angleElbow > 60 && angleElbow < 120 && angleBody > 160,
          "Push-up"
        );
        break;
      }
      case "Bench Press": {
        const angleElbow = angle(5, 7, 9);
        detect(
          angleElbow > 160,
          angleElbow > 60 && angleElbow < 120,
          "Bench Press"
        );
        break;
      }
      case "Squat": {
        const angleKnee = angle(11, 13, 15);
        detect(angleKnee > 160, angleKnee > 60 && angleKnee < 120, "Squat");
        break;
      }
      case "Leg Lunge": {
        const angleKneeLeft = angle(11, 13, 15);
        const angleKneeRight = angle(12, 14, 16);
        detect(
          angleKneeLeft > 160 && angleKneeRight > 160,
          angleKneeLeft > 60 &&
            angleKneeLeft < 120 &&
            angleKneeRight > 60 &&
            angleKneeRight < 120,
          "Leg Lunge"
        );
        break;
      }
      case "Plank":
      case "Side Plank": {
        const leftAngle = getAngle(get(5), get(11), get(15));
        const rightAngle = getAngle(get(6), get(12), get(16));
        const isHoldingPose =
          leftAngle > 160 &&
          leftAngle < 200 &&
          rightAngle > 160 &&
          rightAngle < 200;

        if (isHoldingPose) {
          if (!isHolding) {
            holdStart.current = now;
            setIsHolding(true);
          } else {
            setPlankTime(Math.floor((now - (holdStart.current || now)) / 1000));
          }
        } else if (isHolding) {
          setSummary(
            `คุณทำ ${selectedPose} ได้ ${Math.floor(plankTime / 60)} นาที ${
              plankTime % 60
            } วินาที`
          );
          setPlankTime(0);
          setIsHolding(false);
          holdStart.current = null;
        }
        break;
      }
      default:
        break;
    }
  };

  const getAngle = (a: Point, b: Point, c: Point) => {
    const ab = Math.atan2(c.y - b.y, c.x - b.x);
    const cb = Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(((ab - cb) * 180.0) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">🧠 AI Pose Tracker</h1>
      <div className="flex gap-2 mb-4">
        {POSES.map((pose) => (
          <button
            key={pose}
            className={`px-3 py-1 rounded ${
              selectedPose === pose
                ? "bg-blue-500 text-white"
                : "bg-gray-700 text-gray-300"
            }`}
            onClick={() => {
              setSelectedPose(pose);
              setCount(0);
              setPlankTime(0);
              setSummary("");
            }}
          >
            {pose}
          </button>
        ))}
      </div>
      <div className="relative w-full max-w-4xl aspect-video">
        <video ref={videoRef} className="hidden" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="rounded-lg shadow-lg" />
      </div>
      <div className="mt-4 text-lg">
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
        <div className="mt-2 bg-green-100 text-black px-4 py-2 rounded shadow">
          ✅ สรุปผล: {summary}
        </div>
      )}
    </div>
  );
}
