import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

/** Invalidate this after any photo change — every avatar on screen follows. */
export const USER_PHOTOS_QUERY_KEY = ['user-photos'] as const;

async function listUserPhotos(): Promise<Record<number, string>> {
  const { data } = await api.get<ApiSuccess<Array<{ userId: number; photoUrl: string }>>>(
    '/employees/photos',
  );
  return Object.fromEntries(data.data.map((row) => [row.userId, row.photoUrl]));
}

/**
 * The current photo (`file:<key>` or a URL) of user `userId`, from one
 * app-wide list fetched once — so a photo changed anywhere shows everywhere.
 */
export function useUserPhoto(userId: number | null | undefined): string | null {
  const query = useQuery({
    queryKey: USER_PHOTOS_QUERY_KEY,
    queryFn: listUserPhotos,
    enabled: userId != null,
    staleTime: 5 * 60_000,
  });
  return userId != null ? (query.data?.[userId] ?? null) : null;
}
