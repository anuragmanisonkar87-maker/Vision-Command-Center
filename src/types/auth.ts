export type AppRole =
  | "admin"
  | "finance_manager"
  | "brand_manager"
  | "operator"
  | "team_member"
  | "media_buyer"
  | "hr";

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  roles: AppRole[];
};
