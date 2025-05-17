import { Point } from "./pose";

export const getAngle = (a: Point, b: Point, c: Point) => {
  const ab = Math.atan2(c.y - b.y, c.x - b.x);
  const cb = Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(((ab - cb) * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
};
