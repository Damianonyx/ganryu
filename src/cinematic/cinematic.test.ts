import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextPhase, type IntroPhase } from "./flow.ts";
import {
  INTRO_STATE_KEY,
  parseIntroOverride,
  parseIntroRecord,
  readIntroRecord,
  shouldAutoplayIntro,
  writeIntroRecord,
} from "./intro-state.ts";
import { loadStore, registerTask, settleTask, summarize } from "./readiness.ts";
import { CUES, FILM_DURATION, SCENES, SHOTS } from "./script.ts";
import { cuesAt, shotAt, validateScript } from "./timeline.ts";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe("cinematic script", () => {
  it("is internally consistent", () => {
    assert.deepEqual(validateScript(), []);
  });

  it("runs approximately 75 seconds", () => {
    assert.ok(FILM_DURATION >= 70 && FILM_DURATION <= 80, `duration ${FILM_DURATION}`);
  });

  it("keeps every shot inside its scene", () => {
    for (const s of SHOTS) {
      const scene = SCENES.find((x) => x.id === s.scene);
      assert.ok(scene, `scene for ${s.id}`);
      assert.ok(s.start >= scene.start - 1e-9 && s.end <= scene.end + 1e-9, `shot ${s.id} outside ${scene.id}`);
    }
  });

  it("keeps the confirmed story beats", () => {
    const notes = SHOTS.map((s) => s.note.toLowerCase()).join(" ");
    for (const beat of ["bell", "antagonist", "emblem", "sword", "face", "father", "mother", "dawn", "adult"])
      assert.ok(notes.includes(beat), `missing beat: ${beat}`);
    const speech = CUES.filter((c) => c.track === "speech").map((c) => c.lines.join(" "));
    assert.ok(speech.includes("Burn it."));
    assert.ok(speech.includes("This time, I'll be ready."));
  });

  it("reports overlapping cues and gaps", () => {
    const shots = [
      { ...SHOTS[0], start: 0, end: 2 },
      { ...SHOTS[1], start: 2.5, end: 4 },
    ];
    const cues = [
      { start: 0, end: 2, track: "speech" as const, speaker: "father" as const, lines: ["a"] },
      { start: 1, end: 3, track: "speech" as const, speaker: "mother" as const, lines: ["b"] },
    ];
    const errs = validateScript(shots, cues);
    assert.ok(errs.some((e) => e.includes("gap")));
    assert.ok(errs.some((e) => e.includes("overlap")));
  });

  it("finds the shot and subtitles for a time", () => {
    assert.equal(shotAt(0).shot.id, SHOTS[0].id);
    assert.equal(shotAt(0).fade, 0);
    assert.equal(shotAt(FILM_DURATION + 5).shot.id, SHOTS[SHOTS.length - 1].id);
    const burn = CUES.find((c) => c.lines[0] === "Burn it.")!;
    assert.ok(cuesAt(burn.start + 0.1).includes(burn));
    assert.equal(cuesAt(burn.end + 0.01).includes(burn), false);
  });
});

describe("intro flow", () => {
  const run = (events: Parameters<typeof nextPhase>[1][], from: IntroPhase = "deciding") => events.reduce(nextPhase, from);

  it("first visit plays the film", () => {
    assert.equal(run([{ type: "decide", playFilm: true, ready: false }]), "film");
  });

  it("returning player goes straight to the menu when ready, or waits for loading", () => {
    assert.equal(run([{ type: "decide", playFilm: false, ready: true }]), "done");
    assert.equal(run([{ type: "decide", playFilm: false, ready: false }]), "loading");
    assert.equal(run([{ type: "decide", playFilm: false, ready: false }, { type: "ready" }]), "done");
  });

  it("film ending or skip before loading shows the loading state, then continues", () => {
    const film: IntroPhase = "film";
    assert.equal(nextPhase(film, { type: "film-ended", ready: false }), "loading");
    assert.equal(nextPhase(film, { type: "skip", ready: false }), "loading");
    assert.equal(run([{ type: "skip", ready: false }, { type: "ready" }], film), "done");
  });

  it("loading finishing first does not interrupt the film", () => {
    assert.equal(nextPhase("film", { type: "ready" }), "film");
    assert.equal(nextPhase("film", { type: "continue", ready: true }), "done");
    assert.equal(nextPhase("film", { type: "film-ended", ready: true }), "done");
  });

  it("replay only starts from the menu", () => {
    assert.equal(nextPhase("done", { type: "replay" }), "film");
    assert.equal(nextPhase("loading", { type: "replay" }), "loading");
  });
});

describe("intro state", () => {
  it("stores outcome under its own key and leaves save keys untouched", () => {
    const store = new MemoryStorage();
    const save = JSON.stringify({ fighterId: "kage", maxLevel: 4, currentLevel: 4, wins: 3, losses: 1 });
    store.setItem("ganryu-save-v1", save);
    store.setItem("yonji-save-v1", save);
    writeIntroRecord("skipped", 1, store, new Date("2026-01-01T00:00:00Z"));
    assert.deepEqual(readIntroRecord(store), { outcome: "skipped", version: 1, at: "2026-01-01T00:00:00.000Z" });
    assert.equal(store.getItem("ganryu-save-v1"), save);
    assert.equal(store.getItem("yonji-save-v1"), save);
    assert.deepEqual([...store.data.keys()].sort(), [INTRO_STATE_KEY, "ganryu-save-v1", "yonji-save-v1"].sort());
  });

  it("treats corrupt values as unseen", () => {
    assert.equal(parseIntroRecord("{nope"), null);
    assert.equal(parseIntroRecord(JSON.stringify({ outcome: "watched" })), null);
  });

  it("autoplays on first visit and after a script version bump", () => {
    assert.equal(shouldAutoplayIntro(null, null, 1), true);
    const rec = { outcome: "completed" as const, version: 1, at: "" };
    assert.equal(shouldAutoplayIntro(rec, null, 1), false);
    assert.equal(shouldAutoplayIntro(rec, null, 2), true);
    assert.equal(shouldAutoplayIntro(rec, "force", 1), true);
    assert.equal(shouldAutoplayIntro(null, "suppress", 1), false);
  });

  it("parses the preview override", () => {
    assert.equal(parseIntroOverride("?intro=1"), "force");
    assert.equal(parseIntroOverride("?intro=0&x=1"), "suppress");
    assert.equal(parseIntroOverride(""), null);
  });
});

describe("loading readiness", () => {
  it("is ready only when every task settles; failures still settle", () => {
    loadStore.setState({ tasks: {} });
    assert.equal(summarize(loadStore.getState()).ready, false);
    registerTask("a", "A", 1);
    registerTask("b", "B", 3, false);
    assert.equal(summarize(loadStore.getState()).ready, false);
    settleTask("a", true);
    assert.equal(summarize(loadStore.getState(), "critical").ready, true);
    assert.equal(summarize(loadStore.getState()).ready, false);
    assert.equal(summarize(loadStore.getState()).progress, 0.25);
    settleTask("b", false, "missing file");
    const s = summarize(loadStore.getState());
    assert.equal(s.ready, true);
    assert.equal(s.failed.length, 1);
    settleTask("b", true);
    assert.equal(loadStore.getState().tasks.b.state, "failed", "settled tasks do not change");
  });
});
