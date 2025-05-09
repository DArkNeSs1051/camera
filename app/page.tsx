// โ็ดนี้รวมฟังก์ชันตรวจจับ Push-up, Squat, Bench Press, Leg Lunge เพิ่มจากเวอร์ชันเดิมแล้ว

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
  const selectedPoseRef = useRef(selectedPose);
  const [count, setCount] = useState(0);
  const [plankTime, setPlankTime] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const isHoldingRef = useRef(isHolding); // เพิ่มบรรทัดนี้
  const [summary, setSummary] = useState("");

  const holdStart = useRef<number | null>(null);
  const lastCountTime = useRef<number>(0);
  const releaseTimeout = useRef<NodeJS.Timeout | null>(null);

  const COUNT_DELAY = 1500; // เพิ่ม delay ให้มากขึ้น

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
          handlePose(pose.keypoints);
        });

        ctx.restore();
        requestAnimationFrame(loop);
      };
      loop();
    };

    init();
  }, []); // ✅ เรียก detectPose ครั้งเดียว

  const drawSkeleton = (ctx: CanvasRenderingContext2D, keypoints: Point[]) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#00FFFF";
    ctx.fillStyle = "#00FF00";

    SKELETON_CONNECTIONS.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (kp1?.score && kp2?.score && kp1.score > 0.3 && kp2.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    keypoints.forEach((kp) => {
      if (kp?.score && kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  const handlePose = (keypoints: Point[]) => {
    const now = Date.now();
    // const valid = keypoints.every((k) => k?.score && k.score > 0.3);
    // if (!valid) return;

    const get = (i: number) => keypoints[i];

    const angle = (a: number, b: number, c: number) =>
      getAngle(get(a), get(b), get(c));

    const detectBothSides = (
      upCondLeft: boolean,
      downCondLeft: boolean,
      upCondRight: boolean,
      downCondRight: boolean,
      poseName: string
    ) => {
      if (downCondLeft || downCondRight) {
        if (!isHoldingRef.current) {
          holdStart.current = Date.now();
          setIsHolding(true);
          isHoldingRef.current = true; // เพิ่มบรรทัดนี้
        }
        // ถ้ากลับมาทำท่า ให้ยกเลิก releaseTimeout
        if (releaseTimeout.current) {
          clearTimeout(releaseTimeout.current);
          releaseTimeout.current = null;
        }
      } else if (
        (upCondLeft || upCondRight) &&
        isHoldingRef.current &&
        Date.now() - lastCountTime.current > COUNT_DELAY
      ) {
        setCount((prev) => {
          const newCount = prev + 1;
          setSummary(`คุณทำ ${poseName} ไปแล้ว ${newCount} ครั้ง`);
          return newCount;
        });
        lastCountTime.current = Date.now();
        setIsHolding(false);
        isHoldingRef.current = false; // เพิ่มบรรทัดนี้
        holdStart.current = null;
      } else if (
        !downCondLeft &&
        !downCondRight &&
        isHoldingRef.current &&
        !releaseTimeout.current
      ) {
        // ถ้าหลุดจากท่า ให้รอ 400ms ก่อนรีเซ็ต isHolding
        releaseTimeout.current = setTimeout(() => {
          setIsHolding(false);
          isHoldingRef.current = false; // เพิ่มบรรทัดนี้
          releaseTimeout.current = null;
        }, 400);
      }
    };

    const poseName = selectedPoseRef.current;

    switch (poseName) {
      case "Push-up": {
        // ซ้าย
        const angleElbowLeft = angle(5, 7, 9);
        const angleBodyLeft = angle(5, 11, 13);
        // ขวา
        const angleElbowRight = angle(6, 8, 10);
        const angleBodyRight = angle(6, 12, 14);
        detectBothSides(
          angleElbowLeft > 160,
          angleElbowLeft > 60 && angleElbowLeft < 120 && angleBodyLeft > 160,
          angleElbowRight > 160,
          angleElbowRight > 60 && angleElbowRight < 120 && angleBodyRight > 160,
          "Push-up"
        );
        break;
      }
      case "Bench Press": {
        const angleElbowLeft = angle(5, 7, 9); // Shoulder - Elbow - Wrist (ซ้าย)
        const angleElbowRight = angle(6, 8, 10); // Shoulder - Elbow - Wrist (ขวา)

        const angleShoulderLeft = angle(11, 5, 7); // Hip - Shoulder - Elbow (ซ้าย)
        const angleShoulderRight = angle(12, 6, 8); // Hip - Shoulder - Elbow (ขวา)

        const elbowShoulderDiffLeft = Math.abs(
          angleElbowLeft - angleShoulderLeft
        );
        const elbowShoulderDiffRight = Math.abs(
          angleElbowRight - angleShoulderRight
        );

        const isLeftValid = elbowShoulderDiffLeft > 15;
        const isRightValid = elbowShoulderDiffRight > 15;

        detectBothSides(
          // ข้างซ้าย: เหยียด และ มุมไม่ทับกัน
          angleElbowLeft > 160 && isLeftValid,
          angleElbowLeft < 90 && isLeftValid,

          // ข้างขวา: เหยียด และ มุมไม่ทับกัน
          angleElbowRight > 160 && isRightValid,
          angleElbowRight < 90 && isRightValid,

          "Bench Press"
        );
        break;
      }
      case "Squat": {
        const angleKneeLeft = angle(11, 13, 15);
        const angleKneeRight = angle(12, 14, 16);
        detectBothSides(
          angleKneeLeft > 160,
          angleKneeLeft > 60 && angleKneeLeft < 120,
          angleKneeRight > 160,
          angleKneeRight > 60 && angleKneeRight < 120,
          "Squat"
        );
        break;
      }
      case "Leg Lunge": {
        const angleKneeLeft = angle(11, 13, 15);
        const angleKneeRight = angle(12, 14, 16);
        detectBothSides(
          angleKneeLeft > 160,
          angleKneeLeft > 60 && angleKneeLeft < 120,
          angleKneeRight > 160,
          angleKneeRight > 60 && angleKneeRight < 120,
          "Leg Lunge"
        );
        break;
      }
      case "Plank":
      case "Side Plank": {
        const leftAngle = getAngle(get(5), get(11), get(15));
        const rightAngle = getAngle(get(6), get(12), get(16));
        const isHoldingPose =
          (leftAngle > 160 && leftAngle < 200) ||
          (rightAngle > 160 && rightAngle < 200);

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

  useEffect(() => {
    selectedPoseRef.current = selectedPose;
  }, [selectedPose]);

  return (
    <div className="w-screen min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center justify-start">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center">
        🧠 AI Pose Tracker
      </h1>

      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {POSES.map((pose) => (
          <button
            key={pose}
            className="px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{
              backgroundColor: selectedPose === pose ? "#3b82f6" : "#374151",
              color: selectedPose === pose ? "#ffffff" : "#d1d5db",
            }}
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

      <div className="relative w-full max-w-5xl aspect-[4/3] sm:aspect-[16/9] flex items-center justify-center px-4 sm:px-6">
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
