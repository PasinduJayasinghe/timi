import { describe, expect, it } from "vitest";
import { editedLabel, matchesSearch, notePreview, noteTitle, sortNotes } from "./notes";

describe("noteTitle and notePreview", () => {
  const body = "\n  Questions for Client B  \nRate limits per key?\n\nWho owns the sandbox?";

  it("takes the first non-empty line as the title", () => {
    expect(noteTitle(body)).toBe("Questions for Client B");
    expect(noteTitle("   \n ")).toBe("Untitled note");
  });

  it("joins the rest into one line", () => {
    expect(notePreview(body)).toBe("Rate limits per key? Who owns the sandbox?");
    expect(notePreview("Only a title")).toBe("");
  });
});

describe("matchesSearch", () => {
  it("ignores case and matches everything when empty", () => {
    expect(matchesSearch({ body: "Can webhooks retry?" }, "WEBHOOK")).toBe(true);
    expect(matchesSearch({ body: "Standup notes" }, "webhook")).toBe(false);
    expect(matchesSearch({ body: "anything" }, "  ")).toBe(true);
  });
});

describe("sortNotes", () => {
  it("puts pinned notes first, newest edit first", () => {
    const notes = [
      { id: "a", pinned: false, updatedAt: "2026-10-16T10:00:00.000Z" },
      { id: "b", pinned: true, updatedAt: "2026-10-12T10:00:00.000Z" },
      { id: "c", pinned: false, updatedAt: "2026-10-16T12:00:00.000Z" },
      { id: "d", pinned: true, updatedAt: "2026-10-15T10:00:00.000Z" },
    ];
    expect(sortNotes(notes).map((note) => note.id)).toEqual(["d", "b", "c", "a"]);
  });
});

describe("editedLabel", () => {
  const now = new Date(2026, 9, 16, 23, 0).getTime();

  it("shows the time today, the weekday this week, and the date before", () => {
    expect(editedLabel(new Date(2026, 9, 16, 2, 14).toISOString(), now)).toBe("edited 2:14 am");
    expect(editedLabel(new Date(2026, 9, 15, 22, 40).toISOString(), now)).toBe("edited Thu 10:40 pm");
    expect(editedLabel(new Date(2026, 9, 2, 9, 0).toISOString(), now)).toBe("edited 2 Oct");
  });
});
