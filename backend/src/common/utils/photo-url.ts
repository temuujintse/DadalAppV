/**
 * Relative API path of a user's photo (under /api/v1), versioned so clients can cache it
 * forever and still see a new upload. null when the user has no photo.
 */
export function photoUrl(userId: string, photoUpdatedAt: Date | null | undefined): string | null {
  return photoUpdatedAt ? `/users/${userId}/photo?v=${photoUpdatedAt.getTime()}` : null;
}
