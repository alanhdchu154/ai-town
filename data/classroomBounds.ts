export const ClassroomBounds = {
  minX: 6,
  maxX: 15,
  minY: 8,
  maxY: 16,
};

export const ClassroomWalkBounds = {
  minX: ClassroomBounds.minX + 1,
  maxX: ClassroomBounds.maxX - 1,
  minY: ClassroomBounds.minY + 1,
  maxY: ClassroomBounds.maxY - 1,
};

export const ClassroomCenter = {
  x: 10,
  y: 12,
};

export function clampToClassroom(position: { x: number; y: number }) {
  return {
    x: Math.min(
      Math.max(Math.round(position.x), ClassroomWalkBounds.minX),
      ClassroomWalkBounds.maxX,
    ),
    y: Math.min(
      Math.max(Math.round(position.y), ClassroomWalkBounds.minY),
      ClassroomWalkBounds.maxY,
    ),
  };
}

export function isInsideClassroom(position: { x: number; y: number }) {
  return (
    position.x >= ClassroomWalkBounds.minX &&
    position.x <= ClassroomWalkBounds.maxX &&
    position.y >= ClassroomWalkBounds.minY &&
    position.y <= ClassroomWalkBounds.maxY
  );
}

export function randomClassroomTile() {
  return {
    x:
      ClassroomWalkBounds.minX +
      Math.floor(Math.random() * (ClassroomWalkBounds.maxX - ClassroomWalkBounds.minX + 1)),
    y:
      ClassroomWalkBounds.minY +
      Math.floor(Math.random() * (ClassroomWalkBounds.maxY - ClassroomWalkBounds.minY + 1)),
  };
}
