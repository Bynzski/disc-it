// Original recreational routing inspired by a flat Florida city park, not a
// replica of Tocobaga's surveyed holes. Distances follow the intended fairway
// centerline, not the straight tee-to-pin chord. 1 world unit = 3.05 feet.
export const HOLE_DATA = [
  {
    id: 1, name: 'Welcome Oak', par: 3, lengthFeet: 255,
    route: [[-85, 300], [-114, 269], [-125, 229]],
    width: 13, spacing: 17, trees: 1.15,
    note: 'Work left of the oak; open approach to an offset green.',
    blockers: [[-100, 270, 1.9]],
    guardians: [[-117, 224, 1.45], [-132, 222, 1.2]],
  },
  {
    id: 2, name: 'Pine Needle', par: 3, lengthFeet: 293,
    route: [[-132, 213], [-134, 167], [-137, 117]],
    width: 6.5, spacing: 5.5, trees: 1.05,
    note: 'Stay beneath the branches. Long narrow tunnel, open center.',
    guardians: [[-145, 112, 1.4], [-129, 111, 1.2]],
  },
  {
    id: 3, name: 'The Elbow', par: 4, lengthFeet: 470,
    route: [[-140, 100], [-155, 27], [-88, -16]],
    width: 10, spacing: 8, trees: 1.4,
    note: 'Place the drive in the left clearing, then turn right to the pin.',
    groves: [[[-135, 79], [-99, 6], [-128, 3], [-142, 47]]],
    guardians: [[-80, -13, 1.6], [-90, -24, 1.35]],
  },
  {
    id: 4, name: 'Long Meadow', par: 4, lengthFeet: 615,
    route: [[-76, -28], [-78, -102], [0, -147], [30, -170]],
    alternate: [[-76, -28], [-41, -89], [0, -147]],
    width: 22, spacing: 25, trees: 1.6,
    note: 'Left placement lane or aggressive right drive. Guarded far green.',
    blockers: [[-62, -62, 2.1], [-45, -101, 1.9], [-18, -125, 1.7], [16, -154, 1.6]],
    guardians: [[23, -173, 1.5], [37, -172, 1.8], [33, -180, 1.3]],
  },
  {
    id: 5, name: 'Thread the Needle', par: 3, lengthFeet: 205,
    route: [[43, -162], [68, -154], [104, -136]],
    width: 7, spacing: 8, trees: 0.85,
    note: 'Controlled low midrange or putter. Slip through the entrance gap.',
    blockers: [[57, -163, 1.25], [55, -151, 1.25], [94, -144, 1.1]],
    guardians: [[108, -144, 1.5], [109, -129, 1.3], [98, -129, 1.15]],
  },
  {
    id: 6, name: 'Split Decision', par: 3, lengthFeet: 322,
    route: [[119, -126], [150, -99], [168, -70], [158, -40]],
    alternate: [[119, -126], [129, -76], [158, -40]],
    width: 10, spacing: 11, trees: 1.25,
    note: 'Wide right sweep, or tighter left turnover. No straight shortcut.',
    blockers: [[138, -84, 2.7]],
    groves: [[[133, -101], [145, -96], [155, -74], [143, -67], [134, -79]]],
    guardians: [[151, -33, 1.5], [165, -34, 1.3]],
  },
  {
    id: 7, name: 'Cypress Carry', par: 4, lengthFeet: 438,
    route: [[164, -22], [190, 38], [173, 77], [143, 91]],
    alternate: [[164, -22], [143, 49], [143, 91]],
    width: 11, spacing: 12, trees: 1.3,
    note: 'Dry route right; carry left for a shorter approach. Water: +1, rethrow.',
    guardians: [[136, 85, 1.65], [150, 98, 1.4], [135, 98, 1.25]],
  },
  {
    id: 8, name: 'Three Windows', par: 4, lengthFeet: 486,
    route: [[129, 100], [99, 145], [140, 187], [117, 227]],
    alternate: [[129, 100], [146, 143], [140, 187]],
    width: 9, spacing: 7, trees: 1.2,
    note: 'Choose a window into the clearing. Placement opens the final turn.',
    groves: [[[120, 123], [130, 123], [137, 155], [123, 158], [115, 144]], [[113, 180], [123, 174], [127, 201], [119, 211], [109, 197]]],
    guardians: [[109, 228, 1.5], [124, 233, 1.4]],
  },
  {
    id: 9, name: 'Founders Green', par: 4, lengthFeet: 602,
    route: [[101, 240], [55, 281], [-10, 297], [-74, 286]],
    alternate: [[101, 240], [22, 271], [-74, 286]],
    width: 16, spacing: 16, trees: 1.65,
    note: 'Carry the pond or stay north. Water: +1, rethrow. Finish at the arch.',
    groves: [[[15, 276], [-17, 279], [-23, 265], [6, 257]]],
    blockers: [[65, 260, 1.8], [-48, 280, 1.7]],
    guardians: [[-80, 279, 1.8], [-79, 294, 1.8]],
  },
];

export const COURSE_BOUNDS = { minX: -205, maxX: 225, minZ: -210, maxZ: 335 };
export const WATER = [
  { x: 151, z: 22, radius: 21, holes: [7] },
  { x: 54, z: 246, radius: 18, holes: [9] },
];

export function distanceToSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

export function inPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i], [bx, bz] = points[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
