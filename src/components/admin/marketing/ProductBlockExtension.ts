import { Node } from '@tiptap/react';
import {
  PRODUCT_BLOCK_ATTR,
  normalizeProductBlock,
  parseProductBlockAttr,
  productBlockSpec,
  type ProductBlockData,
} from '@/lib/emailProductBlock';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sellqoProducts: {
      /** MAIL-2c: productblok invoegen op de cursor. */
      insertProductBlock: (data: ProductBlockData) => ReturnType;
    };
  }
}

/**
 * MAIL-2c — productblok als één ondeelbaar element in de e-maileditor.
 *
 * parseHTML leest enkel het JSON-attribuut; renderHTML bouwt de mailveilige tabel opnieuw op uit
 * die gevalideerde gegevens. Losse HTML binnen het blok (bv. met de hand in de HTML-modus
 * aangepast) wordt dus niet overgenomen: het blok blijft wat de dialoog maakte.
 */
export const ProductBlock = Node.create({
  name: 'sellqoProducts',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      data: {
        default: null,
        parseHTML: (el: HTMLElement) => parseProductBlockAttr(el.getAttribute(PRODUCT_BLOCK_ATTR)),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{
      tag: `div[${PRODUCT_BLOCK_ATTR}]`,
      // Een blok zonder geldige gegevens laten we vallen in plaats van een leeg kader te tonen.
      getAttrs: (el: HTMLElement) => (parseProductBlockAttr(el.getAttribute(PRODUCT_BLOCK_ATTR)) ? null : false),
    }];
  },

  renderHTML({ node }) {
    const data = normalizeProductBlock(node.attrs.data);
    if (!data) return ['div', {}];
    // De spec bevat enkel nieuwe arrays en strings; ProseMirror zet tekst als tekstknoop en
    // attributen via setAttribute, dus niets wordt als HTML geïnterpreteerd.
    return productBlockSpec(data) as unknown as [string, Record<string, string>];
  },

  addCommands() {
    return {
      insertProductBlock: (data: ProductBlockData) => ({ commands }) => {
        const clean = normalizeProductBlock(data);
        if (!clean) return false;
        return commands.insertContent({ type: this.name, attrs: { data: clean } });
      },
    };
  },
});
