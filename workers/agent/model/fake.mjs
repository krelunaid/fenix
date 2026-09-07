// Scripted model for tests: each call pops the next step. A step is either a
// list of tool calls `{ tool, input }` or a plain text `{ text }`. Optionally a
// function `(req) => step` for assertions on what the agent sent.
export class FakeModel {
  constructor(steps = []) {
    this.steps = [...steps];
    this.calls = [];
    this.model = "fake";
    this.counter = 0;
  }

  async complete(req) {
    this.calls.push(req);
    let step = this.steps.shift();
    if (typeof step === "function") step = step(req);
    if (!step) step = { text: "Non ho altro da fare." };
    const usage = { input_tokens: 1000, output_tokens: 100 };
    if (step.text !== undefined) {
      return { content: [{ type: "text", text: step.text }], stop_reason: "end_turn", usage };
    }
    const calls = Array.isArray(step) ? step : step.calls;
    const content = [];
    if (step.thought) content.push({ type: "text", text: step.thought });
    for (const c of calls) {
      this.counter += 1;
      content.push({ type: "tool_use", id: `toolu_${this.counter}`, name: c.tool, input: c.input ?? {} });
    }
    return { content, stop_reason: "tool_use", usage };
  }
}
