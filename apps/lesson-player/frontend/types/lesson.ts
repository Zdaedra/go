export type Color = "B" | "W";
export type Coord = string;

export type Action =
  | { type: "jump"; move: number }
  | { type: "rewind"; move: number }
  | { type: "forward"; move: number }
  | { type: "clearOverlays" }
  | { type: "highlight"; stones: Coord[] }
  | { type: "mark"; at: Coord; shape: "circle" | "square" | "triangle" | "x" }
  | { type: "label"; text: string; at: Coord }
  | { type: "arrow"; from: Coord; to: Coord; label?: string }
  | { type: "region"; points: Coord[]; label?: string }
  | { type: "showBestMove"; at: Coord }
  | {
      type: "showSequence";
      moves: Coord[];
      mode: "ghost" | "step";
      speedSecPerMove?: number;
      asColor?: Color;
    }
  | {
      type: "spotlight";
      shape: "polygon" | "points" | "bbox";
      points?: Coord[];
      bbox?: { from: Coord; to: Coord };
      label?: string;
      dimOpacity?: number;
    }
  | { type: "clearSpotlight" }
  | { type: "setCompareKey"; key: "bad" | "good" | "neutral" };

export type Step = {
  id: string;
  say: string;
  audio: { url: string; durationSec?: number };
  actions: Action[];
  mode?: "stopframe" | "candidates" | "yourmove" | "demo_bad" | "demo_good" | "consequence" | "takeaway";
  overlayPresetKey?: "bad" | "good" | "neutral";
};

export type MomentDetail = {
  moment_id: string;
  type: "mistake" | "strong";
  move_number: number;
  player: "B" | "W";
  title: string;
  impact: number;
  preview: string;
  jumpMove: number;
  teachingGoal: string;
  teachingPackSummary: any;
  steps: Step[];
};

export type LessonData = {
  meta: any;
  moments: MomentDetail[];
};

export type MomentDetailWithMeta = {
  meta: any;
  moment: MomentDetail;
};
