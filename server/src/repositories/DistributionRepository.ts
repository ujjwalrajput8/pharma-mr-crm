import { StockTxnRepository } from './StockTxnRepository';

export class DistributionRepository {
  private static instance: DistributionRepository | null = null;

  private constructor(private readonly stockTxns = StockTxnRepository.getInstance()) {}

  public static getInstance(): DistributionRepository {
    if (!DistributionRepository.instance) {
      DistributionRepository.instance = new DistributionRepository();
    }
    return DistributionRepository.instance;
  }

  public list(params: {
    page: number;
    limit: number;
    mrId?: number;
    mrIds?: number[];
    medicineId?: number;
    visitId?: number;
    from?: Date;
    to?: Date;
  }) {
    return this.stockTxns.listSampleDistributions(params);
  }
}
