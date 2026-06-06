import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const record = body.record;

    if (!record || record.bucket_id !== "acled_raw_csv" || !record.name.endsWith(".csv")) {
      return new Response("skipped", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("app_secrets")
      .select("value")
      .eq("name", "github_pat")
      .single();

    if (error || !data) {
      console.error("Missing github_pat secret:", error);
      return new Response("missing github_pat", { status: 500 });
    }

    const owner = Deno.env.get("GITHUB_OWNER");
    const repo = Deno.env.get("GITHUB_REPO");

    if (!owner || !repo) {
      console.error("Missing GITHUB_OWNER or GITHUB_REPO env vars");
      return new Response("missing env config", { status: 500 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.value}`,
          "Content-Type": "application/json",
          "User-Agent": "acled-webhook/1.0",
        },
        body: JSON.stringify({ event_type: "ingest" }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("GitHub dispatch failed:", res.status, errText);
    }

    return new Response(res.ok ? "dispatched" : "failed", {
      status: res.ok ? 200 : 500,
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response("internal error", { status: 500 });
  }
});
