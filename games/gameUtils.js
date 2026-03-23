export function polygonRadius(angle, sides) {
  const slice = (Math.PI * 2) / sides;
  const rotated = (angle + Math.PI) % (Math.PI * 2);
  const offset = (rotated % slice) - slice / 2;
  return Math.cos(slice / 2) / Math.cos(offset);
}

export function nextShapeIndex(current, total) {
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * total);
  }
  return next;
}

export function difficultyStepMagnitude(elapsedSeconds) {
  if (elapsedSeconds < 5) {
    return 0.0;
  }
  if (elapsedSeconds < 18) {
    return 3.4;
  }
  if (elapsedSeconds < 35) {
    return 2.0;
  }
  return 1.3;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function calcLuminance(color) {
  const match = color.match(/\d+/g);
  if (!match) return 0;
  const [r, g, b] = match.map((value) => Number(value) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
