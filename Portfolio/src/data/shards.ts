export interface ShardMeta {
  id: number;
  title: string;
  subtitle: string;
  slug: string;
  tag: "ITERATIVE DESIGN" | "EDGE CASE VALIDATION" | "CHARACTERIZED PROTOTYPE";
  figNum: string;
  altText: string;
}

export const SHARDS: ShardMeta[] = [
  {
    id: 0,
    title: "Isoperimetric Soft Robot",
    subtitle: "BYU NSF REU",
    slug: "byu-nsr-reu-compliant-mechanisms",
    tag: "CHARACTERIZED PROTOTYPE",
    figNum: "FIG. 01",
    altText: "Golden-ratio isoperimetric soft robot on test bench, BYU NSF REU",
  },
  {
    id: 1,
    title: "4 mm Bronchoscopy Robot",
    subtitle: "BU Material Robotics Lab",
    slug: "bu-bronchoscopy-soft-robot",
    tag: "ITERATIVE DESIGN",
    figNum: "FIG. 02",
    altText: "4 mm cable-driven bronchoscopy soft robot prototype, Boston University",
  },
  {
    id: 2,
    title: "Lung Path Simulator",
    subtitle: "Onshape · BU",
    slug: "bu-lung-path-simulator",
    tag: "ITERATIVE DESIGN",
    figNum: "FIG. 03",
    altText: "Transparent 3D-printed lung airway path simulator modeled in Onshape",
  },
  {
    id: 3,
    title: "VLA Prosthetic Gripper",
    subtitle: "Compliant Mechanisms",
    slug: "vla-prosthetic-gripper",
    tag: "EDGE CASE VALIDATION",
    figNum: "FIG. 04",
    altText: "VLA-assisted prosthetic gripper with compliant finger mechanisms",
  },
  {
    id: 4,
    title: "Mars Rover Drivetrain",
    subtitle: "BU Mars Rover",
    slug: "bu-mars-rover-drivetrain",
    tag: "EDGE CASE VALIDATION",
    figNum: "FIG. 05",
    altText: "BU Mars Rover rocker-bogie drivetrain controls hardware",
  },
  {
    id: 5,
    title: "Terrier Motorsport AMS/BMS",
    subtitle: "Formula SAE",
    slug: "terrier-motorsport-ams-bms",
    tag: "CHARACTERIZED PROTOTYPE",
    figNum: "FIG. 06",
    altText: "Terrier Motorsport accumulator and battery management system PCBs",
  },
];

// Distinct tinted fills shown as placeholders before images are uploaded.
// Key is shard id.
export const SHARD_PLACEHOLDER_COLORS: Record<number, string> = {
  0: "#1E2E1C",
  1: "#1C2430",
  2: "#201E2C",
  3: "#2C1E1C",
  4: "#1C2A2A",
  5: "#2A2618",
};
