"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { browserDb } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/stores/preferences";
export function Settings() {
  const { language, setLanguage } = usePreferences(),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    browserDb()
      .auth.getUser()
      .then(async ({ data: { user } }) => {
        if (user) {
          const { data } = await browserDb()
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          setName(data?.full_name || "");
        }
      });
  }, []);
  async function save() {
    const client = browserDb();
    const {
      data: { user },
    } = await client.auth.getUser();
    const { error } = await client
      .from("profiles")
      .update({ full_name: name, language })
      .eq("id", user?.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    if (password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setStatus(error.message);
        return;
      }
      setPassword("");
    }
    setStatus("Settings saved.");
  }
  async function testMic() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      setDevices(await navigator.mediaDevices.enumerateDevices());
      setTimeout(() => media.getTracks().forEach((t) => t.stop()), 3000);
      setStatus(
        "Microphone permission granted. Tracks stop after three seconds.",
      );
    } catch {
      setStatus("Microphone permission denied or unsupported.");
    }
  }
  return (
    <>
      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
      <h1>Your space. Your preferences.</h1>
      <nav className="tabs">
        <Link href="/app/settings/account">Account</Link>
        <Link href="/app/settings/audio">Audio</Link>
        <Link href="/app/settings/privacy">Privacy</Link>
      </nav>
      <section className="surface settings-form">
        <h2>Account & language</h2>
        <label>
          Full name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </label>
        <label>
          Language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "pt-BR")}
          >
            <option value="en">English</option>
            <option value="pt-BR">Português</option>
          </select>
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Button
          onClick={save}
          disabled={Boolean(password && password.length < 8)}
        >
          Save changes
        </Button>
        <p role="status">{status}</p>
      </section>
      <section className="surface">
        <h2>Audio</h2>
        <p>
          Open Guide and choose “Talk to your mentor” for hands-free questions
          and spoken answers. Listening pauses during each reply to avoid
          feedback. Set the conversation language to auto to follow your voice.
        </p>
        <Button variant="secondary" onClick={testMic}>
          Test microphone permission
        </Button>
        {devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => (
            <p key={d.deviceId}>{d.label}</p>
          ))}
        <p>
          Voice: Coral · AI-generated. Select your default microphone in browser
          settings.
        </p>
      </section>
      <section className="surface">
        <h2>Privacy & your data</h2>
        <p>
          Screenshots are processed transiently, never persisted. Session text
          stays until you delete it. Provider retention policies also apply.
          Export and delete individual transcripts in History.
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            if (!confirm("Permanently delete all your session history?"))
              return;
            const {
              data: { user },
            } = await browserDb().auth.getUser();
            const { error } = await browserDb()
              .from("sessions")
              .delete()
              .eq("user_id", user?.id);
            setStatus(error ? error.message : "Session history deleted.");
          }}
        >
          Delete all history
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            if (
              !confirm(
                "Permanently delete your account and all associated data?",
              )
            )
              return;
            const res = await fetch("/api/account", { method: "DELETE" });
            if (res.ok) {
              await browserDb().auth.signOut();
              location.href = "/";
            } else setStatus((await res.json()).error);
          }}
        >
          Delete account
        </Button>
      </section>
    </>
  );
}
