export interface CameraDetectedObject {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraDetectionResult {
  objects: CameraDetectedObject[];
  sourceWidth: number;
  sourceHeight: number;
  ms?: number;
}

function normalizedLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function detectedPeople(objects: CameraDetectedObject[]): CameraDetectedObject[] {
  return objects.filter((object) => {
    const label = normalizedLabel(object.label);
    return label === 'person' || label === 'people' || label === 'human';
  });
}

export function personConfidence(objects: CameraDetectedObject[]): number {
  const people = detectedPeople(objects);
  return people.length ? Math.max(...people.map((person) => person.confidence)) : 0.8;
}

export function detectedClassCounts(objects: CameraDetectedObject[]): [string, number][] {
  const counts = objects.reduce<Record<string, number>>((result, object) => {
    const label = normalizedLabel(object.label) || 'object';
    result[label] = (result[label] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
