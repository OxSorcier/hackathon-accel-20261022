import { describe, expect, it, vi } from "vitest";
import { createResearchCommands } from "../../src/ui/research-commands";
import { projectWorkspace } from "../../src/ui/api";
import { UiError } from "../../src/ui/types";
import { uiContractFixture } from "./fixtures";

function run(): ReturnType<typeof projectWorkspace>["runs"][number] {
  const fixture = uiContractFixture(); return projectWorkspace(fixture.company, fixture.decisions).runs[0]!;
}

describe("app-scoped research operation recovery", () => {
  it("joins a pending request when another panel instance resumes the same intent", async () => {
    const commands = createResearchCommands(); let finish: ((value: ReturnType<typeof run>) => void) | undefined;
    const send = vi.fn(async (_key: string) => await new Promise<ReturnType<typeof run>>(resolve => { finish = resolve; }));
    const firstPanel = commands.execute("company/actor/profile/live/question", send);
    const reopenedPanel = commands.execute("company/actor/profile/live/question", send);
    expect(send).toHaveBeenCalledTimes(1); finish!(run());
    expect(await reopenedPanel).toEqual(await firstPanel);
  });
  it("reuses the uncertain operation key after navigation and a manual retry", async () => {
    const commands = createResearchCommands(); const keys: string[] = [];
    await expect(commands.execute("same-intent", async key => { keys.push(key); throw new UiError("NETWORK_ERROR", "Lost response", true); })).rejects.toMatchObject({ uncertain: true });
    await commands.execute("same-intent", async key => { keys.push(key); return run(); });
    expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
    await commands.execute("same-intent", async key => { keys.push(key); return run(); });
    expect(keys[2]).not.toBe(keys[1]);
  });
  it("keeps different actors, companies and namespaces separate", async () => {
    const commands = createResearchCommands(); const keys = new Set<string>();
    for (const scope of ["company1/actor1/live", "company2/actor1/live", "company1/actor2/live", "company1/actor1/controlled"]) {
      await expect(commands.execute(scope, async key => { keys.add(key); throw new UiError("NETWORK_ERROR", "Lost response", true); })).rejects.toMatchObject({ uncertain: true });
    }
    expect(keys.size).toBe(4);
  });
});
