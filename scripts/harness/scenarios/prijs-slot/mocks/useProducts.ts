import { products, updates } from './data';
export function useProducts() {
  return { products, isLoading: false, updateProduct: { mutateAsync: async (arg: unknown) => { updates.push({ name: 'updateProduct', arg }); }, mutate: () => {}, isPending: false } };
}
