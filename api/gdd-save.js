import { put, list } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { html, studio, title, games, submittedAt } = req.body;
  if (!html || !studio || !title) return res.status(400).json({ error: "missing fields" });

  const date = (submittedAt || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const slug = `${studio.replace(/\s+/g, "-")}_${date}_${title.replace(/\s+/g, "-")}`;
  const htmlPath = `gdd-reviews/${slug}.html`;

  // Save HTML file to Blob
  const { url } = await put(htmlPath, html, {
    access: "public",
    contentType: "text/html; charset=utf-8",
    addRandomSuffix: false,
  });

  // Load existing index
  let index = { studios: [], reviews: [] };
  try {
    const { blobs } = await list({ prefix: "gdd-reviews/index.json" });
    if (blobs.length > 0) {
      const r = await fetch(blobs[0].url);
      index = await r.json();
    }
  } catch { /* start fresh */ }

  // Add studio if new
  if (!index.studios.includes(studio)) {
    index.studios = [...index.studios, studio].sort();
  }

  // Add review entry
  const entry = {
    id: slug,
    studio,
    title,
    games: games || [],
    submittedAt: submittedAt || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    pass: 0,
    hold: 0,
    drop: 0,
    status: "미검토",
    htmlUrl: url,
    note: "",
  };
  index.reviews = [entry, ...index.reviews];

  // Save updated index
  await put("gdd-reviews/index.json", JSON.stringify(index, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return res.status(200).json({ id: slug, url });
}
