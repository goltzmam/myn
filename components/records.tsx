"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePreferences } from "@/stores/preferences";
import { browserDb } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  Plus,
  Download,
  Trash2,
  Search,
  Code2,
  MessageCircle,
  Shapes,
} from "lucide-react";
type Row = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  mode?: string;
  started_at?: string;
  owner_id?: string;
  instructions?: string;
  specialty?: string;
  language?: string;
};
export function Records({
  kind,
  id,
}: {
  kind: "agents" | "history";
  id?: string;
}) {
  const RecordIcon = kind === "history" ? MessageCircle : Shapes;
  const Heading = kind === "history" ? "h2" : "h1";
  const pt = usePreferences((s) => s.language) === "pt-BR";
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [messages, setMessages] = useState<
      { role: string; content: string; created_at?: string }[]
    >([]),
    [summary, setSummary] = useState("");
  async function load() {
    try {
      const client = browserDb();
      let request = client
        .from(kind === "history" ? "sessions" : "agents")
        .select("*")
        .order(kind === "history" ? "started_at" : "created_at", {
          ascending: false,
        })
        .limit(100);
      if (id && id !== "new") request = request.eq("id", id);
      const { data, error } = await request;
      if (error) throw error;
      setRows(data || []);
      if (kind === "history" && id) {
        const [{ data: m, error: me }, { data: s, error: se }] =
          await Promise.all([
            client
              .from("messages")
              .select("role,content,created_at")
              .eq("session_id", id)
              .order("created_at"),
            client
              .from("session_summaries")
              .select("summary")
              .eq("session_id", id)
              .maybeSingle(),
          ]);
        if (me || se) throw me || se;
        setMessages(m || []);
        setSummary(s?.summary || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load records");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [kind, id]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const form = new FormData(e.currentTarget),
        client = browserDb();
      const {
        data: { user },
      } = await client.auth.getUser();
      const values = {
        name: form.get("name"),
        description: form.get("description"),
        instructions: form.get("instructions"),
        specialty: form.get("specialty"),
        language: form.get("language"),
        owner_id: user?.id,
      };
      const { error } =
        id === "new"
          ? await client.from("agents").insert(values)
          : await client.from("agents").update(values).eq("id", id);
      if (error) throw error;
      location.href = "/app/agents";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }
  async function remove() {
    if (!id || !confirm("Permanently delete this record?")) return;
    const { error } = await browserDb()
      .from(kind === "history" ? "sessions" : "agents")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
    else
      location.href =
        kind === "history" ? "/app/settings/history" : "/app/agents";
  }
  function download() {
    const blob = new Blob(
      [
        messages
          .map((m) => m.role.toUpperCase() + ": " + m.content)
          .join("\n\n") +
          "\n\nSUMMARY\n" +
          summary,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "myn-session.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="session-heading">
        <div>
          <Heading>
            {kind === "agents"
              ? pt
                ? "Quem acompanha você?"
                : "Find your perspective."
              : pt
                ? "Suas conversas."
                : "Your conversations."}
          </Heading>
        </div>
        {kind === "agents" && (
          <Link href="/app/agents/new" className="button primary">
            <Plus size={16} />
            Create agent
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="skeleton">
          {kind === "history"
            ? pt
              ? "Buscando suas conversas…"
              : "Loading your conversations…"
            : pt
              ? "Buscando seus agentes…"
              : "Loading your agents…"}
        </p>
      )}
      {id && kind === "agents" ? (
        <form className="surface settings-form" onSubmit={save}>
          <label>
            Name
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={rows[0]?.name}
              key={rows[0]?.id}
            />
          </label>
          <label>
            Description
            <input
              name="description"
              maxLength={300}
              defaultValue={rows[0]?.description}
            />
          </label>
          <label>
            Specialty
            <input
              name="specialty"
              required
              defaultValue={rows[0]?.specialty || "general"}
            />
          </label>
          <label>
            Instructions
            <textarea
              name="instructions"
              required
              maxLength={4000}
              defaultValue={rows[0]?.instructions}
            />
          </label>
          <label>
            Language
            <select name="language" defaultValue={rows[0]?.language || "en"}>
              <option value="en">English</option>
              <option value="pt-BR">Português</option>
            </select>
          </label>
          <Button>Save agent</Button>
          {id !== "new" && (
            <>
              <Link href={"/app/elo?agent=" + id} className="button secondary">
                Start Guide with this agent
              </Link>
              <Button type="button" variant="ghost" onClick={remove}>
                <Trash2 size={15} />
                Delete agent
              </Button>
            </>
          )}
        </form>
      ) : id ? (
        <section className="surface">
          <h2>{rows[0]?.title || "Session not found"}</h2>
          {rows.length > 0 && (
            <>
              <div className="toolbar">
                <Button variant="secondary" onClick={download}>
                  <Download size={15} />
                  Export transcript
                </Button>
                <Button variant="ghost" onClick={remove}>
                  <Trash2 size={15} />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const title = prompt("New title", rows[0].title);
                    if (title) {
                      const { error } = await browserDb()
                        .from("sessions")
                        .update({ title: title.slice(0, 200) })
                        .eq("id", id);
                      if (error) setError(error.message);
                      else void load();
                    }
                  }}
                >
                  Rename
                </Button>
                <Link href={"/app/elo?session=" + id}>Resume session</Link>
              </div>
              {messages.map((m, i) => (
                <div className="message" key={i}>
                  <span>
                    {m.role}
                    {m.created_at && (
                      <time dateTime={m.created_at}>
                        {" "}
                        · {new Date(m.created_at).toLocaleString()}
                      </time>
                    )}
                  </span>
                  <p dir="auto">{m.content}</p>
                </div>
              ))}
              <h3>Session summary</h3>
              <p className="prewrap" dir="auto">
                {summary || "No summary generated yet."}
              </p>
            </>
          )}
        </section>
      ) : (
        <>
          <label className="search">
            <Search size={18} />
            <input
              placeholder={"Search " + kind}
              aria-label={"Search " + kind}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="records-grid">
            {rows
              .filter((r) =>
                (r.title || r.name || "")
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((r) => (
                <Link
                  href={
                    (kind === "history"
                      ? "/app/settings/history/"
                      : "/app/agents/") + r.id
                  }
                  className="surface record-card"
                  key={r.id}
                >
                  <RecordIcon size={24} />
                  <h2>{r.title || r.name}</h2>
                  <p>{r.description || r.mode}</p>
                  <ArrowUpRight size={18} />
                </Link>
              ))}
          </div>
          {!loading && !rows.length && (
            <div className="empty-state">
              Nothing here yet. Start a session to make your first step.
            </div>
          )}
        </>
      )}
    </>
  );
}
