interface Env {
  MCP_BEARER_TOKEN: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
}
type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const SERVER = { name: "fitpulse-godot-animation-studio", version: "0.1.0" };
const TOOLS = [
  { name: "get_project_status", description: "Read repository metadata and recent Actions runs.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_animation_assets", description: "List model, scene, script, and animation files in this repository.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false } },
  { name: "create_animation_task", description: "Create a GitHub issue for an exercise animation task. Does not generate the animation.", inputSchema: { type: "object", properties: { exercise: { type: "string", minLength: 2, maxLength: 100 }, characterPresentation: { type: "string", enum: ["male", "female", "neutral"] }, deliverable: { type: "string", minLength: 2, maxLength: 500 } }, required: ["exercise", "characterPresentation", "deliverable"], additionalProperties: false } },
  { name: "run_godot_validation", description: "Dispatch the GitHub Actions event for headless Godot project validation.", inputSchema: { type: "object", properties: { reason: { type: "string", maxLength: 500 } }, additionalProperties: false } },
  { name: "get_validation_report", description: "Read recent GitHub Actions runs for Godot validation.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false } }
];
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const result = (id: RpcRequest["id"], value: unknown) => response({ jsonrpc: "2.0", id: id ?? null, result: value });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => response({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, 400);
const repository = (env: Env) => `${env.GITHUB_OWNER || "simaklaw"}/${env.GITHUB_REPO || "fitpulse-godot-animation-studio"}`;
function boundedText(value: unknown, field: string, minLength: number, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const clean = value.replace(/[\\u0000-\\u001F\\u007F]/g, " ").replace(/\\s+/g, " ").trim();
  if (clean.length < minLength || clean.length > maxLength) {
    throw new Error(`${field} must contain ${minLength}-${maxLength} characters`);
  }
  return clean;
}
async function github(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret is not configured");
  const res = await fetch("https://api.github.com" + path, {
    ...init,
    headers: { accept: "application/vnd.github+json", authorization: "Bearer " + env.GITHUB_TOKEN, "x-github-api-version": "2022-11-28", "user-agent": "fitpulse-godot-animation-studio", ...(init.body ? { "content-type": "application/json" } : {}) }
  });
  const raw = await res.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${data.message || res.statusText}`);
  return data;
}
async function invoke(name: string, args: Record<string, any>, env: Env): Promise<unknown> {
  const repo = repository(env);
  const branch = env.GITHUB_BRANCH || "main";
  if (name === "get_project_status") {
    const [info, runs] = await Promise.all([github(env, `/repos/${repo}`), github(env, `/repos/${repo}/actions/runs?per_page=5`)]);
    return { repository: info.full_name, defaultBranch: info.default_branch, private: info.private, recentRuns: (runs.workflow_runs || []).map((r: any) => ({ name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url, createdAt: r.created_at })) };
  }
  if (name === "list_animation_assets") {
    const tree = await github(env, `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const assets = (tree.tree || []).filter((f: any) => f.type === "blob" && /\.(glb|gltf|tscn|scn|tres|res|anim|blend|fbx|vrm|gd)$/i.test(f.path) && !/(node_modules|\.git|dist|build|coverage)\//i.test(f.path));
    const limit = Math.min(100, Math.max(1, Number(args.limit || 50)));
    return { truncated: Boolean(tree.truncated), count: assets.length, assets: assets.slice(0, limit).map((f: any) => ({ path: f.path, size: f.size, url: `https://github.com/${repo}/blob/${branch}/${f.path}` })) };
  }
  if (name === "create_animation_task") {
    const exercise = boundedText(args.exercise, "exercise", 2, 100);
    const deliverable = boundedText(args.deliverable, "deliverable", 2, 500);
    const presentation = boundedText(args.characterPresentation, "characterPresentation", 3, 7);
    if (!["male", "female", "neutral"].includes(presentation)) {
      throw new Error("characterPresentation must be male, female, or neutral");
    }
    const issue = await github(env, `/repos/${repo}/issues`, { method: "POST", body: JSON.stringify({ title: `[Animation] ${exercise}`, body: `## Exercise animation task\n\n- Exercise: ${exercise}\n- Character presentation: ${presentation}\n- Deliverable: ${deliverable}\n\n## Acceptance checklist\n- [ ] Validate the scene in Godot headless mode\n- [ ] Record the Godot version and actual test output\n\nCreated via FitPulse Godot MCP. This issue does not mean the animation has already been produced or tested.` }) });
    return { issueNumber: issue.number, title: issue.title, url: issue.html_url };
  }
  if (name === "run_godot_validation") {
    await github(env, `/repos/${repo}/dispatches`, { method: "POST", body: JSON.stringify({ event_type: "fitpulse_godot_validate", client_payload: { reason: String(args.reason || "MCP requested validation").slice(0, 500), requestedAt: new Date().toISOString() } }) });
    return { accepted: true, repository: repo, branch, message: "GitHub accepted the dispatch. Check get_validation_report for the actual result." };
  }
  if (name === "get_validation_report") {
    const limit = Math.min(20, Math.max(1, Number(args.limit || 5)));
    const runs = await github(env, `/repos/${repo}/actions/runs?per_page=${limit}`);
    return (runs.workflow_runs || []).filter((r: any) => /godot/i.test(String(r.name || "") + " " + String(r.path || ""))).map((r: any) => ({ name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url, createdAt: r.created_at }));
  }
  throw new Error("Unknown tool: " + name);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return response({ ok: true, service: SERVER.name, version: SERVER.version });
    if (url.pathname !== "/mcp") return response({ error: "MCP endpoint is /mcp" }, 404);
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
    if (!env.MCP_BEARER_TOKEN || request.headers.get("authorization") !== "Bearer " + env.MCP_BEARER_TOKEN) return response({ error: "Unauthorized" }, 401);
    let body: RpcRequest;
    try { body = await request.json() as RpcRequest; } catch { return rpcError(null, -32700, "Invalid JSON"); }
    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") return rpcError(body.id, -32600, "Invalid JSON-RPC request");
    if (body.method.startsWith("notifications/")) return new Response(null, { status: 202 });
    if (body.method === "initialize") return result(body.id, { protocolVersion: "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: "GitHub-backed FitPulse tools. Do not claim an animation was rendered or an APK tested unless real workflow results confirm it." });
    if (body.method === "ping") return result(body.id, {});
    if (body.method === "tools/list") return result(body.id, { tools: TOOLS });
    if (body.method === "tools/call") {
      const p = (body.params || {}) as Record<string, any>;
      try {
        const value = await invoke(String(p.name || ""), (p.arguments && typeof p.arguments === "object" ? p.arguments : {}) as Record<string, any>, env);
        return result(body.id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], isError: false });
      } catch (e) {
        return result(body.id, { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true });
      }
    }
    return rpcError(body.id, -32601, "Method not found: " + body.method);
  }
};
