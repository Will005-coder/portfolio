export interface Metric {
  value: string;
  label: string;
}

export interface Project {
  slug: string;
  tier: "hero" | "featured" | "more";
  title: string;
  subtitle: string;
  summary: string;
  problem: string;
  constraints: string;
  approach: string;
  iteration: string;
  result: string;
  future_work: string;
  metrics: Metric[];
  tags: string[];
  hero_image: string;
  hero_image_alt: string;
  gallery: Array<{ src: string; alt: string }>;
  video_url: string;
  // Folder support: if isFolder, children are sub-projects.
  // Backend: use parent_id column in the projects table.
  isFolder?: boolean;
  children?: Project[];
}

export interface CtaLink {
  label: string;
  href: string;
  type: "primary" | "secondary";
}

export interface SkillGroup {
  label: string;
  items: string[];
}

// ─── Project Teams ─────────────────────────────────────────────────────────────
// Backend: store in a `teams` Supabase table.
// `relatedProjectSlug` links a team to a project detail entry.

export interface ProjectTeam {
  id: string;
  org: string;
  team: string;
  role: string;
  period: string;
  description: string;
  tags: string[];
  relatedProjectSlug?: string;
  accentColor?: string;
}

export const PORTFOLIO = {
  hero: {
    name: "William Dakare",
    role: "Mechanical Engineering",
    institution: "Boston University",
    year: "BS MechE '29",
    tagline: "Robotics · Compliant mechanisms · Soft robots · Controls",
    credentials: ["QuestBridge Scholar", "Dean's List"],
    cta_links: [
      { label: "Résumé", href: "#", type: "primary" },
      { label: "GitHub", href: "https://github.com", type: "secondary" },
      { label: "LinkedIn", href: "https://linkedin.com", type: "secondary" },
      { label: "Email", href: "mailto:wdakare@bu.edu", type: "secondary" },
    ] as CtaLink[],
  },

  projects: [
    {
      slug: "byu-nsr-reu-compliant-mechanisms",
      tier: "hero",
      title: "Isoperimetric Soft Robot Modeling",
      subtitle: "NSF REU · BYU Compliant Mechanisms & Robotics Research Group",
      summary:
        "Developed analytical and computational models for cable-driven isoperimetric soft robots, building a custom loading rig with 2:1 mechanical advantage and validating FEA predictions against physical experiments.",
      problem:
        "Isoperimetric soft robots, structures that change shape by redistributing internal volume, lack accurate predictive models for cable-driven actuation, limiting their design and control. The REU challenge was to model how edge cables alter robot geometry and to experimentally validate those models.",
      constraints:
        "Six-week timeline. No off-the-shelf loading rig with sufficient resolution existed in the lab. MATLAB integration required numerically stable ODE solvers (Baumgarte stabilization) to avoid drift in constrained-system simulations. Fabrication limited to lab waterjet and standard silicone processes.",
      approach:
        "Derived kinematic and quasi-static force models from first principles; implemented Baumgarte-stabilized constraint equations in MATLAB for stable numerical integration. Designed and waterjet-fabricated a cable-driven loading rig providing 2:1 mechanical advantage to achieve precise, repeatable force application. Ran FEA in parallel to predict deformation fields and cross-validate against the analytical model.",
      iteration:
        "First-pass rig had insufficient cable pulley alignment, producing off-axis loads that skewed results. Redesigned the pulley mount with a single-piece waterjet bracket that constrained all degrees of freedom except the intended pull direction. First MATLAB simulation diverged under large deformations. Switched from a standard Runge Kutta solver to a Baumgarte-stabilized DAE formulation, recovering stable integration out to 30% strain.",
      result:
        "FEA predictions matched experimental force-displacement data within 8% across the tested range. The validated model was handed off to the broader research group as a reusable simulation baseline for future cable-driven isoperimetric designs.",
      future_work:
        "Extend the model to multi-cable configurations; incorporate dynamic (not just quasi-static) loading; explore printable compliant joints to replace waterjet metal parts.",
      metrics: [
        { value: "< 8%", label: "FEA vs. experiment deviation" },
        { value: "2:1", label: "Mechanical advantage, loading rig" },
        { value: "30%", label: "Max strain, stable simulation" },
      ],
      tags: ["MATLAB", "FEA", "Baumgarte Stabilization", "Waterjet", "Compliant Mechanisms", "Soft Robotics"],
      hero_image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&h=700&fit=crop&auto=format",
      hero_image_alt: "Robotic mechanism under laboratory testing",
      gallery: [
        { src: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=500&fit=crop&auto=format", alt: "Loading rig detail" },
        { src: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=500&fit=crop&auto=format", alt: "FEA stress plot" },
      ],
      video_url: "",
    } as Project,

    {
      slug: "bu-bronchoscopy-soft-robot",
      tier: "featured",
      title: "4 mm Bronchoscopy Soft Robot",
      subtitle: "BU Material Robotics Lab",
      summary:
        "Iterated on a 4 mm-diameter silicone soft robot for bronchoscopy applications. DFM-driven redesign of the pneumatic chamber geometry increased maximum bend angle by 350%, enabling the device to navigate sharp bronchial turns.",
      problem:
        "Existing prototypes of the bronchoscopy robot could not achieve the ≥ 90° bend angles required to navigate secondary bronchi. The limiting factor was stress concentration at the chamber wall to base junction, causing premature silicone failure before full actuation.",
      constraints:
        "4 mm outer diameter hard constraint (bronchoscopy channel standard). Silicone injection molding only, no internal supports; all geometry must be self-releasing from the mold. Pressure budget: < 120 kPa to avoid patient injury.",
      approach:
        "Ran parametric FEA sweeps on chamber wall thickness, fillet radius, and chamber aspect ratio. Identified that reducing wall thickness from 0.5 mm to 0.35 mm while adding a 0.15 mm fillet at the base-junction eliminated the stress concentration and allowed uniform strain distribution.",
      iteration:
        "First DFM iteration improved bend angle from 26° to 58° but introduced mold-release failures on thin walls. Added a 2° taper to all vertical walls and revised the parting line, eliminating demolding tears in subsequent pours.",
      result:
        "Final design achieved 91° bend angle at 110 kPa, a 350% increase over the baseline 26°. Device survived 200 actuation cycles without failure in bench testing.",
      future_work:
        "Integrate fiber-optic position sensing; evaluate biocompatible silicone grades; test in cadaveric bronchial models.",
      metrics: [
        { value: "350%", label: "Increase in max bend angle" },
        { value: "91°", label: "Achieved bend angle at 110 kPa" },
        { value: "200×", label: "Actuation cycles without failure" },
      ],
      tags: ["Silicone Injection Molding", "DFM", "FEA", "Soft Robotics", "Medical Devices"],
      hero_image: "https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe?w=800&h=500&fit=crop&auto=format",
      hero_image_alt: "Soft robotic actuator bending under pneumatic pressure",
      gallery: [],
      video_url: "",
    } as Project,

    // ── Folder: Self-Initiated Builds ──────────────────────────────────────────
    // Backend: child projects carry parent_id = "self-initiated-builds".
    // The editor should expose a "Move to folder" control on each project entry.
    {
      slug: "self-initiated-builds",
      tier: "featured",
      isFolder: true,
      title: "Self-Initiated Builds",
      subtitle: "Independent Projects",
      summary:
        "Two independent hardware builds: a vision-language-model-assisted prosthetic gripper and a 4-wheel differential-drive maze solver.",
      problem: "",
      constraints: "",
      approach: "",
      iteration: "",
      result: "",
      future_work: "",
      metrics: [
        { value: "91%", label: "Gripper accuracy" },
        { value: "< 40 s", label: "Maze solve (16×16)" },
      ],
      tags: ["Python", "PyTorch", "Raspberry Pi", "Arduino", "C++", "PID"],
      hero_image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=500&fit=crop&auto=format",
      hero_image_alt: "Robotic gripper holding an object on a workbench",
      gallery: [],
      video_url: "",
      children: [
        {
          slug: "vla-prosthetic-gripper",
          tier: "featured",
          title: "VLA-Assisted Prosthetic Gripper",
          subtitle: "Self-Initiated",
          summary:
            "Fine-tuned MobileVIT on a 200-image dataset of household objects, mapping class to a grip-force table. Runs on a Raspberry Pi 4 under $150 BOM. 91% accuracy on held-out objects; grip-force error < 5%.",
          problem:
            "EMG-controlled grippers require user training and lack adaptive force. A VLA-assisted system removes that burden by inferring grip intent from scene classification.",
          constraints: "< $150 BOM; off-the-shelf servo hardware; inference on a Raspberry Pi 4.",
          approach:
            "Fine-tuned MobileVIT on 200-image custom dataset. Added 'deformable' class after initial failures with bags and soft produce, dropping error from 30% to 9%.",
          iteration: "Added deformable object class; re-trained with augmented data.",
          result: "91% classification accuracy; grip-force error < 5% of target.",
          future_work: "Real-time adaptation via online learning from slip-sensor feedback.",
          metrics: [
            { value: "91%", label: "Classification accuracy" },
            { value: "< $150", label: "BOM" },
            { value: "< 5%", label: "Force error" },
          ],
          tags: ["Python", "PyTorch", "MobileVIT", "Raspberry Pi", "Computer Vision"],
          hero_image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=500&fit=crop&auto=format",
          hero_image_alt: "Robotic gripper holding an object",
          gallery: [],
          video_url: "",
        } as Project,
        {
          slug: "maze-solving-robot",
          tier: "featured",
          title: "Maze-Solving Robot",
          subtitle: "Self-Initiated",
          summary:
            "4-wheel differential-drive maze solver using flood-fill path planning and PID wall-following on an Arduino Nano with three HC-SR04 ultrasonic sensors. Solved a 16×16 maze in under 40 s on first run after calibration.",
          problem: "Build a constrained-hardware maze solver to learn PID and sensor-fusion from scratch.",
          constraints: "Built from scrap acrylic, N20 motors, and an Arduino Nano.",
          approach: "Flood-fill in C; PID wall-following via three HC-SR04 sensors.",
          iteration: "Reduced derivative gain; added 10 ms moving average on sonar.",
          result: "Solved a 16×16 maze in under 40 s on first run after calibration.",
          future_work: "SLAM on a larger platform.",
          metrics: [
            { value: "< 40 s", label: "16×16 solve time" },
          ],
          tags: ["C++", "Arduino", "PID Control", "Sensor Fusion"],
          hero_image: "https://images.unsplash.com/photo-1564865878688-9a244444042a?w=800&h=500&fit=crop&auto=format",
          hero_image_alt: "Small wheeled robot navigating a maze",
          gallery: [],
          video_url: "",
        } as Project,
      ],
    } as Project,
  ] as Project[],

  // ─── Project Teams ─────────────────────────────────────────────────────────
  teams: [
    {
      id: "bu-mars-rover",
      org: "Boston University Robotics Club",
      team: "BU Mars Rover",
      role: "Drivetrain Controls Engineer",
      period: "Fall 2024 to Present",
      description:
        "Implemented PID motor control in C++ with ROS 2 for a six-wheel rocker-bogie drivetrain. Reduced steady-state velocity error from 12% to 1.8% through iterative gain tuning and encoder feedback integration.",
      tags: ["C++", "ROS 2", "PID Control", "Embedded Systems"],
      relatedProjectSlug: "bu-mars-rover",
      accentColor: "#3B5BDB",
    },
    {
      id: "terrier-motorsport",
      org: "Formula SAE",
      team: "Terrier Motorsport",
      role: "Electrical Subteam · AMS / BMS",
      period: "Fall 2024 to Present",
      description:
        "Designed accumulator management and battery management system schematics and PCB layouts in KiCad for a 96 V LFP pack. Passed FSAE EV technical inspection on first submission.",
      tags: ["KiCad", "PCB Design", "BMS", "LFP", "FSAE EV"],
      relatedProjectSlug: "terrier-motorsport-ams-bms",
      accentColor: "#E8362A",
    },
  ] as ProjectTeam[],

  about: {
    bio: "I'm a mechanical engineering student at Boston University interested in the mechanics and control of robots that interact with the physical world: compliant mechanisms, soft actuators, and the embedded systems that drive them. I've had the chance to model isoperimetric soft robots at BYU's NSF REU, iterate on sub-5 mm medical devices at BU's Material Robotics Lab, and build independently from scratch. I'm applying to MS/PhD programs in robotics and looking for industry roles at companies like Figure AI where mechatronics, controls, and fabrication meet. Outside the lab I'm a QuestBridge Scholar and spend time mentoring first-generation college students in STEM.",
  },

  how_think: {
    intro: "To answer some of your questions, here is the short version of how I approach uncertain engineering problems.",
    prompt: "To answer some of your questions, start with the constraint that matters most and test it early.",
    image_url: "",
    image_alt: "",
    questions: [
      { question: "What do you optimize for first?", answer: "I start with the constraint that can actually break the system, then build the smallest test that can expose it early." },
      { question: "How do you handle failure?", answer: "I treat failure as data. I document the condition, isolate the variable, and change one thing at a time before trusting the next result." },
      { question: "What makes a design finished?", answer: "A design is ready when its measured behavior is understood, its tradeoffs are explicit, and another person can reproduce the important test." },
    ],
  },

  skills: {
    groups: [
      { label: "Design & CAD", items: ["SolidWorks", "Fusion 360", "GD&T", "DFM", "Tolerancing"] },
      { label: "Analysis & Simulation", items: ["FEA (ANSYS, SolidWorks Sim)", "MATLAB", "Baumgarte Stabilization", "Kinematic Modeling"] },
      { label: "Controls & Software", items: ["C++", "Python", "ROS 2", "PID Control", "PyTorch", "Raspberry Pi", "Arduino"] },
      { label: "Fabrication", items: ["Waterjet Cutting", "Silicone Injection Molding", "FDM 3D Printing", "Laser Cutting", "Machine Shop"] },
      { label: "Electronics", items: ["KiCad", "PCB Layout", "BMS / AMS Design", "Soldering", "Oscilloscopes"] },
    ] as SkillGroup[],
  },
};
