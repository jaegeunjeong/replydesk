import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";

const envPath = resolve(".env.local");
const schemaPath = resolve("db/schema.sql");

const envText = await readFile(envPath, "utf8");
const databaseUrl = readEnvValue(envText, "DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing in .env.local");
}

const schema = await readFile(schemaPath, "utf8");
const client = new pg.Client({ connectionString: databaseUrl, ssl: false });

await client.connect();

try {
  await client.query(schema);
  const backfilled = await backfillInquiryCustomers(client);
  console.log(`Database schema applied. Customer links backfilled: ${backfilled}.`);
} finally {
  await client.end();
}

function readEnvValue(text, key) {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`));

  if (!line) return "";

  const rawValue = line.slice(key.length + 1).trim();
  return rawValue.replace(/^["']|["']$/g, "");
}

async function backfillInquiryCustomers(client) {
  const result = await client.query(`
    select id, workspace_id, customer_name, channel
    from inquiries
    where customer_id is null
  `);

  if (result.rows.length === 0) return 0;

  await client.query("begin");

  try {
    for (const row of result.rows) {
      const customerKey = getCustomerKey(row.customer_name, row.channel);
      const customerId = getCustomerId(row.workspace_id, customerKey);
      const contact = extractContact(row.channel);

      await client.query(
        `
        insert into customers (
          id,
          workspace_id,
          normalized_key,
          name,
          channel,
          contact,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, now(), now())
        on conflict (workspace_id, normalized_key) do update set
          name = excluded.name,
          channel = excluded.channel,
          contact = coalesce(excluded.contact, customers.contact),
          updated_at = now()
        `,
        [customerId, row.workspace_id, customerKey, row.customer_name, row.channel, contact],
      );

      await client.query("update inquiries set customer_id = $1, updated_at = now() where id = $2", [
        customerId,
        row.id,
      ]);
    }

    await client.query("commit");
    return result.rows.length;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function getCustomerKey(customer, channel) {
  const normalizedCustomer = normalizeCustomerValue(customer);

  if (normalizedCustomer && normalizedCustomer !== normalizeCustomerValue("이름 미상")) {
    return `customer:${normalizedCustomer}`;
  }

  return `channel:${normalizeCustomerValue(channel || "unknown")}`;
}

function getCustomerId(workspaceId, customerKey) {
  const hash = createHash("sha256").update(`${workspaceId}:${customerKey}`).digest("hex").slice(0, 24);
  return `cust_${hash}`;
}

function normalizeCustomerValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function extractContact(channel) {
  const phoneLike = String(channel || "").match(/(?:\+?\d[\d\s-]{7,}\d)/);
  return phoneLike?.[0]?.replace(/\s+/g, "") ?? null;
}
