import { describe, expect, it } from "vitest";
import { displayMeta, displayTitle, isValidTicketNumber, patchForTypeChange } from "./taskDisplay";

const base = { title: "Fix payment step", ticketNumber: null, clientName: null, projectName: null };

describe("displayTitle", () => {
  it("prefixes support tickets with the ticket number", () => {
    expect(displayTitle({ ...base, type: "support", title: "Login loop on Safari", ticketNumber: "4821" })).toBe(
      "#4821 Login loop on Safari",
    );
  });

  it("leaves other types alone", () => {
    expect(displayTitle({ ...base, type: "client", ticketNumber: "4821" })).toBe("Fix payment step");
  });
});

describe("displayMeta", () => {
  it("joins client and project for client work", () => {
    expect(displayMeta({ ...base, type: "client", clientName: "Client A", projectName: "Storefront" })).toBe(
      "Client A · Storefront",
    );
  });

  it("shows the project for internal work and ignores a stray client", () => {
    expect(displayMeta({ ...base, type: "internal", clientName: "Client A", projectName: "SLE Hub" })).toBe("SLE Hub");
  });

  it("shows the client for tickets and meetings", () => {
    expect(displayMeta({ ...base, type: "support", clientName: "Client C" })).toBe("Client C");
    expect(displayMeta({ ...base, type: "meeting", clientName: "Client A" })).toBe("Client A");
  });

  it("falls back to the type label", () => {
    expect(displayMeta({ ...base, type: "other" })).toBe("Other");
    expect(displayMeta({ ...base, type: "client" })).toBe("Client project");
  });
});

describe("patchForTypeChange", () => {
  const task = { clientId: "c1", projectId: "p1", ticketNumber: "4821" };

  it("keeps the client where the new type uses one", () => {
    expect(patchForTypeChange(task, "meeting")).toEqual({
      type: "meeting",
      clientId: "c1",
      projectId: null,
      ticketNumber: null,
    });
  });

  it("clears everything for Other", () => {
    expect(patchForTypeChange(task, "other")).toEqual({ type: "other", clientId: null, projectId: null, ticketNumber: null });
  });

  it("keeps the ticket number for support", () => {
    expect(patchForTypeChange(task, "support").ticketNumber).toBe("4821");
  });
});

describe("isValidTicketNumber", () => {
  it("accepts digits only", () => {
    expect(isValidTicketNumber("4821")).toBe(true);
    expect(isValidTicketNumber("48A0")).toBe(false);
    expect(isValidTicketNumber("")).toBe(false);
  });
});
