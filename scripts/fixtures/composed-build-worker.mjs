import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Real loopback HTTP worker, fake provider: never sends a real model request.
 * @template T
 * @param {(api: {base: string, build: (body: unknown) => Promise<{status:string,html:string|null,error:string|null,log:string[],meta:Record<string,unknown>}>, calls:()=>number})=>Promise<T>} run
 */
export async function withComposedWorker(run) {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise(resolve => reservation.close(resolve));
  const worker = spawn(process.execPath, ["--import", "./scripts/fixtures/composed-build-provider.mjs", "workers/visual/server.mjs"], {
    cwd: new URL("../../", import.meta.url),
    env: {PATH:process.env.PATH,PORT:String(port),XAI_API_KEY:"fixture-not-a-secret"},
    stdio:["ignore","pipe","pipe"],
  });
  const exited = once(worker, "exit");
  let output = "";
  worker.stdout.on("data", chunk => { output += chunk; });
  worker.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i=0;i<60;i++) {
      try { if ((await fetch(`${base}/health`, {signal:AbortSignal.timeout(300)})).ok) {ready=true;break;} } catch {}
      await delay(50);
    }
    assert.ok(ready, "worker health");
    return await run({base, calls:()=> (output.match(/COMPOSED_BUILD_PROVIDER_CALL/g)||[]).length, build:async body => {
      const response = await fetch(`${base}/build`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(2000)});
      assert.equal(response.status,202);
      const receipt = await response.json();
      for (let i=0;i<120;i++) {
        const job = await (await fetch(`${base}/jobs/${receipt.id}`,{signal:AbortSignal.timeout(1000)})).json();
        if (job.status !== "run") return job;
        await delay(50);
      }
      throw new Error("Fixture worker did not finish");
    }});
  } finally { worker.kill("SIGTERM"); await exited; }
}
