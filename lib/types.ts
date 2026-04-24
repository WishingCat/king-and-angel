export type Profile = {
  id: string;
  display_name: string;
  can_admin: boolean;
  created_at: string;
};

export type PreSealWish = {
  user_id: string;
  wish_index: 0 | 1 | 2;
  content: string;
  updated_at: string;
};

export type SealStatus = "open" | "published";

export type SealState = {
  id: 1;
  status: SealStatus;
  sealed_at: string | null;
};

export type AngelEnvelope = {
  angel_user_id: string;
  ct: string;
  iv: string;
  created_at: string;
};

export type SealedPairing = {
  id: 1;
  ct: string;
  iv: string;
  manifest_sha256: string;
  created_at: string;
};

export type PublicMessage = {
  id: number;
  content: string;
  created_at: string;
};

export type Task = {
  id: number;
  title: string;
  description: string;
  created_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
};

export type TaskWithClaimer = Task & {
  claimer_display_name: string | null;
};
