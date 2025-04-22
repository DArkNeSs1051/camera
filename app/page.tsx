"use client";

import React, { useEffect, useRef, useState } from "react";
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

  // state สำหรับ UI
  const [pushUpCount, setPushUpCount] = useState(0);
  const [benchPressCount, setBenchPressCount] = useState(0);
  const [squatCount, setSquatCount] = useState(0);
  const [currentPose, setCurrentPose] = useState<string | null>(null);

  // สำหรับ logic
  const pushUpHoldFrames = useRef(0);
  const benchPressHoldFrames = useRef(0);
  const squatHoldFrames = useRef(0);
  const isDownPushUp = useRef(false);
  const isDownBenchPress = useRef(false);
  const isDownSquat = useRef(false);

  // เวลาสำหรับแต่ละท่า
  const lastPushUpTime = useRef(0);
  const lastBenchPressTime = useRef(0);
  const lastSquatTime = useRef(0);
  const COUNT_DELAY = 800;

  const canCountPushUp = () => Date.now() - lastPushUpTime.current > COUNT_DELAY;
  const canCountBenchPress = () => Date.now() - lastBenchPressTime.current > COUNT_DELAY;
  const canCountSquat = () => Date.now() - lastSquatTime.current > COUNT_DELAY;

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

  // --- Detect Push-up ---
  const detectPushUp = (
    leftShoulder: Point,
    leftElbow: Point,
    leftWrist: Point,
    rightShoulder: Point,
    rightElbow: Point,
    rightWrist: Point,
    leftHip: Point,
    leftKnee: Point,
    rightHip: Point,
    rightKnee: Point,
    nose: Point
  ) => {
    const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);
    const leftBackAngle = getAngle(leftShoulder, leftHip, leftKnee);
    const rightBackAngle = getAngle(rightShoulder, rightHip, rightKnee);

    const highlightBack =
      (Math.abs(leftBackAngle) > 20 && Math.abs(leftBackAngle) < 160) ||
      (Math.abs(rightBackAngle) > 20 && Math.abs(rightBackAngle) < 160);

    const leftElbowAboveNose = nose.y > leftElbow.y;
    const rightElbowAboveNose = nose.y > rightElbow.y;

    const isDown =
      !highlightBack &&
      (leftElbowAboveNose || rightElbowAboveNose) &&
      ((Math.abs(leftElbowAngle) > 70 && Math.abs(leftElbowAngle) < 100) ||
        (Math.abs(rightElbowAngle) > 70 && Math.abs(rightElbowAngle) < 100));

    const isUp =
      (Math.abs(leftElbowAngle) > 170 && Math.abs(leftElbowAngle) < 200) ||
      (Math.abs(rightElbowAngle) > 170 && Math.abs(rightElbowAngle) < 200);

    if (isDown) {
      pushUpHoldFrames.current++;
      if (pushUpHoldFrames.current >= 2 && !isDownPushUp.current) {
        isDownPushUp.current = true;
      }
    } else {
      pushUpHoldFrames.current = 0;
    }

    if (isUp && isDownPushUp.current && !highlightBack && canCountPushUp()) {
      setPushUpCount((prev) => prev + 1);
      isDownPushUp.current = false;
      lastPushUpTime.current = Date.now();
      setCurrentPose("Push-up");
    }

    drawAngleLine(leftShoulder, leftElbow, leftWrist, leftElbowAngle);
    drawAngleLine(rightShoulder, rightElbow, rightWrist, rightElbowAngle);
    drawAngleLine(leftShoulder, leftHip, leftKnee, leftBackAngle);
    drawAngleLine(rightShoulder, rightHip, rightKnee, rightBackAngle);
  };

  // --- Detect Bench Press ---
  const detectBenchPress = (
    leftShoulder: Point,
    leftElbow: Point,
    leftWrist: Point,
    rightShoulder: Point,
    rightElbow: Point,
    rightWrist: Point,
    leftHip: Point,
    leftKnee: Point,
    rightHip: Point,
    rightKnee: Point
  ) => {
    const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);
    const leftBackAngle = getAngle(leftShoulder, leftHip, leftKnee);
    const rightBackAngle = getAngle(rightShoulder, rightHip, rightKnee);

    const highlightBack =
      (Math.abs(leftBackAngle) > 20 && Math.abs(leftBackAngle) < 160) ||
      (Math.abs(rightBackAngle) > 20 && Math.abs(rightBackAngle) < 160);

    const isElbowBent =
      (Math.abs(leftElbowAngle) > 60 && Math.abs(leftElbowAngle) < 110) ||
      (Math.abs(rightElbowAngle) > 60 && Math.abs(rightElbowAngle) < 110);

    const isElbowExtended =
      (Math.abs(leftElbowAngle) > 160 && Math.abs(leftElbowAngle) < 200) ||
      (Math.abs(rightElbowAngle) > 160 && Math.abs(rightElbowAngle) < 200);

    const leftWristBelowShoulder = leftWrist.y > leftShoulder.y;
    const rightWristBelowShoulder = rightWrist.y > rightShoulder.y;

    const isBenchDown =
      isElbowBent &&
      (leftWristBelowShoulder || rightWristBelowShoulder) &&
      !highlightBack;

    const isBenchUp = isElbowExtended && !highlightBack;

    if (isBenchDown) {
      benchPressHoldFrames.current++;
      if (benchPressHoldFrames.current >= 2 && !isDownBenchPress.current) {
        isDownBenchPress.current = true;
      }
    } else {
      benchPressHoldFrames.current = 0;
    }

    if (isBenchUp && isDownBenchPress.current && canCountBenchPress()) {
      setBenchPressCount((prev) => prev + 1);
      isDownBenchPress.current = false;
      lastBenchPressTime.current = Date.now();
      setCurrentPose("Dumbbell Bench Press");
    }

    drawAngleLine(leftShoulder, leftElbow, leftWrist, leftElbowAngle);
    drawAngleLine(rightShoulder, rightElbow, rightWrist, rightElbowAngle);
    drawAngleLine(leftShoulder, leftHip, leftKnee, leftBackAngle);
    drawAngleLine(rightShoulder, rightHip, rightKnee, rightBackAngle);
  };

  // --- Detect Squat ---
  const detectSquat = (
    leftHip: Point,
    leftKnee: Point,
    leftAnkle: Point,
    rightHip: Point,
    rightKnee: Point,
    rightAnkle: Point,
    leftShoulder: Point,
    rightShoulder: Point
  ) => {
    const leftKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);
    const leftBodyAngle = getAngle(leftShoulder, leftHip, leftKnee);
    const rightBodyAngle = getAngle(rightShoulder, rightHip, rightKnee);

    const isSquatDown =
      leftKneeAngle > 60 &&
      leftKneeAngle < 120 &&
      rightKneeAngle > 60 &&
      rightKneeAngle < 120 &&
      leftBodyAngle > 40 &&
      rightBodyAngle > 40;

    const isSquatUp = leftKneeAngle > 160 && rightKneeAngle > 160;

    if (isSquatDown) {
      squatHoldFrames.current++;
      if (squatHoldFrames.current >= 2 && !isDownSquat.current) {
        isDownSquat.current = true;
      }
    } else {
      squatHoldFrames.current = 0;
    }

    if (isSquatUp && isDownSquat.current && canCountSquat()) {
      setSquatCount((prev) => prev + 1);
      isDownSquat.current = false;
      lastSquatTime.current = Date.now();
      setCurrentPose("Squat");
    }

    drawAngleLine(leftHip, leftKnee, leftAnkle, leftKneeAngle);
    drawAngleLine(rightHip, rightKnee, rightAnkle, rightKneeAngle);
    drawAngleLine(leftShoulder, leftHip, leftKnee, leftBodyAngle);
    drawAngleLine(rightShoulder, rightHip, rightKnee, rightBodyAngle);
  };

  const detectExercise = (lm: any[]) => {
    if (!lm || lm.length < 17) return;

    const isConfident = (kp: any) => kp && kp.score > 0.5;

    const nose = lm[0];
    const leftShoulder = lm[5];
    const leftElbow = lm[7];
    const leftWrist = lm[9];
    const leftHip = lm[11];
    const leftKnee = lm[13];
    const leftAnkle = lm[15];

    const rightShoulder = lm[6];
    const rightElbow = lm[8];
    const rightWrist = lm[10];
    const rightHip = lm[12];
    const rightKnee = lm[14];
    const rightAnkle = lm[16];

    if (
      isValidLandmarks(
        leftShoulder,
        leftElbow,
        leftWrist,
        leftHip,
        leftKnee,
        leftAnkle,
        rightShoulder,
        rightElbow,
        rightWrist,
        rightHip,
        rightKnee,
        rightAnkle,
        nose
      ) &&
      isConfident(leftShoulder) &&
      isConfident(leftElbow) &&
      isConfident(leftWrist) &&
      isConfident(leftHip) &&
      isConfident(leftKnee) &&
      isConfident(leftAnkle) &&
      isConfident(rightShoulder) &&
      isConfident(rightElbow) &&
      isConfident(rightWrist) &&
      isConfident(rightHip) &&
      isConfident(rightKnee) &&
      isConfident(rightAnkle) &&
      isConfident(nose)
    ) {
      detectPushUp(
        leftShoulder,
        leftElbow,
        leftWrist,
        rightShoulder,
        rightElbow,
        rightWrist,
        leftHip,
        leftKnee,
        rightHip,
        rightKnee,
        nose
      );
      detectBenchPress(
        leftShoulder,
        leftElbow,
        leftWrist,
        rightShoulder,
        rightElbow,
        rightWrist,
        leftHip,
        leftKnee,
        rightHip,
        rightKnee
      );
      detectSquat(
        leftHip,
        leftKnee,
        leftAnkle,
        rightHip,
        rightKnee,
        rightAnkle,
        leftShoulder,
        rightShoulder
      );
    } else {
      pushUpHoldFrames.current = 0;
      isDownPushUp.current = false;
      benchPressHoldFrames.current = 0;
      isDownBenchPress.current = false;
      squatHoldFrames.current = 0;
      isDownSquat.current = false;
    }
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
          <span className="font-bold">
            {currentPose ?? "-"}
          </span>
        </div>
        <div className="text-xl font-bold mb-2">สรุปจำนวนแต่ละท่า</div>
        <ul className="space-y-1">
          <li>
            Push-up: <span>{pushUpCount}</span>
          </li>
          <li>
            Dumbbell Bench Press: <span>{benchPressCount}</span>
          </li>
          <li>
            Squat: <span>{squatCount}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
