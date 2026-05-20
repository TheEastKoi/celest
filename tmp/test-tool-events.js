// Quick test: send a prompt that triggers a tool, see raw events
const BASE = "http://127.0.0.1:8787/v1";

async function main() {
    // start server first: deepseek-tui serve --http --port 8787 --insecure
    const t = await fetch(BASE + "/threads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model:"deepseek-v4-flash", mode:"agent", workspace:".", allow_shell:true, trust_mode:true, auto_approve:true })
    }).then(r=>r.json());
    console.log("Thread:", t.id);

    // read events
    const reader = (await fetch(BASE + "/threads/" + t.id + "/events?since_seq=0")).body.getReader();
    const dec = new TextDecoder(); let buf = "";

    // send prompt
    fetch(BASE + "/threads/" + t.id + "/turns", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({prompt:"search web for latest vue.js version"})
    }).then(r=>r.json()).then(r=>console.log("Turn:", r.id));

    const st = Date.now();
    while (Date.now() - st < 30000) {
        const {done,value} = await reader.read();
        if (done) break;
        buf += dec.decode(value, {stream:true});
        const frames = buf.split("\n\n");
        buf = frames.pop() || "";
        for (const f of frames) {
            if (!f.trim()) continue;
            let ev="", da="";
            for (const l of f.split("\n")) {
                if (l.startsWith("event:")) ev=l.slice(7);
                if (l.startsWith("data:")) da=l.slice(6);
            }
            try {
                const d = JSON.parse(da);
                const p = d.payload || {};
                const item = p.item || {};
                const kind = p.kind || item.kind || "";
                const tool = p.tool || {};
                console.log(`[${d.event}] kind=${kind} item.id=${item.id} tool.id=${tool.id||""} tool.name=${tool.name||""} delta="${(p.delta||"").slice(0,60)}" pkeys=[${Object.keys(p).join(",")}]`);
            } catch(e){}
        }
    }
    reader.releaseLock();
    console.log("Done");
}
main().catch(e=>console.error(e));
