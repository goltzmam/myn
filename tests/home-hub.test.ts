// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) =>
    React.createElement("a", props, children),
}));
import { Dashboard } from "../components/dashboard";
import { usePreferences } from "../stores/preferences";
beforeEach(() => usePreferences.setState({ language: "en" }));
afterEach(cleanup);
it("Home has a clear entry to Elo and no duplicate conversation composer", () => {
  render(React.createElement(Dashboard, { sessions: [] }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Talk by voice" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Open Elo" }).getAttribute("href"),
  ).toBe("/app/elo");
  expect(
    screen.getByText("Your story starts with the first conversation."),
  ).toBeTruthy();
});
it("saved conversations resume their actual session rather than starting over", () => {
  const session = {
    id: crypto.randomUUID(),
    title: "My saved lesson",
    mode: "guide",
    started_at: "2026-10-25T12:00:00Z",
  };
  render(React.createElement(Dashboard, { sessions: [session] }));
  expect(
    screen.getByRole("link", { name: /My saved lesson/ }).getAttribute("href"),
  ).toBe("/app/elo?session=" + session.id);
  expect(
    screen.getByRole("link", { name: "View all" }).getAttribute("href"),
  ).toBe("/app/settings/history");
  expect(
    screen.queryByText("Your story starts with the first conversation."),
  ).toBeNull();
});
it("visitor and Portuguese navigation keep the same distinct Home responsibility", () => {
  usePreferences.setState({ language: "pt-BR" });
  render(React.createElement(Dashboard, { sessions: [], basePath: "/try" }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Bom ter você de volta.",
  );
  expect(
    screen.getByRole("link", { name: "Entrar no Elo" }).getAttribute("href"),
  ).toBe("/try/elo");
  expect(
    screen
      .getByRole("link", { name: /Uma perspectiva diferente/ })
      .getAttribute("href"),
  ).toBe("/try/agents");
  expect(screen.queryByRole("textbox")).toBeNull();
});
