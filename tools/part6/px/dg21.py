"""Write step-through diagrams for the interview case files (ph-21): symptom -> tempting reading / evidence -> cause -> fix."""
import os
OUT = "/home/claude/ai-from-zero-to-hero/data/diagrams"
D = {
"a2102": ("HTTP 400 before any token", "Turn off the limit", "Huge requests fail later", "Error: 50,000 asked,<br/>40,960 allowed", "Client asked more<br/>than the server allows", "Realistic max_tokens<br/>+ check finish reason"),
"a2103": ("Out of memory at 32 users,<br/>cache 5% used", "The laptop is too small", "Buy hardware you do not need", "Startup log: pool took<br/>87% of free memory", "Pool reserved too much;<br/>prefill had no room", "--mem-fraction-static 0.4"),
"a2104": ("Browser works,<br/>harness cannot connect", "Edit the server<br/>in the sandbox", "Edits change nothing", "Binding tcp4 only;<br/>harness dials ::1", "Port published on<br/>IPv4 loopback only", "Publish on both loopbacks"),
"a2105": ("TypeError about None<br/>after enabling tracking", "Remove tracking or<br/>paste an API key", "Lose tracking or leak a key", "Command vs documented flags", "Missing --wandb-group", "Add the flag; keep offline mode"),
"a2106": ("Sandbox stopped<br/>mid-install", "It crashed: rebuild", "Lose the finished work", "Daemon INFO log:<br/>grace period passed", "Stopped on purpose<br/>after last session", "Reattach with sbx run --name"),
"a2107": ("Trainer rejects<br/>attention name triton", "Same word means<br/>same backend", "Chase a match that cannot exist", "Error lists the<br/>trainer's valid names", "Two components,<br/>two vocabularies", "Use a name from<br/>the trainer's list"),
"a2108": ("Replicas take 5+ min;<br/>autoscaler churns", "Tune serving flags", "Seconds saved, minutes left", "Phase timing:<br/>325 s of 330 s is weight copy", "Cold start is<br/>the weight copy", "Keep replicas up;<br/>weights on local NVMe"),
"a2109": ("Every reply ~2 s to start", "The GPU is slow", "Scale hardware for nothing", "Prompt starts with<br/>a new request id", "Changing prefix =<br/>cache miss every time", "Move the id to<br/>metadata or the end"),
"a2110": ("Pods restart during spikes", "Pods are unstable", "Add pods; loop continues", "Liveness probe<br/>generates a token", "Probe waits in the<br/>users' queue and times out", "Cheap liveness;<br/>/ready for readiness"),
"a2111": ("OOM at start<br/>on a shared GPU", "Lower the memory fraction", "Smaller pool, still failing", "Error names 40,960<br/>token max length", "Room reserved for<br/>a request never sent", "--max-model-len 2048"),
"a2112": ("Server never starts:<br/>INTERNAL ASSERT", "Framework bug: file a report", "Wait on a bug that is not one", "First error above the assert:<br/>out of memory in capture", "8192-token prefill graph<br/>does not fit", "Keep chunk 4096"),
"a2113": ("Three refusals in a row", "One broken release", "Downgrade, still failing", "Each error names<br/>a different tool", "Wrong command, wrong driver,<br/>registry not allowed", "Fix each cause separately"),
"a2114": ("Resumed run<br/>starts from zero", "Checkpoints are broken", "Retrain from scratch", "--load points at<br/>an iter_ folder", "No tracker file there;<br/>trainer starts fresh", "Point --load at the parent"),
"a2115": ("2 h, zero steps, killed", "Cluster is slow", "Longer time limit, same hang", "First rollout:<br/>import error in workers", "Reward module not on<br/>the workers' path", "Set PYTHONPATH;<br/>test the import first"),
"a2116": ("Every deploy cuts<br/>streamed answers", "The server crashes on stop", "Debug a crash that is a symptom", "Trace SIGTERM through<br/>the wrapper", "Wrapper signals every process;<br/>scheduler dies first", "Server as main process<br/>with exec"),
"a2117": ("CancelTask retried all night", "Server is stuck", "Restart a healthy server", "GetTask: tasks<br/>already completed", "Retry rule treats a<br/>permanent state as transient", "On error, read the task state"),
"a2118": ("A/B of CUDA graphs:<br/>no difference", "Graphs do not help:<br/>turn them off", "Remove a real speed-up", "Clock 360 MHz,<br/>thermal slowdown", "The test measured heat", "Record clocks;<br/>rerun under equal conditions"),
"a2119": ("Steps six times slower,<br/>reward normal", "Nothing is wrong", "Pay 6x per step", "Engine share 0.02:<br/>pool of 3082 tokens", "Tiny cache forces<br/>many more rounds", "Restore share 0.25 to 0.4"),
"a2120": ("Planner polls an hour,<br/>times out", "Reviewer is slow", "Longer timeouts", "Task state:<br/>input required", "Wait loop knows<br/>only 3 stop states", "Stop on interrupted states;<br/>branch for each"),
"a2121": ("Agent: network is down", "Repair the network", "Fix something not broken", "403 within a second<br/>with an approval message", "Proxy denied a host<br/>not on the allow list", "Scoped allow rule"),
"a2122": ("Pods 6 min to ready", "Disable CUDA graphs", "Save 40 s, slow decode", "Phase timing:<br/>322 s weight load", "Weight load dominates start", "Target the load;<br/>keep graphs"),
"a2123": ("Same tool called 5 times,<br/>run stops", "Raise the repeat limit", "Loop runs longer", "Headless run:<br/>each ask became a rejection", "Tool needs permission;<br/>nobody to answer", "Allow pattern for the tool"),
"a2124": ("4 failed starts after pip", "Driver broken: reimage", "Lose a day, same errors", "Errors name compiler,<br/>headers, linker", "First-start kernel build<br/>needs a full CUDA toolkit", "Use the pinned image"),
"a2125": ("First token 18 s at 64 users", "Buy a second GPU", "Pay for a fix FP8 gives free", "Scheduler: 38 running,<br/>cache 99%, 26 waiting", "Full KV pool, not a slow GPU", "FP8 weights + cache:<br/>pool 5.9x larger"),
"a2126": ("Errors logged as success<br/>or retried forever", "Server is inconsistent", "Special-case each binding", "200 with an error body;<br/>404 with a reason", "Client decodes transport,<br/>not protocol", "One error reader,<br/>classify by reason"),
"a2127": ("Reward dipped 3 times<br/>in 6 steps", "Stop and halve the LR", "Kill a healthy run", "Manual's 10-step<br/>healthy ranges", "Noise on small batches", "Keep the run"),
"a2128": ("Speculation fails at start", "File a bug on the draft", "Block on a non-bug", "Recipe sets an env var<br/>for this pair", "Safety check refuses<br/>2,048 vs 262,144", "Set the variable from the recipe"),
"a2129": ("A key printed in a log", "Rotate the secret", "Churn a key never exposed", "Where does the<br/>real value exist?", "Log shows a placeholder;<br/>proxy injects the real one", "No rotation; keep the design"),
"a2130": ("First token tripled<br/>for a customer", "Cache is unpredictable", "Keep the slowdown", "Benchmark reused<br/>one seed, never flushed", "Policy removed the cache<br/>to fix a method bug", "Restore the cache;<br/>fix the benchmark"),
"a2131": ("Two refusals, two wordings", "The agent is broken", "Weaken a working policy", "Exact refusal text", "One deny rule;<br/>one person declining", "Keep the rule;<br/>delete outside the agent"),
"a2132": ("11 engine restarts,<br/>same failure", "Restart fixes it", "Pay an import each time", "Error category<br/>and retry hint", "Unsupported provider<br/>+ wrong argument", "Classify, then fix the input"),
"a2133": ("240 of 240 succeeded", "The split design works", "Publish a false result", "Responses have<br/>no first token", "Transfer failed;<br/>empties counted as success", "Kit rejects empty successes"),
"a2134": ("FP8 cache passes a check", "Ship to production", "Silent accuracy loss later", "Startup warning:<br/>scale defaults to 1.0", "No calibration scales<br/>in the checkpoint", "Prove scales on the real model"),
"a2135": ("Ray stops the trainer", "False alarm: disable it", "Machine runs out of memory", "Unified memory:<br/>node total includes GPU", "Node really near full", "Smaller model or setting"),
"a2136": ("Deploy delegated<br/>to the wrong agent", "HTTPS made it safe", "Trust a changed card", "Card came via a proxy;<br/>signature never checked", "Card modified in transit", "Verify before planning"),
"a2137": ("Idle hour, 147 MB of 503s", "Engine is busy", "Keep waiting", "First error: backend<br/>assertion at start", "Engine dead, not busy", "Change backend;<br/>watchdog at 10 checks"),
"a2138": ("Suite ran twice,<br/>bill doubled", "Resend to resume", "Repeat the work again", "Stream closed by<br/>the load balancer", "Resend repeats<br/>the command", "Resubscribe by task id"),
"a2139": ("Check flips 3 times in a week", "Agent is random", "Chase model noise", "Relative ref into<br/>a shared store", "Wrong operands compared", "Pinned replays,<br/>fixed references"),
"a2140": ("Agent exits:<br/>database read-only", "Sandbox is broken", "Rebuild a working sandbox", "Manual run inside<br/>the sandbox works", "SQLite cannot lock on<br/>the shared mount", "Move the session store"),
"a2141": ("9 pages, all healthy", "Raise the threshold", "Silent, still meaningless", "Line printed on<br/>every allocation at start", "Mechanism, not symptom", "Alert on health; count the line"),
"a2142": ("Report: function<br/>calls nothing", "Empty callee list proves it", "Unsupported claims later", "Coverage fields<br/>in the response", "Empty can mean unknown", "Cite the assembly<br/>and coverage"),
"a2143": ("12% faster rollout claim", "Make it the default", "Ship noise as a gain", "Paired clean steps,<br/>noise from heat pauses", "Gain inside the noise", "Withdraw; more seeds"),
"a2144": ("First token up to 716 ms<br/>from turn 4", "Change eviction policy", "Still thrashing", "Hit rate by turn", "Working set larger<br/>than the pool", "Grow pool to 16,384;<br/>then test the crash"),
"a2145": ("Faster first token<br/>at 4x load", "Server scales well", "Size on a cache artefact", "Same seed,<br/>cache never flushed", "Later runs hit<br/>earlier prompts", "New seeds, cold cache"),
"a2146": ("One speculation setting<br/>for 3 products", "Random prompts are enough", "Wrong setting for some", "Per-product traffic tests", "Gain depends on the text", "Measure and set per product"),
"a2147": ("Depth 5: fast at 1 user,<br/>flat at 32", "Deeper is always faster", "Lose output under load", "Pool size and clock<br/>at 32 users", "Draft costs memory<br/>and work under load", "Depth 3, clock locked"),
"a2148": ("Scores differ at temperature 0", "Weights changed", "Hunt a model bug", "Same prompt alone<br/>vs in a batch", "Cache, batch and dtype<br/>change the numbers", "Flush; fix batch and dtype"),
"a2149": ("TP refused; DP slow", "Try layouts until one works", "Worse than one card", "Second card hosts<br/>another team's pods", "Shared card: tiny pool,<br/>half the traffic", "One card; ask for a<br/>dedicated second"),
"a2150": ("Streams stall at 64 users", "Cap running requests", "Queue moves, stalls worsen", "Per-user latency<br/>vs total throughput", "Past the knee at 8 to 16 users", "Fewer users per replica"),
"a2151": ("Logprob gap jumped<br/>after engine change", "Engine kernels are wrong", "Debug correct kernels", "Engine flag: logprobs<br/>after top-p", "Different quantities compared", "Return raw logprobs"),
"a2152": ("Two reports disagree", "Engine regressed", "Wrong engine decision", "Different clients<br/>and temperatures", "Two methods, one server", "One method, stated"),
"a2153": ("2/2 evals failed,<br/>cost zero", "The PR regressed", "Block a good change", "No sessions scored", "Containers could not<br/>reach the model", "Pass the gateway; rerun"),
"a2154": ("Engine A has a 502 ms tail", "Migrate to engine B", "Worse tail in production", "All prompts the<br/>same length", "Synchronised waves<br/>in the benchmark", "Rerun with real lengths"),
"a2155": ("Conformance 32%", "Fix 63 checks", "Weeks on tool artefacts", "Failures mapped<br/>to requirements", "URL building and skips;<br/>one real defect", "Fix push routes;<br/>rule on MUSTs"),
"a2156": ("Starts stall silently", "Server leaks or<br/>driver is faulty", "Chase unrelated alerts", "Guard pauses during<br/>pool allocation", "Machine-wide guard paused<br/>the scheduler", "Keep guard; document it"),
"a2157": ("Every run completes up to 16/s", "One card takes 16/s", "Undersized fleet", "First-token time grows<br/>to 94 s", "Queue drained after<br/>arrivals stopped", "Size on steady state"),
"a2158": ("Rebuilt functions<br/>pass 10 tests", "They are equivalent", "Ship different behaviour", "Compare tool compares<br/>decompiler text", "Plausible, not proven equal", "Test behaviour and edge cases"),
"a2159": ("Smoke test stops<br/>before step 0", "Restart the engine", "Guessing a fix", "Two tries, same failure", "Mode fails here;<br/>cause open", "Checkpoint eval<br/>for the long run"),
"a2160": ("3 weeks of no change", "Binary did not change", "Miss a real change", "Job never read<br/>the JSON status", "Exit 0 = command started", "Read status;<br/>unknown is not a pass"),
"a2161": ("3 reboots in a day", "Invent a cause", "A fix that fixes nothing", "No panic, no OOM,<br/>no error line", "Cause not recorded", "Heat guard;<br/>proven by uptime"),
}
q = lambda s: s.replace('"', "'")
for i, (s, t, x, e, c, f) in D.items():
    src = f'''%% after: What actually happened
flowchart TD
  S["{q(s)}"] --> T["Tempting: {q(t)}"]
  T -.->|"wrong turn"| X["{q(x)}"]
  S --> E["Read: {q(e)}"]
  E --> C["Cause: {q(c)}"]
  C --> F["Fix: {q(f)}"]
'''
    open(os.path.join(OUT, i + ".mmd"), "w").write(src)
open(os.path.join(OUT, "a2101.mmd"), "w").write('''%% after: How a loop is put together
flowchart LR
  A["Screen<br/>30 min"] --> B["ML depth<br/>45 min"]
  B --> C["Debugging<br/>45 min"]
  C --> D["System design<br/>60 min"]
  D --> E["Coding<br/>45 min"]
  E --> F["Behavioural<br/>15 min"]
  C -.->|"practised with"| G["60 case files<br/>in this phase"]
''')
print(len(D) + 1)
