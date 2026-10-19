import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { Friendship } from "@/lib/Friendship";
import { Character } from "@/lib/Character";

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  pronouns: string;
  location: string;
  bio: string;
  avatarUrl: string | null;
  friends: number;
  characters: number;
};

export async function getPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  await connectDB();
  const u = await User.findOne({
    usernameLower: username.toLowerCase(),
    verified: true,
  })
    .select("username displayName pronouns location bio avatarId")
    .lean();
  if (!u) return null;

  const [friends, characters] = await Promise.all([
    Friendship.countDocuments({
      status: "accepted",
      $or: [{ requester: u._id }, { recipient: u._id }],
    }),
    Character.countDocuments({ owner: u._id }),
  ]);

  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName || u.username,
    pronouns: u.pronouns ?? "",
    location: u.location ?? "",
    bio: u.bio ?? "",
    avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
    friends,
    characters,
  };
}
