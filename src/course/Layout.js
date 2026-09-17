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

// Back nine: an inner loop from the plaza, down the west interior, around
// the meadow, and home beside the picnic commons. Front-nine data stays above.
const BACK_NINE = [
  {
    id: 10, name: 'Plaza Passage', par: 3,
    route: [[-43, 259], [-44, 230], [-33, 171]],
    width: 8, spacing: 11, trees: 1.05,
    note: 'Leave the plaza along the parking edge. Keep the disc low past the picnic area.',
    guardians: [[-25, 169, 1.25], [-40, 163, 1.1]],
    previewPath: [[-43, 4.5, 263], [-44, 5, 248], [-44, 5.5, 230], [-39, 5.2, 202], [-35, 3.8, 183]],
  },
  {
    id: 11, name: 'Pine Hook', par: 4,
    route: [[-43, 155], [-81, 120], [-78, 65]],
    width: 8, spacing: 9, trees: 1.1,
    note: 'Shape left into the pine clearing. A placed drive opens the second lane.',
    groves: [[[-54, 130], [-62, 100], [-55, 87], [-42, 124]]],
    guardians: [[-86, 62, 1.3], [-71, 59, 1.25]],
    previewPath: [[-40, 4.5, 159], [-61, 5.5, 138], [-81, 5.8, 120], [-80, 5, 94], [-79, 3.8, 77]],
  },
  {
    id: 12, name: 'Palmetto Elbow', par: 4,
    route: [[-79, 48], [-62, -7], [-20, -27]],
    width: 8, spacing: 10, trees: 1.1,
    note: 'Turn right through the clearing. Palmetto rough discourages cutting the corner.',
    groves: [[[-57, 19], [-39, 0], [-32, 2], [-45, 29]]],
    guardians: [[-13, -21, 1.2], [-20, -36, 1.15]],
    previewPath: [[-80, 4.5, 52], [-70, 5.5, 23], [-62, 5.8, -7], [-42, 5, -18], [-31, 3.8, -22]],
  },
  {
    id: 13, name: 'Meadow Bend', par: 4,
    route: [[-5, -37], [52, -61], [78, -111]],
    width: 12, spacing: 20, trees: 1.45,
    note: 'Open drive beside the picnic grove. Land at the bend for a protected approach.',
    blockers: [[50, -81, 1.6]],
    guardians: [[70, -115, 1.3], [86, -115, 1.4]],
    previewPath: [[-9, 4.8, -35], [22, 6, -49], [52, 6, -61], [65, 5, -87], [72, 3.8, -100]],
  },
  {
    id: 14, name: 'Sawgrass Window', par: 3,
    route: [[94, -107], [94, -51], [102, -4]],
    width: 7, spacing: 8, trees: .95,
    note: 'A long low-ceiling window. Controlled height beats a full-power sky shot.',
    guardians: [[109, -3, 1.25], [97, 4, 1.15]],
    previewPath: [[94, 4.2, -111], [94, 5, -83], [94, 5, -51], [98, 4.5, -27], [100, 3.8, -16]],
  },
  {
    id: 15, name: 'Cypress Choice', par: 4,
    route: [[84, 2], [62, 68], [67, 151]],
    alternate: [[84, 2], [76, 22], [78, 58], [91, 85], [67, 151]],
    width: 8, spacing: 12, trees: 1.2,
    note: 'Left is the wider landing lane; right rewards a shaped drive beside the overlook. No forced water carry.',
    groves: [[[75, 43], [83, 47], [83, 94], [75, 107], [72, 84]]],
    guardians: [[59, 150, 1.25], [73, 157, 1.2]],
    previewPath: [[85, 4.5, -2], [73, 5.8, 35], [62, 6, 68], [64, 5.5, 108], [66, 3.8, 139]],
  },
  {
    id: 16, name: 'Picnic Fade', par: 3,
    route: [[67, 170], [60, 207], [35, 232]],
    width: 8, spacing: 12, trees: 1.1,
    note: 'A left-finishing line to a tucked pin. Avoid fading early into the inside grove.',
    blockers: [[47, 205, 1.6]],
    guardians: [[39, 240, 1.1], [27, 233, 1.2]],
    previewPath: [[68, 4.5, 166], [64, 5.5, 189], [60, 5.8, 207], [51, 4.8, 216], [44, 3.8, 224]],
  },
  {
    id: 17, name: 'Needle Palm', par: 3,
    route: [[5, 209], [-3, 160], [-10, 96]],
    width: 7, spacing: 9, trees: .95,
    note: 'Place a flat drive between palmetto banks, then thread the second window to the pin.',
    guardians: [[-17, 93, 1.1], [-3, 89, 1.2]],
    previewPath: [[6, 4.2, 213], [2, 5, 188], [-3, 5, 160], [-7, 4.3, 126], [-8, 3.8, 108]],
  },
  {
    id: 18, name: 'Commons Home', par: 4,
    route: [[-7, 77], [25, 108], [38, 161], [28, 197], [4, 244]],
    width: 8, spacing: 14, trees: 1.3,
    note: 'Three landing windows lead home to the commons. Place the opening drive, then commit down the final lane.',
    blockers: [[21, 139, 1.5]],
    guardians: [[-4, 245, 1.3], [10, 251, 1.25]],
    previewPath: [[-10, 4.8, 74], [9, 5.7, 92], [25, 6, 108], [38, 6, 161], [28, 5.6, 197], [15, 4.7, 222], [9, 3.8, 233]],
  },
];
for (const data of BACK_NINE) {
  data.lengthFeet = Math.round(data.route.slice(1).reduce((sum, b, i) =>
    sum + Math.hypot(b[0] - data.route[i][0], b[1] - data.route[i][1]), 0) * 3.05);
  HOLE_DATA.push(data);
}

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
