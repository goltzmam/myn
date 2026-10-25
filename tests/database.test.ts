import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  session = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role; create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;`,
  );
  await db.exec(readFileSync("supabase/migrations/0001_initial.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/0002_mentor_transcripts.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/migrations/0001_initial.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/0002_mentor_transcripts.sql", "utf8"),
  );
  await db.exec(
    `grant usage on schema public,auth to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;insert into auth.users(id) values('${alice}'),('${bob}'); insert into sessions(id,user_id,mode,title) values('${session}','${alice}','guide','Database setup');set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`,
  );
});
afterAll(async () => {
  await db?.close();
});
it("creates a profile via signup trigger", async () => {
  const result = await db.query("select * from profiles");
  expect(result.rows).toHaveLength(1);
});
it("isolates session reads by user", async () => {
  await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false)`);
  expect((await db.query("select * from sessions")).rows).toHaveLength(0);
  await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false)`);
});
it("rejects cross-user session writes", async () => {
  await expect(
    db.exec(`insert into sessions(user_id,mode) values('${bob}','wake')`),
  ).rejects.toThrow();
});
it("prevents users granting themselves subscriptions", async () => {
  await expect(
    db.exec(
      `insert into subscriptions(user_id,plan_id,status) values('${alice}','max','active')`,
    ),
  ).rejects.toThrow();
});
it("atomically persists messages, plan and summary", async () => {
  await db.query("select save_exchange($1,$2,$3,$4,$5,$6)", [
    session,
    "Where next?",
    "Open settings",
    JSON.stringify([
      { title: "Open settings", status: "completed", evidence: "" },
    ]),
    "Opening settings",
    42,
  ]);
  expect((await db.query("select * from messages")).rows).toHaveLength(2);
  const steps = await db.query<{ status: string }>(
    "select status from session_steps",
  );
  expect(steps.rows[0].status).toBe("pending");
});
it("bootstrap is repeatable without duplicating plans or built-in agents", async () => {
  expect((await db.query("select * from plans")).rows).toHaveLength(4);
  expect((await db.query("select * from agents")).rows).toHaveLength(5);
});
it("keeps a multilingual user transcript even if no AI answer arrives", async () => {
  const turn = crypto.randomUUID();
  await db.query("select save_question($1,$2,$3)", [
    session,
    turn,
    "كيف يمكنني حل هذه المشكلة؟",
  ]);
  const q = await db.query<{ content: string }>(
    "select content from messages where turn_id=$1",
    [turn],
  );
  expect(q.rows[0].content).toBe("كيف يمكنني حل هذه المشكلة؟");
});
it("saves both sides of a turn idempotently and preserves summary progress", async () => {
  const turn = crypto.randomUUID();
  for (let i = 0; i < 2; i++)
    await db.query("select save_exchange($1,$2,$3,$4,$5,$6,$7)", [
      session,
      "この画面を説明して",
      "設定を開きましょう",
      JSON.stringify([
        {
          title: "設定を開く",
          status: "completed",
          evidence: "User explicitly confirmed opening settings",
        },
      ]),
      "設定を開きました",
      30,
      turn,
    ]);
  expect(
    (await db.query("select * from messages where turn_id=$1", [turn])).rows,
  ).toHaveLength(2);
  const summary = await db.query<{ completed_tasks: string[] }>(
    "select completed_tasks from session_summaries where session_id=$1",
    [session],
  );
  expect(summary.rows[0].completed_tasks).toEqual(["設定を開く"]);
});
it("rejects transcript writes by another user", async () => {
  await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false)`);
  await expect(
    db.query("select save_question($1,$2,$3)", [
      session,
      crypto.randomUUID(),
      "Other account",
    ]),
  ).rejects.toThrow("Forbidden");
  await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false)`);
});
it("separates audio and analysis rate limits for natural voice turns", async () => {
  for (let i = 0; i < 12; i++)
    await db.query("select reserve_usage($1,$2)", [session, "audio"]);
  expect(
    (await db.query("select * from usage_events where event_type='audio'"))
      .rows,
  ).toHaveLength(12);
});
it("enforces rate limit in persistent database", async () => {
  for (let i = 0; i < 20; i++)
    await db.query("select reserve_usage($1,$2)", [session, "analysis"]);
  await expect(
    db.query("select reserve_usage($1,$2)", [session, "analysis"]),
  ).rejects.toThrow("Rate limit");
});
it("restricts billing mutations to service role", async () => {
  await expect(
    db.query(
      `select apply_billing_event('evt_test','created',1,$1,'max','cus_test','sub_test','active',now())`,
      [alice],
    ),
  ).rejects.toThrow();
});
it("cascades deletion without retaining messages", async () => {
  await db.query("delete from sessions where id=$1", [session]);
  expect((await db.query("select * from messages")).rows).toHaveLength(0);
});
it("processes signed billing events idempotently and ignores stale updates", async () => {
  await db.exec("reset role");
  await db.query(
    "select apply_billing_event('evt_1','updated',100,$1,'max','cus_1','sub_1','active',now()+interval '1 month')",
    [alice],
  );
  await db.query(
    "select apply_billing_event('evt_1','updated',100,$1,'max','cus_1','sub_1','active',now()+interval '1 month')",
    [alice],
  );
  await db.query(
    "select apply_billing_event('evt_old','updated',90,$1,'pro','cus_1','sub_1','canceled',now())",
    [alice],
  );
  expect(
    (
      await db.query(
        "select * from billing_events where provider_event_id='evt_1'",
      )
    ).rows,
  ).toHaveLength(1);
  const result = await db.query<{ plan_id: string; status: string }>(
    "select plan_id,status from subscriptions where user_id=$1",
    [alice],
  );
  expect(result.rows[0]).toMatchObject({ plan_id: "max", status: "active" });
});
