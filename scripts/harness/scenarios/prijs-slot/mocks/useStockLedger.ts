export type StockMovementReason = string;
export function useSetStockManual() { return { mutate: () => {}, mutateAsync: async () => {}, isPending: false }; }
export function useStockMovements() { return { data: [], isLoading: false }; }
