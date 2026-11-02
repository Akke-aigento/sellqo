// ODOO-HORECA-1 harnas — per kaart een eigen stand (toegang, spoor, verbonden) via context.
import { createContext, useContext } from 'react';
export interface CardState { access: boolean; track: 'webshop' | 'horeca' | 'events'; configured: boolean; sync: boolean }
export const CardCtx = createContext<CardState>({ access: true, track: 'webshop', configured: false, sync: false });
export const useCard = () => useContext(CardCtx);
