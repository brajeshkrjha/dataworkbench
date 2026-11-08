import { describe, expect, it } from "vitest";

import { scopeProject, type CollectedEntry } from "@/features/looker/shared/project-collector";

function entries(...paths: string[]): CollectedEntry[] {
  return paths.map((relativePath) => ({
    relativePath,
    file: new File(["content"], relativePath.split("/").pop() ?? relativePath),
  }));
}

const PROJECT_PATHS = [
  "Assortment Scorecard.pbip",
  "Assortment Scorecard.Report/definition.pbir",
  "Assortment Scorecard.Report/definition/report.json",
  "Assortment Scorecard.SemanticModel/definition/model.tmdl",
];

function at(prefix: string): string[] {
  return PROJECT_PATHS.map((path) => `${prefix}${path}`);
}

describe("scopeProject", () => {
  it.each([
    ["at the selection root", ""],
    ["inside one wrapper folder", "sample_pbip/"],
    ["inside nested wrapper folders", "AnyFolder/NestedFolder/"],
  ])("finds the project %s regardless of the wrapper name", (_label, prefix) => {
    const scoped = scopeProject(entries(...at(prefix)));

    expect(scoped.validation.status).toBe("valid");
    expect(scoped.projectName).toBe("Assortment Scorecard");
    expect(scoped.entries.map((entry) => entry.relativePath)).toEqual(PROJECT_PATHS);
  });

  it("ignores unrelated files sitting alongside the project", () => {
    const scoped = scopeProject(entries(...at(""), "notes.txt", "backup/old.pbix"));

    expect(scoped.validation.status).toBe("valid");
    expect(scoped.entries).toHaveLength(PROJECT_PATHS.length);
  });

  it("ignores macOS archive artifacts", () => {
    const scoped = scopeProject(
      entries("__MACOSX/._Assortment Scorecard.pbip", ".DS_Store", ...at(""))
    );

    expect(scoped.validation.status).toBe("valid");
    expect(scoped.projectName).toBe("Assortment Scorecard");
  });

  it("prefers the .pbip that actually resolves over a shallower decoy", () => {
    const scoped = scopeProject(entries("Archived.pbip", ...at("Deep/")));

    expect(scoped.validation.status).toBe("valid");
    expect(scoped.projectName).toBe("Assortment Scorecard");
  });

  it("reports which assets are missing when the project is incomplete", () => {
    const scoped = scopeProject(entries("Sales.pbip", "Sales.Report/report.json"));

    expect(scoped.validation.status).toBe("invalid");
    expect(scoped.validation.hasPbip).toBe(true);
    expect(scoped.validation.hasReportFolder).toBe(true);
    expect(scoped.validation.hasSemanticModelFolder).toBe(false);
  });

  it("reports no .pbip when the selection has none", () => {
    const scoped = scopeProject(entries("readme.txt"));

    expect(scoped.validation.hasPbip).toBe(false);
    expect(scoped.entries).toHaveLength(0);
  });

  it("excludes Power BI Desktop's local model cache from the collected entries", () => {
    const scoped = scopeProject(
      entries(
        ...at(""),
        "Assortment Scorecard.SemanticModel/.pbi/cache.abf",
        "Assortment Scorecard.SemanticModel/.pbi/localSettings.json"
      )
    );

    expect(scoped.validation.status).toBe("valid");
    expect(scoped.validation.hasSemanticModelFolder).toBe(true);
    expect(scoped.entries.map((entry) => entry.relativePath)).toEqual(PROJECT_PATHS);
    expect(scoped.entries.some((entry) => entry.relativePath.includes(".pbi/"))).toBe(false);
  });
});
