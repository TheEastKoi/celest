const BASE = "http://127.0.0.1:8787/v1";

async function main() {
    const t = await fetch(BASE + "/threads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek-v4-flash", mode: "agent", workspace: ".", allow_shell: false, trust_mode: true, auto_approve: true })
    }).then(r => r.json());
    console.log("Thread:", t.id);

    const eventsResp = await fetch(BASE + "/threads/" + t.id + "/events?since_seq=0");
    const reader = eventsResp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", count = 0, hasReasoning = false;
    const start = Date.now();

    // Send prompt
    fetch(BASE + "/threads/" + t.id + "/turns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "just say hello" })
    }).then(r => r.json()).then(r => console.log("Turn:", r.id));

    // Read events stream (max 15s)
    while (Date.now() - start < 15000) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Process complete SSE frames
        const frames = buf.split("\n\n");
        buf = frames.pop() || "";
        for (const f of frames) {
            if (!f.trim()) continue;
            let evt = "", dat = "";
            for (const l of f.split("\n")) {
                if (l.startsWith("event:")) evt = l.slice(7);
                if (l.startsWith("data:")) dat = l.slice(6);
            }
            try {
                const d = JSON.parse(dat);
                const kind = d.payload?.kind || d.payload?.item?.kind || "";
                count++;
                if (count <= 20) {
                    console.log(`[${d.event}] kind=${kind} delta=${JSON.stringify(d.payload?.delta||"").slice(0,40)}`);
                }
                if (kind.includes("reasoning")) hasReasoning = true;
            } catch (e) { }
        }
    }
    reader.releaseLock();
    console.log("Total events:", count, " | Has reasoning:", hasReasoning);
}

main().catch(e => console.error(e));
