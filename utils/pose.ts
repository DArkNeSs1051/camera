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

  const MIN_ELBOW_ANGLE = 60;
  const MAX_ELBOW_ANGLE = 120;
  const STRAIGHT_BODY_ANGLE = 160;
  const ELBOW_EXTENDED_ANGLE = 160;

  switch (poseName) {
    case "Push-up": {
      const angleElbowLeft = angle(5, 7, 9); // ไหล่-ข้อศอก-ข้อมือ ซ้าย
      const angleBodyLeft = angle(5, 11, 13); // ไหล่-สะโพก-เข่า ซ้าย
      const angleElbowRight = angle(6, 8, 10); // ไหล่-ข้อศอก-ข้อมือ ขวา
      const angleBodyRight = angle(6, 12, 14); // ไหล่-สะโพก-เข่า ขวา

      // ตรวจว่า "ลง" -> ศอกงอในช่วง 60–120 องศา และลำตัวตรง
      const isDownLeft =
        angleElbowLeft > MIN_ELBOW_ANGLE &&
        angleElbowLeft < MAX_ELBOW_ANGLE &&
        angleBodyLeft > STRAIGHT_BODY_ANGLE;

      const isDownRight =
        angleElbowRight > MIN_ELBOW_ANGLE &&
        angleElbowRight < MAX_ELBOW_ANGLE &&
        angleBodyRight > STRAIGHT_BODY_ANGLE;

      // ตรวจว่า "ขึ้น" -> ศอกเหยียดเกือบตรง (มากกว่า 160 องศา)
      const isUpLeft = angleElbowLeft > ELBOW_EXTENDED_ANGLE;
      const isUpRight = angleElbowRight > ELBOW_EXTENDED_ANGLE;

      detectBothSides(isUpLeft, isDownLeft, isUpRight, isDownRight, "Push-up");

      break;
    }
    case "Bench Press": {
      const angleElbowLeft = angle(5, 7, 9);
      const angleElbowRight = angle(6, 8, 10);
      const angleShoulderLeft = angle(11, 5, 7);
      const angleShoulderRight = angle(12, 6, 8);
      const isLeftValid = Math.abs(angleElbowLeft - angleShoulderLeft) > 15;
      const isRightValid = Math.abs(angleElbowRight - angleShoulderRight) > 15;
      detectBothSides(
        angleElbowLeft > 160 && isLeftValid,
        angleElbowLeft < 90 && isLeftValid,
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
    case "Leg Raises": {
      const leftLegAngle = getAngle(get(11), get(13), get(15));
      const rightLegAngle = getAngle(get(12), get(14), get(16));
      const leftLegUp = leftLegAngle > 160 && get(15).y < get(11).y;
      const rightLegUp = rightLegAngle > 160 && get(16).y < get(12).y;
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
      const leftRow = angle(5, 7, 9) < 90;
      const rightRow = angle(6, 8, 10) < 90;
      detectBothSides(
        !leftRow,
        leftRow,
        !rightRow,
        rightRow,
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
