import { presetPoints } from "../../src/core/scoring.js";

const bands = [
  { min: 32, max: 40, label: "Confidence strength", text: "A solid foundation. Focus on sustaining and stretching it.", tone: "positive" },
  { min: 20, max: 31, label: "Emerging area", text: "Real capability, with room to grow.", tone: "neutral" },
  { min: 8, max: 19, label: "Growth edge", text: "This area is asking for your attention.", tone: "attention" },
];

function area(id, areaLabel, statements, extra = {}) {
  return {
    id, type: "scale", label: `${areaLabel} Confidence`, areaLabel,
    scoreLabel: `${areaLabel} Confidence Score`, points: presetPoints("1-5"), statements, bands, ...extra,
  };
}

const eight = (prefix) => Array.from({ length: 8 }, (_, i) => `${prefix} ${i + 1}`);

/** The structure of "The Career Confidence Assessment Workbook" (Parts 1–5). */
export const careerConfidence = {
  id: "career-confidence",
  title: "Career Confidence Assessment",
  worksheets: [
    {
      id: "ws1", title: "Assessment",
      sections: [
        { id: "part-1", title: "Part 1: The Assessment", columns: 1, fields: [
          area("communication", "Communication", eight("Comm")),
          area("decision", "Decision-Making", eight("Dec")),
          area("adapt", "Adaptability", eight("Adapt")),
          area("advocacy", "Self-Advocacy", eight("Adv")),
        ] },
        { id: "part-2", title: "Part 2: Your Confidence Profile", columns: 1, fields: [
          { id: "profile", type: "scoreboard", label: "Your Confidence Profile", mode: "auto", showBandKey: true,
            rows: ["communication", "decision", "adapt", "advocacy"].map((source) => ({ source })),
            totalBands: [{ min: 128, max: 160, label: "High overall confidence", tone: "positive" }, { min: 32, max: 127, label: "Room to grow", tone: "neutral" }] },
        ] },
        { id: "part-3", title: "Part 3: Reflection", columns: 1, fields: [
          { id: "why-low", type: "long-text", label: "Why is my lowest area low?" },
          { id: "prompt", type: "scored-text", label: "AI Prompt", copyButton: true,
            template: "Communication: {{communication.score}}/40\nStrongest: {{profile.strongest}}\nLowest: {{profile.lowest}} because {{why-low}}" },
        ] },
      ],
    },
  ],
};
