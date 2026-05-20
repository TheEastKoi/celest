const BASE = "http://127.0.0.1:8787/v1";

async function main() {
    // 1. Create thread
    const t = await fetch(BASE + "/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "deepseek-v4-flash", mode: "agent",
            workspace: ".", allow_shell: false,
            trust_mode: true, auto_approve: true
        })
    }).then(r => r.json());
    console.log("Thread:", t.id);

    // 2. Start events listener (before sending turn)
    const eventsPromise = fetch(BASE + "/threads/" + t.id + "/events?since_seq=0")
        .then(r => r.text());

    // 3. Send prompt
    const turnResult = await fetch(BASE + "/threads/" + t.id + "/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "say hello in one short sentence" })
    }).then(r => r.json());
    console.log("Turn:", turnResult.id, turnResult.status);

    // Wait for events to accumulate
    await new Promise(r => setTimeout(r, 8000));

    // 4. Parse events
    const eventsText = await eventsPromise;
    console.log("\n=== Raw Events (types + reasoning check) ===");

    const blocks = eventsText.split("\n\n");
    let hasReasoning = false;
    for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split("\n");
        let event = "", data = "";
        for (const l of lines) {
            if (l.startsWith("event:")) event = l.slice(7);
            if (l.startsWith("data:")) data = l.slice(6);
        }
        try {
            const d = JSON.parse(data);
            const kind = d.payload?.kind || d.payload?.item?.kind || "";
            const delta = d.payload?.delta || "";
            const pkeys = Object.keys(d.payload || {}).join(",");
            console.log(`[${d.event}] kind=${kind} delta=${JSON.stringify(delta).slice(0, 60)} keys=[${pkeys}]`);
            if (kind.includes("reason") || kind.includes("think") || kind.includes("agent_thought")) {
                hasReasoning = true;
            }
        } catch (e) { /* skip */ }
    }
    console.log("\nHas reasoning events:", hasReasoning);
}

main().catch(e => console.error(e.message));
