import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import type { MatchRaw } from "../types/worldcup";
import ChampionMoment from "./ChampionMoment";

const final: MatchRaw = {
  id: 20260719,
  utcDate: "2026-07-19T20:00:00Z",
  status: "FINISHED",
  matchday: null,
  stage: "FINAL",
  group: null,
  homeTeam: { id: 760, name: "Spain" },
  awayTeam: { id: 773, name: "France" },
  score: { winner: "HOME_TEAM", fullTime: { home: 2, away: 1 } },
  goals: [
    {
      minute: 11,
      type: "OWN_GOAL",
      team: { id: 760, name: "Spain" },
      scorer: { id: 999001, name: "Nico Williams" },
    },
    {
      minute: 63,
      type: "REGULAR",
      team: { id: 760, name: "Spain" },
      scorer: { id: 999002, name: "Lamine Yamal" },
    },
    {
      minute: 79,
      type: "REGULAR",
      team: { id: 773, name: "France" },
      scorer: { id: 999003, name: "Kylian Mbappé" },
    },
  ],
};

document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") === "light"
  ? "light"
  : "dark";

globalThis.fetch = (async () => new Response(JSON.stringify({ photos: [] }), {
  headers: { "Content-Type": "application/json" },
})) as typeof fetch;

createRoot(document.getElementById("root")!).render(createElement(ChampionMoment, { matches: [final] }));

requestAnimationFrame(() => requestAnimationFrame(() => {
  const scorer = [...document.querySelectorAll("span")]
    .find((element) => element.textContent?.includes("Nico Williams（乌龙）"));
  const ownGoal = [...document.querySelectorAll("span")]
    .find((element) => element.textContent === "（乌龙）");
  const scoreGrid = scorer?.closest(".grid");
  const scoreCard = scoreGrid?.parentElement;
  const hero = document.querySelector("section");
  if (!scorer || !ownGoal || !scoreCard || !hero) throw new Error("Champion score fixture did not render");

  const scorerRect = scorer.getBoundingClientRect();
  const scoreRect = scoreCard.getBoundingClientRect();
  const heroRect = hero.getBoundingClientRect();
  const ownGoalStyle = getComputedStyle(ownGoal);
  const output = {
    theme: document.documentElement.dataset.theme,
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    scorerText: scorer.textContent,
    scorer: { left: scorerRect.left, right: scorerRect.right },
    score: { left: scoreRect.left, right: scoreRect.right },
    hero: { left: heroRect.left, right: heroRect.right },
    ownGoalColor: ownGoalStyle.color,
    ownGoalFontSize: ownGoalStyle.fontSize,
  };
  document.getElementById("probe-output")!.textContent = JSON.stringify(output);
}));
