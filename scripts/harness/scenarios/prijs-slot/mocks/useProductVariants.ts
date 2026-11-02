import { variants, options, updates } from './data';
export type { ProductVariant, VariantFormData } from '../../../../../src/hooks/useProductVariants';
const m = (name: string) => ({ mutate: (arg: unknown) => updates.push({ name, arg }), mutateAsync: async (arg: unknown) => { updates.push({ name, arg }); }, isPending: false });
export function useProductVariants() {
  return { variants, options, isLoading: false,
    createVariant: m('createVariant'), updateVariant: m('updateVariant'), deleteVariant: m('deleteVariant'),
    createOption: m('createOption'), updateOption: m('updateOption'), deleteOption: m('deleteOption'),
    generateVariants: m('generateVariants'), syncVariants: m('syncVariants') };
}
