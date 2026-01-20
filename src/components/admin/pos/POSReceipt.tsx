import { forwardRef } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import type { POSTransaction, POSCartItem, POSPayment } from '@/types/pos';

interface POSReceiptProps {
  transaction: POSTransaction;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeVatNumber?: string;
  footerText?: string;
}

export const POSReceipt = forwardRef<HTMLDivElement, POSReceiptProps>(({
  transaction,
  storeName = 'Winkel',
  storeAddress,
  storePhone,
  storeVatNumber,
  footerText,
}, ref) => {
  const paymentMethodLabels: Record<string, string> = {
    cash: 'Contant',
    card: 'Pinbetaling',
    ideal: 'iDEAL',
    gift_card: 'Cadeaubon',
    loyalty_points: 'Punten',
    manual: 'Handmatig',
  };

  return (
    <div 
      ref={ref}
      className="bg-white text-black p-4 font-mono text-sm"
      style={{ width: '80mm', minHeight: '100mm' }}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold uppercase">{storeName}</h1>
        {storeAddress && (
          <p className="text-xs whitespace-pre-line">{storeAddress}</p>
        )}
        {storePhone && <p className="text-xs">Tel: {storePhone}</p>}
        {storeVatNumber && <p className="text-xs">BTW: {storeVatNumber}</p>}
      </div>

      {/* Separator */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Transaction Info */}
      <div className="text-xs mb-3">
        <div className="flex justify-between">
          <span>Bon:</span>
          <span>{transaction.receipt_number || transaction.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>Datum:</span>
          <span>{format(new Date(transaction.created_at), 'dd-MM-yyyy', { locale: nl })}</span>
        </div>
        <div className="flex justify-between">
          <span>Tijd:</span>
          <span>{format(new Date(transaction.created_at), 'HH:mm:ss', { locale: nl })}</span>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Items */}
      <div className="space-y-1 mb-3">
        {transaction.items.map((item: POSCartItem, index: number) => (
          <div key={index} className="text-xs">
            <div className="flex justify-between">
              <span className="truncate flex-1">{item.name}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>{item.quantity} x {formatCurrency(item.price)}</span>
              <span>{formatCurrency(item.quantity * item.price)}</span>
            </div>
            {item.discount > 0 && (
              <div className="flex justify-between pl-2 text-xs">
                <span>Korting</span>
                <span>-{formatCurrency(item.discount)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Totals */}
      <div className="text-xs space-y-1 mb-3">
        <div className="flex justify-between">
          <span>Subtotaal</span>
          <span>{formatCurrency(transaction.subtotal)}</span>
        </div>
        {transaction.discount_total > 0 && (
          <div className="flex justify-between">
            <span>Korting</span>
            <span>-{formatCurrency(transaction.discount_total)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>BTW (21%)</span>
          <span>{formatCurrency(transaction.tax_total)}</span>
        </div>
        <div className="border-t border-black my-1" />
        <div className="flex justify-between font-bold text-base">
          <span>TOTAAL</span>
          <span>{formatCurrency(transaction.total)}</span>
        </div>
      </div>

      {/* Payment Info */}
      <div className="text-xs space-y-1 mb-3">
        {transaction.payments.map((payment: POSPayment, index: number) => (
          <div key={index} className="flex justify-between">
            <span>{paymentMethodLabels[payment.method] || payment.method}</span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
        ))}
        {transaction.cash_received && transaction.cash_change && transaction.cash_change > 0 && (
          <>
            <div className="flex justify-between">
              <span>Ontvangen</span>
              <span>{formatCurrency(transaction.cash_received)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Wisselgeld</span>
              <span>{formatCurrency(transaction.cash_change)}</span>
            </div>
          </>
        )}
        {transaction.card_brand && transaction.card_last4 && (
          <div className="flex justify-between text-xs mt-1">
            <span>Kaart</span>
            <span>{transaction.card_brand} ****{transaction.card_last4}</span>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Footer */}
      <div className="text-center text-xs">
        {footerText ? (
          <p className="whitespace-pre-line">{footerText}</p>
        ) : (
          <>
            <p>Bedankt voor uw aankoop!</p>
            <p className="mt-1">Bezoek ons binnenkort weer</p>
          </>
        )}
      </div>

      {/* Barcode placeholder */}
      <div className="text-center mt-4">
        <div className="inline-block">
          <div className="text-xs font-mono tracking-widest">
            {transaction.receipt_number || transaction.id.slice(0, 12).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
});

POSReceipt.displayName = 'POSReceipt';
