import type {
  CreateStoreDto,
  ListStoresQueryDto,
  UpdateStoreDto,
} from '../dto/store.dto';
import { NotFoundError } from '../errors/AppError';
import { StoreRepository } from '../repositories/StoreRepository';

export class StoreService {
  private static instance: StoreService | null = null;

  private constructor(private readonly stores = StoreRepository.getInstance()) {}

  public static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  public async list(query: ListStoresQueryDto) {
    const { items, total } = await this.stores.list(query);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getById(id: number) {
    const store = await this.stores.findById(id);
    if (!store) throw new NotFoundError('Medical store not found');
    return store;
  }

  public async create(dto: CreateStoreDto, actorId: number) {
    return this.stores.create({ ...dto, createdBy: actorId, updatedBy: actorId });
  }

  public async update(id: number, dto: UpdateStoreDto, actorId: number) {
    await this.getById(id);
    return this.stores.update(id, { ...dto, updatedBy: actorId });
  }

  public async remove(id: number, actorId: number) {
    await this.getById(id);
    await this.stores.softDelete(id, actorId);
  }
}
