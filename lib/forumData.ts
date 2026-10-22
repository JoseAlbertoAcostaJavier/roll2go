import mongoose from "mongoose";
import { ForumReaction } from "@/lib/ForumReaction";
import { MAX_REACTION_NAMES, type ReactionState } from "@/lib/forum";
import { loadUserCards } from "@/lib/userCards";

// Reacciones de varios mensajes a la vez: cuántas hay de cada emoji, si tú has puesto cada una y quién más
export async function loadReactions(postIds: unknown[], meId: string) {
  if (postIds.length === 0) return new Map<string, ReactionState>();
  const ids = postIds.map((p) => new mongoose.Types.ObjectId(String(p)));
  const me = new mongoose.Types.ObjectId(meId);
  const rows = await ForumReaction.aggregate<{
    _id: { post: unknown; emoji: string };
    count: number;
    mine: number;
    users: unknown[];
  }>([
    { $match: { post: { $in: ids } } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: { post: "$post", emoji: "$emoji" },
        count: { $sum: 1 },
        mine: { $max: { $cond: [{ $eq: ["$user", me] }, 1, 0] } },
        users: { $push: "$user" },
      },
    },
  ]);

  // Nombres de los demás (sin ti), solo los primeros de cada emoji
  const others = (users: unknown[]) => users.filter((u) => String(u) !== meId).slice(0, MAX_REACTION_NAMES);
  const cards = await loadUserCards(rows.flatMap((r) => others(r.users)));

  const map = new Map<string, ReactionState>();
  for (const r of rows) {
    const key = String(r._id.post);
    const current = map.get(key) ?? {};
    current[r._id.emoji] = {
      count: r.count,
      mine: r.mine === 1,
      names: others(r.users).flatMap((u) => cards.get(String(u))?.displayName ?? []),
    };
    map.set(key, current);
  }
  return map;
}
