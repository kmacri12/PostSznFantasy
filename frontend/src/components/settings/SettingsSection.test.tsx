import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SETTING_FIELD_HELP } from "../../content/rules";
import { ROSTER_GROUPS } from "../../settings/rosterGroups";
import { SCORING_GROUPS } from "../../settings/scoringGroups";
import type { SettingGroup, SettingsValues } from "../../settings/types";
import SettingsSection from "./SettingsSection";

const group: SettingGroup = {
  id: "rushing",
  title: "Rushing",
  fields: [
    { key: "scoring_rushing_yard", label: "Yard" },
    { key: "scoring_rushing_attempt", label: "Attempt" },
  ],
};
const defaults = { scoring_rushing_yard: 0.1, scoring_rushing_attempt: 0 };

const Harness = ({ initial }: { initial: SettingsValues }) => {
  const [values, setValues] = useState(initial);
  return (
    <SettingsSection
      group={group}
      values={values}
      defaultExpanded
      defaults={defaults}
      errors={
        values.scoring_rushing_attempt === "" ? { scoring_rushing_attempt: "Enter a number" } : {}
      }
      onChange={(key, raw) => setValues((previous) => ({ ...previous, [key]: raw }))}
    />
  );
};

const attempt = () => screen.getByLabelText("Attempt") as HTMLInputElement;

describe("SettingsSection rows", () => {
  it("empties a field on tap so typing starts fresh", () => {
    render(<Harness initial={defaults} />);
    fireEvent.focus(attempt());
    expect(attempt().value).toBe("");
    fireEvent.change(attempt(), { target: { value: "1" } });
    fireEvent.blur(attempt());
    expect(attempt().value).toBe("1");
  });

  it("puts the old value back, with no error, when the field is left blank", () => {
    render(<Harness initial={defaults} />);
    fireEvent.focus(attempt());
    fireEvent.blur(attempt());
    expect(attempt().value).toBe("0");
    expect(screen.queryByText("Enter a number")).toBeNull();
  });

  it("offers a reset only on a row that differs from its default", () => {
    render(<Harness initial={{ ...defaults, scoring_rushing_attempt: 0.5 }} />);
    expect(screen.queryByRole("button", { name: "Reset Yard to default" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset Attempt to default" }));
    expect(attempt().value).toBe("0");
    expect(screen.queryByRole("button", { name: "Reset Attempt to default" })).toBeNull();
  });

  it("explains every roster and scoring setting in its help", () => {
    const keys = [...ROSTER_GROUPS, ...SCORING_GROUPS].flatMap((g) => g.fields.map((f) => f.key));
    expect(keys.filter((key) => !SETTING_FIELD_HELP[key])).toEqual([]);
  });

  it("puts return TDs, return yards and blocked kicks under Special teams in one DST group", () => {
    const dst = SCORING_GROUPS.find((g) => g.id === "defense");
    expect(dst?.title).toBe("Defense / Special Teams");
    const start = dst?.fields.findIndex((field) => field.subheading === "Special teams") ?? -1;
    expect(dst?.fields.slice(start).map((field) => field.label)).toEqual([
      "Kick Return TD",
      "Punt Return TD",
      "Blocked Kick",
      "Kick Return Yard",
      "Punt Return Yard",
    ]);
  });
});
