/** Minimal public view of a user (shared by many DTOs; kept here to avoid circular imports). */
export class PersonRefDto {
  userId: string;
  displayName: string;
  avatarKey: string;
  /** API path of the profile photo (authenticated), or null */
  photoUrl: string | null;
}
