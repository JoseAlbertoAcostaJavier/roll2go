import mongoose from "mongoose";
import { ForumReaction } from "@/lib/ForumReaction";
import type { ReactionState } from "@/lib/forum";

// Reacciones de varios mensajes a la vez: cuántas hay de cada emoji y si tú has puesto cada una
export async function loadReactions(postIds: unknown[], meId: string) {
  if (postIds.length === 0) return new Map<string, ReactionState>();
  const ids = postIds.map((p) => new mongoose.Types.ObjectId(String(p)));
  const me = new mongoose.Types.ObjectId(meId);
  const rows = await ForumReaction.aggregate([
    { $match: { post: { $in: ids } } },
    {
      $group: {
        _id: { post: "$post", emoji: "$emoji" },
        count: { $sum: 1 },
        mine: { $max: { $cond: [{ $eq: ["$user", me] }, 1, 0] } },
      },
    },
  ]);

  const map = new Map<string, ReactionState>();
  for (const r of rows) {
    const key = String(r._id.post);
    const current = map.get(key) ?? {};
    current[r._id.emoji as string] = { count: r.count as number, mine: r.mine === 1 };
    map.set(key, current);
  }
  return map;
}