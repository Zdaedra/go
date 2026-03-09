import { Action, Coord } from "../types/lesson";

export type Spotlight =
    | { kind: "polygon"; points: Coord[]; label?: string; dimOpacity: number }
    | { kind: "points"; points: Coord[]; label?: string; dimOpacity: number }
    | { kind: "bbox"; from: Coord; to: Coord; label?: string; dimOpacity: number };

export type OverlayState = {
    highlights: Coord[];
    marks: { at: Coord; shape: "circle" | "square" | "triangle" | "x" }[];
    labels: { at: Coord; text: string }[];
    arrows: { from: Coord; to: Coord; label?: string }[];
    regions: { points: Coord[]; label?: string }[];
    ghostStones: { at: Coord; color: "B" | "W"; num: number }[];
    spotlight: Spotlight | null;
    compareKey: "bad" | "good" | "neutral";
};

export const emptyOverlay = (): OverlayState => ({
    highlights: [],
    marks: [],
    labels: [],
    arrows: [],
    regions: [],
    ghostStones: [],
    spotlight: null,
    compareKey: "neutral",
});

const baseApplyOverlayAction = (state: OverlayState, action: Action): OverlayState => {
    switch (action.type) {
        case "highlight":
            return { ...state, highlights: [...state.highlights, ...(action.stones || [])] };
        case "mark":
            if (action.at && action.shape) {
                return { ...state, marks: [...state.marks, { at: action.at, shape: action.shape }] };
            }
            return state;
        case "label":
            if (action.at && action.text !== undefined) {
                return { ...state, labels: [...state.labels, { at: action.at, text: action.text }] };
            }
            return state;
        case "arrow":
            if (action.from && action.to) {
                return { ...state, arrows: [...state.arrows, { from: action.from, to: action.to, label: action.label }] };
            }
            return state;
        case "region":
            if (action.points) {
                return { ...state, regions: [...state.regions, { points: action.points, label: action.label }] };
            }
            return state;
        case "showBestMove":
            if (action.at) {
                return {
                    ...state,
                    marks: [...state.marks, { at: action.at, shape: "circle" }],
                    highlights: [...state.highlights, action.at]
                };
            }
            return state;
        case "showSequence":
            if (action.moves) {
                // Just for single step overlay representation. If step-by-step is needed, it works via timeouts in player
                const activeColor = action.asColor || "B"; // fallback
                const oppColor = activeColor === "B" ? "W" : "B";
                const newGhosts = action.moves.map((m, i) => ({
                    at: m,
                    color: (i % 2 === 0 ? activeColor : oppColor) as "B" | "W",
                    num: i + 1
                }));
                return { ...state, ghostStones: [...state.ghostStones, ...newGhosts] };
            }
            return state;
        default:
            return state;
    }
};

export function applyOverlayAction(state: OverlayState, action: Action): OverlayState {
    switch (action.type) {
        case "clearOverlays":
            // clearOverlays should clear everything EXCEPT spotlight and compareKey if using simple actions?
            // Wait, let's just clear everything. MomentPlayerCompare will persist spotlight across steps manually if needed
            // Actually, standard usage clears spotlight too unless we do clearOverlays explicitly? 
            // User says `clearSpotlight` exists. So `clearOverlays` clears standard marks/highlights/labels
            return { ...emptyOverlay(), spotlight: state.spotlight, compareKey: state.compareKey };

        case "spotlight": {
            const dimOpacity = action.dimOpacity ?? 0.55;
            if (action.shape === "polygon" && action.points?.length) return { ...state, spotlight: { kind: "polygon", points: action.points, label: action.label, dimOpacity } };
            if (action.shape === "points" && action.points?.length) return { ...state, spotlight: { kind: "points", points: action.points, label: action.label, dimOpacity } };
            if (action.shape === "bbox" && action.bbox) return { ...state, spotlight: { kind: "bbox", from: action.bbox.from, to: action.bbox.to, label: action.label, dimOpacity } };
            return state;
        }

        case "clearSpotlight":
            return { ...state, spotlight: null };

        case "setCompareKey":
            if (action.key) {
                return { ...state, compareKey: action.key };
            }
            return state;

        default:
            return baseApplyOverlayAction(state, action);
    }
}

export type OverlaySnapshot = OverlayState;
export type CompareStore = { bad?: OverlaySnapshot; good?: OverlaySnapshot; neutral?: OverlaySnapshot; };
export function cloneOverlay(o: OverlayState): OverlayState { return JSON.parse(JSON.stringify(o)); }
