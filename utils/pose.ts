import { getAngle } from "./getAngle";

export interface Point {
  x: number;
  y: number;
  score?: number;
}

export const POSES = [
  "auto",
  "Push-up",
  "Bench Press",
  "Squat",
  "Leg Lunge",
  "Plank",
  "Side Plank",
  "Leg Raises",
  "Russian Twists",
  "Burpee",
  "Dumbbell Shoulder Press",
  "Dumbbell Bench Press",
  "Dumbbell Bent-Over Rows",
  "Dumbbell Bicep Curls",
  "Dumbbell Goblet Squats",
  "Dumbbell Romanian Deadlifts",
  "Dumbbell Overhand Tricep Extension",
  "Dumbbell Side Lateral Raises",
];

interface PoseDetection {
  keypoints: Point[];
  selectedPose: string;
  selectedPoseRef: React.RefObject<string>;
  isHolding: boolean;
  isHoldingRef: React.RefObject<boolean>;
  holdStart: React.RefObject<number | null>;
  lastCountTime: React.RefObject<number>;
  releaseTimeout: React.RefObject<NodeJS.Timeout | null>;
  COUNT_DELAY: number;
  plankTime: number;
  setCount: React.Dispatch<React.SetStateAction<number>>;
  setSummary: React.Dispatch<React.SetStateAction<string>>;
  setIsHolding: React.Dispatch<React.SetStateAction<boolean>>;
  setPlankTime: React.Dispatch<React.SetStateAction<number>>;
}

export const handlePose = (props: PoseDetection) => {
  const {
    keypoints,
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
  } = props;

  const now = Date.now();

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
    // ตรวจสอบว่ามีคีย์พอยต์ที่จำเป็นหรือไม่
    if (!keypoints || keypoints.length < 17) {
      return; // ไม่มีข้อมูลเพียงพอสำหรับการตรวจจับ
    }

    // ตรวจสอบคะแนนความเชื่อมั่น (confidence score) ของคีย์พอยต์หลัก
    const requiredKeypoints = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const minConfidence = 0.3;

    const allKeypointsValid = requiredKeypoints.every(
      (i) =>
        keypoints[i] &&
        (!keypoints[i].score || keypoints[i].score > minConfidence)
    );

    if (!allKeypointsValid) {
      return; // คีย์พอยต์บางจุดมีความเชื่อมั่นต่ำเกินไป
    }

    if (downCondLeft || downCondRight) {
      if (!isHoldingRef.current) {
        holdStart.current = Date.now();
        setIsHolding(true);
        isHoldingRef.current = true;
      }
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
      isHoldingRef.current = false;
      holdStart.current = null;
    } else if (
      !downCondLeft &&
      !downCondRight &&
      isHoldingRef.current &&
      !releaseTimeout.current
    ) {
      releaseTimeout.current = setTimeout(() => {
        setIsHolding(false);
        isHoldingRef.current = false;
        releaseTimeout.current = null;
      }, 400);
    }
  };

  const poseName = selectedPoseRef.current;

  // ตรวจสอบว่ามีการเลือกท่าหรือไม่
  if (!poseName || poseName === "") {
    return; // ไม่มีการเลือกท่า
  }

  switch (poseName) {
    case "Push-up": {
      const leftShoulder = keypoints[5];
      const rightShoulder = keypoints[6];
      const leftHip = keypoints[11];
      const rightHip = keypoints[12];
      const leftAnkle = keypoints[15];
      const rightAnkle = keypoints[16];

      // ตำแหน่งเฉลี่ยของไหล่ สะโพก ข้อเท้า
      const shoulder = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      const hip = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
      };
      const ankle = {
        x: (leftAnkle.x + rightAnkle.x) / 2,
        y: (leftAnkle.y + rightAnkle.y) / 2,
      };

      // มุมระหว่างไหล่-สะโพก-ข้อเท้า
      const bodyAlignmentAngle = getAngle(shoulder, hip, ankle);
      const inPlank = bodyAlignmentAngle > 150;

      if (!inPlank) {
        // ยังไม่อยู่ในท่า push-up ที่ถูกต้อง
        return;
      }

      const averageShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const averageHipY = (leftHip.y + rightHip.y) / 2;

      const isDownLeft = averageShoulderY > averageHipY + 40;
      const isDownRight = averageShoulderY > averageHipY + 40;

      const isUpLeft = averageShoulderY < averageHipY + 30;
      const isUpRight = averageShoulderY < averageHipY + 30;

      detectBothSides(isUpLeft, isDownLeft, isUpRight, isDownRight, "Push-up");
      break;
    }

    case "Bench Press": {
      const angleElbowLeft = angle(5, 7, 9);
      const angleElbowRight = angle(6, 8, 10);

      // ตรวจสอบว่าผู้อยู่ในท่านอนหรือไม่ (ไหล่และสะโพกอยู่ในระดับเดียวกัน)
      const leftShoulderY = get(5).y;
      const rightShoulderY = get(6).y;
      const leftHipY = get(11).y;
      const rightHipY = get(12).y;

      // ตรวจสอบว่าไหล่และสะโพกอยู่ในแนวเดียวกัน (นอนราบ)
      const isLyingDown =
        Math.abs(leftShoulderY - leftHipY) < 30 &&
        Math.abs(rightShoulderY - rightHipY) < 30;

      // ตรวจสอบว่าแขนอยู่ในตำแหน่งที่ถูกต้อง (ข้อศอกงอลงและเหยียดขึ้น)
      const isLeftArmDown = angleElbowLeft < 90 && isLyingDown;
      const isRightArmDown = angleElbowRight < 90 && isLyingDown;
      const isLeftArmUp = angleElbowLeft > 160 && isLyingDown;
      const isRightArmUp = angleElbowRight > 160 && isLyingDown;

      detectBothSides(
        isLeftArmUp,
        isLeftArmDown,
        isRightArmUp,
        isRightArmDown,
        "Bench Press"
      );
      break;
    }
    case "Squat": {
      const angleKneeLeft = angle(11, 13, 15);
      const angleKneeRight = angle(12, 14, 16);
      const angleHipLeft = angle(5, 11, 13);
      const angleHipRight = angle(6, 12, 14);

      // ตรวจสอบว่าเข่างอและสะโพกงอ (ท่าลง)
      const isDownLeft = angleKneeLeft < 120 && angleHipLeft < 120;
      const isDownRight = angleKneeRight < 120 && angleHipRight < 120;

      // ตรวจสอบว่าเข่าและสะโพกเหยียดตรง (ท่าขึ้น)
      const isUpLeft = angleKneeLeft > 160 && angleHipLeft > 160;
      const isUpRight = angleKneeRight > 160 && angleHipRight > 160;

      detectBothSides(isUpLeft, isDownLeft, isUpRight, isDownRight, "Squat");
      break;
    }
    case "Leg Lunge": {
      const angleKneeLeft = angle(11, 13, 15);
      const angleKneeRight = angle(12, 14, 16);
      const angleHipLeft = angle(5, 11, 13);
      const angleHipRight = angle(6, 12, 14);

      // ตรวจสอบว่าเข่าข้างหนึ่งงอและอีกข้างเหยียด (ท่าลง)
      const isLeftLegForward = angleKneeLeft < 120 && angleKneeRight > 140;
      const isRightLegForward = angleKneeRight < 120 && angleKneeLeft > 140;

      // ตรวจสอบว่าทั้งสองขาเหยียดตรง (ท่าขึ้น)
      const isBothLegsUp = angleKneeLeft > 160 && angleKneeRight > 160;

      detectBothSides(
        isBothLegsUp,
        isLeftLegForward || isRightLegForward,
        isBothLegsUp,
        isLeftLegForward || isRightLegForward,
        "Leg Lunge"
      );
      break;
    }
    case "Plank":
    case "Side Plank": {
      // ตรวจสอบว่ามีคีย์พอยต์ที่จำเป็นหรือไม่
      if (!keypoints || keypoints.length < 17) {
        return;
      }

      let isHoldingPose = false;

      if (poseName === "Plank") {
        // ตรวจสอบว่าลำตัวตรง (ไหล่-สะโพก-เข่า)
        const leftBodyAngle = getAngle(get(5), get(11), get(13));
        const rightBodyAngle = getAngle(get(6), get(12), get(14));

        // ตรวจสอบว่าข้อศอกงอ (ไหล่-ข้อศอก-ข้อมือ)
        const leftElbowAngle = getAngle(get(5), get(7), get(9));
        const rightElbowAngle = getAngle(get(6), get(8), get(10));

        isHoldingPose =
          leftBodyAngle > 160 &&
          rightBodyAngle > 160 && // ลำตัวตรง
          leftElbowAngle < 120 &&
          rightElbowAngle < 120; // ข้อศอกงอ
      } else {
        // Side Plank
        // ตรวจสอบว่าลำตัวตรงในแนวด้านข้าง
        const leftSideAngle = getAngle(get(5), get(11), get(15));
        const rightSideAngle = getAngle(get(6), get(12), get(16));

        isHoldingPose =
          (leftSideAngle > 160 && leftSideAngle < 200) ||
          (rightSideAngle > 160 && rightSideAngle < 200);
      }

      if (isHoldingPose) {
        if (!isHolding) {
          holdStart.current = now;
          setIsHolding(true);
        } else {
          setPlankTime(Math.floor((now - (holdStart.current || now)) / 1000));
        }
      } else if (isHolding) {
        setSummary(
          `คุณทำ ${poseName} ได้ ${Math.floor(plankTime / 60)} นาที ${
            plankTime % 60
          } วินาที`
        );
        setPlankTime(0);
        setIsHolding(false);
        holdStart.current = null;
      }
      break;
    }
    case "Leg Raises": {
      // ตรวจสอบว่ามีคีย์พอยต์ที่จำเป็นหรือไม่
      if (!keypoints || keypoints.length < 17) {
        return;
      }

      const leftLegAngle = getAngle(get(11), get(13), get(15));
      const rightLegAngle = getAngle(get(12), get(14), get(16));

      // ตรวจสอบว่าขาเหยียดตรงและยกขึ้น (ท่าขึ้น)
      const leftLegUp = leftLegAngle > 160 && get(15).y < get(11).y;
      const rightLegUp = rightLegAngle > 160 && get(16).y < get(12).y;

      // ตรวจสอบว่าขาเหยียดตรงและลดลง (ท่าลง)
      const leftLegDown = leftLegAngle > 160 && get(15).y > get(11).y + 40;
      const rightLegDown = rightLegAngle > 160 && get(16).y > get(12).y + 40;

      detectBothSides(
        leftLegDown,
        leftLegUp,
        rightLegDown,
        rightLegUp,
        "Leg Raises"
      );
      break;
    }
    case "Russian Twists": {
      const leftShoulder = get(5);
      const rightShoulder = get(6);
      const leftHip = get(11);
      const rightHip = get(12);
      const twistLeft = leftShoulder.x < leftHip.x - 30;
      const twistRight = rightShoulder.x > rightHip.x + 30;
      detectBothSides(
        twistLeft,
        twistRight,
        twistRight,
        twistLeft,
        "Russian Twists"
      );
      break;
    }
    case "Dumbbell Shoulder Press": {
      const leftArmUp = angle(7, 5, 11) > 160 && angle(5, 7, 9) > 160;
      const leftArmDown = angle(7, 5, 11) < 90;
      const rightArmUp = angle(8, 6, 12) > 160 && angle(6, 8, 10) > 160;
      const rightArmDown = angle(8, 6, 12) < 90;
      detectBothSides(
        leftArmDown,
        leftArmUp,
        rightArmDown,
        rightArmUp,
        "Dumbbell Shoulder Press"
      );
      break;
    }
    case "Dumbbell Bench Press": {
      const leftArmDown = angle(5, 7, 9) < 90;
      const leftArmUp = angle(5, 7, 9) > 160;
      const rightArmDown = angle(6, 8, 10) < 90;
      const rightArmUp = angle(6, 8, 10) > 160;
      detectBothSides(
        leftArmUp,
        leftArmDown,
        rightArmUp,
        rightArmDown,
        "Dumbbell Bench Press"
      );
      break;
    }
    case "Dumbbell Bent-Over Rows": {
      // ตรวจสอบมุมของสะโพก (ต้องก้มตัวลง)
      const leftHipAngle = angle(5, 11, 13);
      const rightHipAngle = angle(6, 12, 14);

      // ตรวจสอบว่าอยู่ในท่าก้มตัว (bent over)
      const isBentOver = leftHipAngle < 140 && rightHipAngle < 140;

      // ตรวจสอบการดึงแขน (row)
      const leftRow = angle(5, 7, 9) < 90;
      const rightRow = angle(6, 8, 10) < 90;

      // ตรวจจับท่าเฉพาะเมื่ออยู่ในท่าก้มตัวเท่านั้น
      const leftArmDown = !leftRow && isBentOver;
      const leftArmUp = leftRow && isBentOver;
      const rightArmDown = !rightRow && isBentOver;
      const rightArmUp = rightRow && isBentOver;

      detectBothSides(
        leftArmDown,
        leftArmUp,
        rightArmDown,
        rightArmUp,
        "Dumbbell Bent-Over Rows"
      );
      break;
    }
    case "Dumbbell Bicep Curls": {
      const leftElbowAngle = angle(5, 7, 9);
      const rightElbowAngle = angle(6, 8, 10);
      const leftArmDown = leftElbowAngle > 160;
      const leftArmUp = leftElbowAngle < 90;
      const rightArmDown = rightElbowAngle > 160;
      const rightArmUp = rightElbowAngle < 90;
      detectBothSides(
        leftArmDown,
        leftArmUp,
        rightArmDown,
        rightArmUp,
        "Dumbbell Bicep Curls"
      );
      break;
    }
    case "Dumbbell Goblet Squats": {
      const leftKneeAngle = angle(11, 13, 15);
      const rightKneeAngle = angle(12, 14, 16);
      const leftElbowAngle = angle(5, 7, 9);
      const rightElbowAngle = angle(6, 8, 10);

      // ตรวจสอบว่าแขนอยู่ในตำแหน่งถือดัมเบลล์ที่หน้าอก (ข้อศอกงอ)
      const armsInGobletPosition =
        leftElbowAngle < 120 && rightElbowAngle < 120;

      // ตรวจสอบตำแหน่งขาเหยียดตรง (ยืน)
      const legsUp = leftKneeAngle > 160 && rightKneeAngle > 160;

      // ตรวจสอบตำแหน่งขางอ (สควอท)
      const legsDown =
        leftKneeAngle < 120 && rightKneeAngle < 120 && armsInGobletPosition;

      detectBothSides(
        legsUp,
        legsDown,
        legsUp,
        legsDown,
        "Dumbbell Goblet Squats"
      );
      break;
    }
    case "Dumbbell Romanian Deadlifts": {
      const leftHipAngle = angle(5, 11, 13);
      const rightHipAngle = angle(6, 12, 14);
      const leftKneeAngle = angle(11, 13, 15);
      const rightKneeAngle = angle(12, 14, 16);

      // ตรวจสอบว่าแขนเหยียดตรงและอยู่ด้านหน้าของลำตัว
      const armsExtended = get(7).y > get(5).y && get(8).y > get(6).y;

      // ตำแหน่งยืนตรง (ท่าเริ่มต้น)
      const standingPosition = leftHipAngle > 160 && rightHipAngle > 160;

      // ตำแหน่งก้มตัว (ท่าลง) - สะโพกงอ แต่เข่าเหยียดค่อนข้างตรง
      const bentPosition =
        leftHipAngle < 120 &&
        rightHipAngle < 120 &&
        leftKneeAngle > 140 &&
        rightKneeAngle > 140 &&
        armsExtended;

      detectBothSides(
        standingPosition,
        bentPosition,
        standingPosition,
        bentPosition,
        "Dumbbell Romanian Deadlifts"
      );
      break;
    }
    case "Dumbbell Overhand Tricep Extension": {
      const leftElbowAngle = angle(5, 7, 9);
      const rightElbowAngle = angle(6, 8, 10);

      // ตรวจสอบตำแหน่งแขนเหนือศีรษะ
      const armsOverhead = get(7).y < get(5).y && get(8).y < get(6).y;

      // ตำแหน่งแขนเหยียดตรง (ท่าเริ่มต้น)
      const armsExtended =
        leftElbowAngle > 160 && rightElbowAngle > 160 && armsOverhead;

      // ตำแหน่งแขนงอ (ท่าลง)
      const armsBent =
        leftElbowAngle < 90 && rightElbowAngle < 90 && armsOverhead;

      detectBothSides(
        armsExtended,
        armsBent,
        armsExtended,
        armsBent,
        "Dumbbell Overhand Tricep Extension"
      );
      break;
    }
    case "Dumbbell Side Lateral Raises": {
      const leftShoulderAngle = angle(11, 5, 7);
      const rightShoulderAngle = angle(12, 6, 8);

      // ตำแหน่งแขนลง (ท่าเริ่มต้น)
      const armsDown = leftShoulderAngle < 30 && rightShoulderAngle < 30;

      // ตำแหน่งแขนยกออกด้านข้าง (ท่าขึ้น)
      const armsRaised =
        leftShoulderAngle > 80 &&
        leftShoulderAngle < 110 &&
        rightShoulderAngle > 80 &&
        rightShoulderAngle < 110;

      detectBothSides(
        armsDown,
        armsRaised,
        armsDown,
        armsRaised,
        "Dumbbell Side Lateral Raises"
      );
      break;
    }
    case "Burpee": {
      // ตรวจสอบมุมของเข่าและข้อศอก
      const leftKneeAngle = angle(11, 13, 15);
      const rightKneeAngle = angle(12, 14, 16);
      const leftElbowAngle = angle(5, 7, 9);
      const rightElbowAngle = angle(6, 8, 10);

      // ตรวจสอบความสูงของสะโพกเทียบกับศีรษะ (สำหรับตรวจจับท่ากระโดด)
      const hipHeight = (get(11).y + get(12).y) / 2;
      const headHeight = get(0).y;
      const isJumping = hipHeight < headHeight + 20; // สะโพกอยู่สูงใกล้เคียงกับศีรษะ

      // ตรวจสอบท่ายืน (ท่าเริ่มต้น)
      const isStanding = leftKneeAngle > 160 && rightKneeAngle > 160;

      // ตรวจสอบท่าสควอทหรือท่าพุชอัพ (ท่าลง)
      const isSquatOrPushup =
        (leftKneeAngle < 120 && rightKneeAngle < 120) || // ท่าสควอท
        (leftElbowAngle < 120 && rightElbowAngle < 120); // ท่าพุชอัพ

      detectBothSides(
        isStanding || isJumping, // ท่าขึ้น (ยืนหรือกระโดด)
        isSquatOrPushup, // ท่าลง (สควอทหรือพุชอัพ)
        isStanding || isJumping,
        isSquatOrPushup,
        "Burpee"
      );
      break;
    }
    case "auto": {
      // โหมดอัตโนมัติอาจไม่ต้องการ logic เฉพาะ หรืออาจใช้สำหรับตรวจจับท่าอัตโนมัติ
      // ถ้าต้องการเพิ่ม logic สำหรับโหมดอัตโนมัติ สามารถเพิ่มได้ที่นี่
      break;
    }
  }
};
