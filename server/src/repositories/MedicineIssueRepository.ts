import { StockTxnRepository } from './StockTxnRepository';

export class MedicineIssueRepository {
  private static instance: MedicineIssueRepository | null = null;
  private constructor(private readonly stockTxns = StockTxnRepository.getInstance()) {}
  public static getInstance(): MedicineIssueRepository {
    if (!MedicineIssueRepository.instance) {
      MedicineIssueRepository.instance = new MedicineIssueRepository();
    }
    return MedicineIssueRepository.instance;
  }

  public getPrisma() {
    return this.stockTxns.getPrisma();
  }

  public list(params: {
    page: number;
    limit: number;
    mrId?: number;
    medicineId?: number;
  }) {
    return this.stockTxns.listIssues(params);
  }
}
