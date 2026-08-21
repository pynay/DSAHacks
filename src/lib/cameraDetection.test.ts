import { describe, expect, it } from 'vitest';
import { detectedClassCounts, detectedPeople, personConfidence, type CameraDetectedObject } from './cameraDetection';

const object = (label: string, confidence: number): CameraDetectedObject => ({
  label,
  confidence,
  x: 0,
  y: 0,
  width: 10,
  height: 20,
});

describe('camera detections', () => {
  it('counts the person labels returned by common-object detection', () => {
    const objects = [object('person', 0.91), object('People', 0.82), object('car', 0.74)];
    expect(detectedPeople(objects)).toHaveLength(2);
    expect(personConfidence(objects)).toBe(0.91);
  });

  it('uses a bounded default confidence for a reviewed zero-person frame', () => {
    expect(personConfidence([object('bicycle', 0.7)])).toBe(0.8);
  });

  it('summarizes all detected classes for the operator review', () => {
    expect(detectedClassCounts([object('Car', 0.9), object('person', 0.8), object('car', 0.7)]))
      .toEqual([['car', 2], ['person', 1]]);
  });
});
