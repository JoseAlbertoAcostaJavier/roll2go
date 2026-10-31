// Tipos de usuario compartidos entre servidor y componentes (sin código de servidor)

export type UserCard = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

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

export type Relation = "none" | "friend" | "outgoing" | "incoming";
