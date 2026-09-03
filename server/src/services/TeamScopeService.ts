import { AppRoles } from '../constants';
import { ForbiddenError } from '../errors/AppError';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser } from '../types/auth.types';

/**
 * TeamScopeService — one place that answers "whose records may this actor see?".
 *
 * Admin  → everyone (undefined = no filter)
 * Manager→ self + the whole reporting sub-tree below them (RSM → ASM → MR)
 * MR     → only themselves
 *
 * Every list endpoint that carries an `mrId` must run through `resolveMrFilter`,
 * otherwise a Manager sees other territories' data.
 */
export class TeamScopeService {
  private static instance: TeamScopeService | null = null;

  private constructor(private readonly users = UserRepository.getInstance()) {}

  public static getInstance(): TeamScopeService {
    if (!TeamScopeService.instance) {
      TeamScopeService.instance = new TeamScopeService();
    }
    return TeamScopeService.instance;
  }

  /** `undefined` means company-wide. */
  public async visibleUserIds(actor: AuthUser): Promise<number[] | undefined> {
    if (actor.role === AppRoles.ADMIN) return undefined;
    if (actor.role === AppRoles.MR) return [actor.id];
    const descendants = await this.users.listDescendantIds(actor.id);
    return [...new Set([actor.id, ...descendants])];
  }

  /**
   * Turns an optional requested `mrId` into a safe repository filter.
   * Throws when the actor asks for somebody outside their scope.
   */
  public async resolveMrFilter(
    actor: AuthUser,
    requestedMrId?: number,
  ): Promise<{ mrId?: number; mrIds?: number[] }> {
    if (actor.role === AppRoles.MR) {
      if (requestedMrId && requestedMrId !== actor.id) {
        throw new ForbiddenError('You can only view your own records');
      }
      return { mrId: actor.id };
    }

    if (actor.role === AppRoles.ADMIN) {
      return requestedMrId ? { mrId: requestedMrId } : {};
    }

    const teamIds = (await this.visibleUserIds(actor)) ?? [];
    if (requestedMrId) {
      if (!teamIds.includes(requestedMrId)) {
        throw new ForbiddenError('That user is outside your team scope');
      }
      return { mrId: requestedMrId };
    }
    return { mrIds: teamIds };
  }

  /** Guard for single-record reads / writes. */
  public async assertCanSee(actor: AuthUser, targetUserId: number): Promise<void> {
    if (actor.role === AppRoles.ADMIN || actor.id === targetUserId) return;
    if (actor.role === AppRoles.MR) {
      throw new ForbiddenError('You can only access your own records');
    }
    const teamIds = (await this.visibleUserIds(actor)) ?? [];
    if (!teamIds.includes(targetUserId)) {
      throw new ForbiddenError('That user is outside your team scope');
    }
  }
}
