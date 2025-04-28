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
  const [selectedPose, setSelectedPose] = useState<string>(""); // เริ่มต้นไม่เลือกท่า

  const count = useRef(0);
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
  const isDownPushUp = useRef(false);
  const benchPressHoldFrames = useRef(0);
  const isDownBenchPress = useRef(false);
  const squatHoldFrames = useRef(0);
  const isDownSquat = useRef(false);
  const lungeHoldFrames = useRef(0);
  const isDownLunge = useRef(false);
  const plankHoldFrames = useRef(0);
  const isDownPlank = useRef(false);
  const sidePlankHoldFrames = useRef(0);
  const isDownSidePlank = useRef(false);

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
    // คำนวณมุมข้อศอกซ้าย/ขวา
    const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);
    // คำนวณมุมหลังซ้าย/ขวา
    const leftBackAngle = getAngle(leftShoulder, leftHip, leftKnee);
    const rightBackAngle = getAngle(rightShoulder, rightHip, rightKnee);

    // ตรวจสอบหลังตรง
    const highlightBack =
      (Math.abs(leftBackAngle) > 20 && Math.abs(leftBackAngle) < 160) ||
      (Math.abs(rightBackAngle) > 20 && Math.abs(rightBackAngle) < 160);

    // ตรวจสอบข้อศอกต่ำกว่าจมูก (ใช้ข้างใดข้างหนึ่งก็ได้)
    const leftElbowAboveNose = nose.y > leftElbow.y;
    const rightElbowAboveNose = nose.y > rightElbow.y;

    // เงื่อนไขท่า down (ลง)
    const isDown =
      !highlightBack &&
      (leftElbowAboveNose || rightElbowAboveNose) &&
      ((Math.abs(leftElbowAngle) > 60 && Math.abs(leftElbowAngle) < 110) ||
        (Math.abs(rightElbowAngle) > 60 && Math.abs(rightElbowAngle) < 110));

    // เงื่อนไขท่า up (ขึ้น)
    const isUp =
      (Math.abs(leftElbowAngle) > 170 && Math.abs(leftElbowAngle) < 200) ||
      (Math.abs(rightElbowAngle) > 170 && Math.abs(rightElbowAngle) < 200);

    // State สำหรับการนับ
    if (isDown) {
      pushUpHoldFrames.current++;
      if (pushUpHoldFrames.current >= 5 && !isDownPushUp.current) {
        isDownPushUp.current = true;
      }
    } else {
      pushUpHoldFrames.current = 0;
    }

    if (isUp && isDownPushUp.current && !highlightBack && canCountNow()) {
      count.current++;
      isDownPushUp.current = false;
      lastCountTime = Date.now();
      lastDetectedPose.current = "Push-up";
    }

    // วาดเส้นและมุม (optional)
    drawAngleLine(leftShoulder, leftElbow, leftWrist, leftElbowAngle);
    drawAngleLine(rightShoulder, rightElbow, rightWrist, rightElbowAngle);
    drawAngleLine(leftShoulder, leftHip, leftKnee, leftBackAngle);
    drawAngleLine(rightShoulder, rightHip, rightKnee, rightBackAngle);
  };

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
    // คำนวณมุมข้อศอกซ้าย/ขวา
    const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);
    // คำนวณมุมหลังซ้าย/ขวา
    const leftBackAngle = getAngle(leftShoulder, leftHip, leftKnee);
    const rightBackAngle = getAngle(rightShoulder, rightHip, rightKnee);

    // ตรวจสอบหลังตรง
    const highlightBack =
      (Math.abs(leftBackAngle) > 20 && Math.abs(leftBackAngle) < 160) ||
      (Math.abs(rightBackAngle) > 20 && Math.abs(rightBackAngle) < 160);

    // คำนวณมุมข้อศอกและตำแหน่ง
    const isElbowBent =
      (Math.abs(leftElbowAngle) > 60 && Math.abs(leftElbowAngle) < 110) ||
      (Math.abs(rightElbowAngle) > 60 && Math.abs(rightElbowAngle) < 110);

    const isElbowExtended =
      (Math.abs(leftElbowAngle) > 160 && Math.abs(leftElbowAngle) < 200) ||
      (Math.abs(rightElbowAngle) > 160 && Math.abs(rightElbowAngle) < 200);

    // วางแขนแนวตั้งมากขึ้น ข้อมือควรต่ำกว่าไหล่ (ระหว่างยกุมเบลลง)
    const leftWristBelowShoulder = leftWrist.y > leftShoulder.y;
    const rightWristBelowShoulder = rightWrist.y > rightShoulder.y;

    const isDown =
      isElbowBent &&
      (leftWristBelowShoulder || rightWristBelowShoulder) &&
      !highlightBack;

    const isUp = isElbowExtended && !highlightBack;

    if (isDown) {
      benchPressHoldFrames.current++;
      if (benchPressHoldFrames.current >= 5 && !isDownBenchPress.current) {
        isDownBenchPress.current = true;
      }
    } else {
      benchPressHoldFrames.current = 0;
    }

    if (isUp && isDownBenchPress.current && canCountNow()) {
      count.current++;
      isDownBenchPress.current = false;
      lastCountTime = Date.now();
      lastDetectedPose.current = "Bench Press";
    }

    // วาดเส้นและมุม (optional)
    drawAngleLine(leftShoulder, leftElbow, leftWrist, leftElbowAngle);
    drawAngleLine(rightShoulder, rightElbow, rightWrist, rightElbowAngle);
    drawAngleLine(leftShoulder, leftHip, leftKnee, leftBackAngle);
    drawAngleLine(rightShoulder, rightHip, rightKnee, rightBackAngle);
  };

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
    // คำนวณมุมเข่าซ้าย/ขวา
    const leftKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);

    // คำนวณมุมลำตัว (หลัง) เพื่มูลช่วยตรวจสอบหลังตรง
    const leftBodyAngle = getAngle(leftShoulder, leftHip, leftKnee);
    const rightBodyAngle = getAngle(rightShoulder, rightHip, rightKnee);

    // เงื่อนไข squat ลง (งอเข่า)
    const isSquatDown =
      leftKneeAngle > 60 &&
      leftKneeAngle < 120 &&
      rightKneeAngle > 60 &&
      rightKneeAngle < 120 &&
      leftBodyAngle > 40 &&
      rightBodyAngle > 40;

    // เงื่อนไข squat ขึ้น (เหยียดเข่า)
    const isSquatUp = leftKneeAngle > 160 && rightKneeAngle > 160;

    if (isSquatDown) {
      squatHoldFrames.current++;
      if (squatHoldFrames.current >= 5 && !isDownSquat.current) {
        isDownSquat.current = true;
      }
    } else {
      squatHoldFrames.current = 0;
    }

    if (isSquatUp && isDownSquat.current && canCountNow()) {
      count.current++;
      isDownSquat.current = false;
      lastCountTime = Date.now();
      lastDetectedPose.current = "Squat";
    }

    // วาดเส้นและมุม (optional)
    drawAngleLine(leftHip, leftKnee, leftAnkle, leftKneeAngle);
    drawAngleLine(rightHip, rightKnee, rightAnkle, rightKneeAngle);
    drawAngleLine(leftShoulder, leftHip, leftKnee, leftBodyAngle);
    drawAngleLine(rightShoulder, rightHip, rightKnee, rightBodyAngle);
  };

  const detectLunge = (
    leftHip: Point,
    leftKnee: Point,
    leftAnkle: Point,
    rightHip: Point,
    rightKnee: Point,
    rightAnkle: Point,
    leftShoulder: Point,
    rightShoulder: Point
  ) => {
    // กำหนดให้ขาซ้ายเป็นขาหน้า (สามารถสลับ logic สำหรับขาขวาได้)
    const leftKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);
    const leftBodyAngle = getAngle(leftShoulder, leftHip, leftKnee);
    const rightBodyAngle = getAngle(rightShoulder, rightHip, rightKnee);

    // เงื่อนไข lunge ลง (ขาหน้าตั้งฉาก ขาหลังงอ)
    const isLungeDown =
      leftKneeAngle > 70 &&
      leftKneeAngle < 120 && // ขาหน้าตั้งฉาก
      rightKneeAngle > 80 &&
      rightKneeAngle < 150 && // ขาหลังงอ
      leftBodyAngle > 30 &&
      rightBodyAngle > 30;

    // เงื่อนไข lunge ขึ้น (ขาทั้งสองเหยียด)
    const isLungeUp = leftKneeAngle > 160 && rightKneeAngle > 160;

    if (isLungeDown) {
      lungeHoldFrames.current++;
      if (lungeHoldFrames.current >= 5 && !isDownLunge.current) {
        isDownLunge.current = true;
      }
    } else {
      lungeHoldFrames.current = 0;
    }

    if (isLungeUp && isDownLunge.current && canCountNow()) {
      count.current++;
      isDownLunge.current = false;
      lastCountTime = Date.now();
      lastDetectedPose.current = "Leg Lunge";
    }

    // วาดเส้นและมุม (optional)
    drawAngleLine(leftHip, leftKnee, leftAnkle, leftKneeAngle);
    drawAngleLine(rightHip, rightKnee, rightAnkle, rightKneeAngle);
    drawAngleLine(leftShoulder, leftHip, leftKnee, leftBodyAngle);
    drawAngleLine(rightShoulder, rightHip, rightKnee, rightBodyAngle);
  };

  const detectPlank = (
    leftShoulder: Point,
    rightShoulder: Point,
    leftHip: Point,
    rightHip: Point,
    leftAnkle: Point,
    rightAnkle: Point
  ) => {
    // มุมไหล่-สะโพก-ข้อเท้า (ลำตัวควรตรง)
    const leftBodyAngle = getAngle(leftShoulder, leftHip, leftAnkle);
    const rightBodyAngle = getAngle(rightShoulder, rightHip, rightAnkle);

    // เงื่อนไข plank: ลำตัวตรง (มุมประมาณ 160-200 องศา)
    const isPlank =
      leftBodyAngle > 160 &&
      leftBodyAngle < 200 &&
      rightBodyAngle > 160 &&
      rightBodyAngle < 200;

    if (isPlank) {
      plankHoldFrames.current++;
      if (plankHoldFrames.current >= 10 && !isDownPlank.current) {
        isDownPlank.current = true;
        count.current++;
        lastCountTime = Date.now();
        lastDetectedPose.current = "Plank";
      }
    } else {
      plankHoldFrames.current = 0;
      isDownPlank.current = false;
    }

    // วาดเส้นและมุม (optional)
    drawAngleLine(leftShoulder, leftHip, leftAnkle, leftBodyAngle);
    drawAngleLine(rightShoulder, rightHip, rightAnkle, rightBodyAngle);
  };

  const detectSidePlank = (
    leftShoulder: Point,
    rightShoulder: Point,
    leftHip: Point,
    rightHip: Point,
    leftAnkle: Point,
    rightAnkle: Point
  ) => {
    // ตรวจสอบด้านซ้าย (Left Side Plank)
    const leftShoulderHipAnkleAngle = getAngle(
      leftShoulder,
      leftHip,
      leftAnkle
    );
    // ตรวจสอบด้านขวา (Right Side Plank)
    const rightShoulderHipAnkleAngle = getAngle(
      rightShoulder,
      rightHip,
      rightAnkle
    );

    // เงื่อนไข side plank: ลำตัวตรง (มุมประมาณ 160-200 องศา) และไหล่-สะโพก-ข้อเท้าอยู่ในแนวเดียวกัน
    const isLeftSidePlank =
      leftShoulderHipAnkleAngle > 160 &&
      leftShoulderHipAnkleAngle < 200 &&
      Math.abs(leftShoulder.x - leftHip.x) < 60 && // ไหล่กับสะโพกอยู่ในแนวตั้ง
      Math.abs(leftHip.x - leftAnkle.x) < 60; // สะโพกกับข้อเท้าอยู่ในแนวตั้ง

    const isRightSidePlank =
      rightShoulderHipAnkleAngle > 160 &&
      rightShoulderHipAnkleAngle < 200 &&
      Math.abs(rightShoulder.x - rightHip.x) < 60 &&
      Math.abs(rightHip.x - rightAnkle.x) < 60;

    if (isLeftSidePlank || isRightSidePlank) {
      sidePlankHoldFrames.current++;
      if (sidePlankHoldFrames.current >= 10 && !isDownSidePlank.current) {
        isDownSidePlank.current = true;
        count.current++;
        lastCountTime = Date.now();
        lastDetectedPose.current = isLeftSidePlank
          ? "Side Plank (Left)"
          : "Side Plank (Right)";
      }
    } else {
      sidePlankHoldFrames.current = 0;
      isDownSidePlank.current = false;
    }

    // วาดเส้นและมุม (optional)
    drawAngleLine(leftShoulder, leftHip, leftAnkle, leftShoulderHipAnkleAngle);
    drawAngleLine(
      rightShoulder,
      rightHip,
      rightAnkle,
      rightShoulderHipAnkleAngle
    );
  };

  const detectExercise = (lm: any[]) => {
    if (!lm || lm.length < 17) return;

    // Helper to check keypoint confidence
    const isConfident = (kp: any) => kp && kp.score > 0.3;

    // Keypoints
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

    // ตรวจสอบว่ามี keypoint ที่ต้องใช้ครบและ confidence ดี
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
      // ตรวจจับเฉพาะท่าที่เลือกเท่านั้น
      if (selectedPose === "Push-up")
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
      if (selectedPose === "Bench Press")
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
      if (selectedPose === "Squat")
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
      if (selectedPose === "Leg Lunge")
        detectLunge(
          leftHip,
          leftKnee,
          leftAnkle,
          rightHip,
          rightKnee,
          rightAnkle,
          leftShoulder,
          rightShoulder
        );
      if (selectedPose === "Plank")
        detectPlank(
          leftShoulder,
          rightShoulder,
          leftHip,
          rightHip,
          leftAnkle,
          rightAnkle
        );
      if (selectedPose === "Side Plank")
        detectSidePlank(
          leftShoulder,
          rightShoulder,
          leftHip,
          rightHip,
          leftAnkle,
          rightAnkle
        );
    } else {
      pushUpHoldFrames.current = 0;
      isDownPushUp.current = false;
      benchPressHoldFrames.current = 0;
      isDownBenchPress.current = false;
      squatHoldFrames.current = 0;
      isDownSquat.current = false;
      lungeHoldFrames.current = 0;
      isDownLunge.current = false;
      plankHoldFrames.current = 0;
      isDownPlank.current = false;
      sidePlankHoldFrames.current = 0;
      isDownSidePlank.current = false;
    }

    // อัปเดต UI
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
          modelType: "singlepose-thunder",
          enableSmoothing: true,
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
            if (keypoint.score && keypoint.score > 0.3) {
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
      {/* แสดงสถานะท่าที่กำลังตรวจจับ */}
      <div className="absolute top-4 left-4 z-20 bg-white/90 px-4 py-2 rounded shadow font-bold text-black">
        {selectedPose 
          ? `กำลังตรวจจับ: ${selectedPose}`
          : "กรุณาเลือกท่าที่ต้องการตรวจจับ"}
      </div>
      
      {/* แสดงจำนวนครั้งที่ตรวจจับได้ */}
      <div className="absolute top-4 right-4 z-20 bg-white/90 px-4 py-2 rounded shadow font-bold text-black">
        จำนวนครั้งที่ตรวจจับ: {count.current}
      </div>
      
      {/* ปุ่มเลือกท่า */}
      <div className="absolute top-20 left-4 z-10 flex flex-col gap-2 bg-white/80 p-2 rounded">
        <button onClick={() => setSelectedPose("Push-up")} className={selectedPose === "Push-up" ? "font-bold" : ""}>Push-up</button>
        <button onClick={() => setSelectedPose("Bench Press")} className={selectedPose === "Bench Press" ? "font-bold" : ""}>Bench Press</button>
        <button onClick={() => setSelectedPose("Squat")} className={selectedPose === "Squat" ? "font-bold" : ""}>Squat</button>
        <button onClick={() => setSelectedPose("Leg Lunge")} className={selectedPose === "Leg Lunge" ? "font-bold" : ""}>Leg Lunge</button>
        <button onClick={() => setSelectedPose("Plank")} className={selectedPose === "Plank" ? "font-bold" : ""}>Plank</button>
        <button onClick={() => setSelectedPose("Side Plank")} className={selectedPose === "Side Plank" ? "font-bold" : ""}>Side Plank</button>
      </div>
      
      {/* ... existing code ... */}
    </div>
  );
}
