import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import JoinCodeBox from "./JoinCodeBox";

describe("JoinCodeBox", () => {
  it("sends a normalized code to the join page", () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<JoinCodeBox />} />
          <Route path="/join/:code" element={<div>joining</div>} />
        </Routes>
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: "Join with code" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Join code"), { target: { value: " ab3k9xyz " } });
    fireEvent.click(button);
    expect(screen.getByText("joining")).toBeTruthy();
  });
});
