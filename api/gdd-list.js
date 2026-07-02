import { list } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  try {
    // index.json을 Blob에서 읽기
    const { blobs } = await list({ prefix: "gdd-reviews/index.json" });
    if (blobs.length === 0) {
      return res.status(200).json({ studios: [], reviews: [] });
    }
    const r = await fetch(blobs[0].url);
    const index = await r.json();
    return res.status(200).json(index);
  } catch (e) {
    return res.status(200).json({ studios: [], reviews: [] });
  }
}
