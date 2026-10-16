import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { dateFnsLocaleFor } from '@/hooks/useDateFnsLocale';
import { format } from 'date-fns';
import QRCode from 'react-qr-code';
import type { GiftCard, GiftCardDesign } from '@/types/giftCard';

interface POSGiftCardPrintProps {
  giftCard: GiftCard;
  design?: GiftCardDesign | null;
  tenantName: string;
  tenantLogo?: string | null;
  format?: 'a6' | 'thermal';
}

export const POSGiftCardPrint = forwardRef<HTMLDivElement, POSGiftCardPrintProps>(
  ({ giftCard, design, tenantName, tenantLogo, format: printFormat = 'thermal' }, ref) => {
    const { t, i18n } = useTranslation();
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: giftCard.currency || 'EUR',
      }).format(amount);
    };

    const isThermal = printFormat === 'thermal';

    return (
      <div
        ref={ref}
        className={`bg-white text-black ${
          isThermal ? 'w-[72mm] p-3' : 'w-[105mm] h-[148mm] p-4'
        }`}
        style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: isThermal ? '12px' : '14px',
        }}
      >
        {/* Header met logo/naam */}
        <div className={`text-center ${isThermal ? 'mb-3' : 'mb-4'}`}>
          {tenantLogo ? (
            <img
              src={tenantLogo}
              alt={tenantName}
              className={`mx-auto ${isThermal ? 'max-h-10' : 'max-h-16'} max-w-full object-contain`}
            />
          ) : (
            <div className={`font-bold ${isThermal ? 'text-lg' : 'text-2xl'}`}>
              {tenantName}
            </div>
          )}
        </div>

        {/* Design afbeelding */}
        {design?.image_url && !isThermal && (
          <div className="mb-4">
            <img
              src={design.image_url}
              alt={design.name}
              className="w-full h-24 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Titel */}
        <div className={`text-center font-bold uppercase tracking-wider ${isThermal ? 'text-base mb-2' : 'text-xl mb-3'}`}>
          {t('admin.pos.receipt.gift_card_title')}
        </div>

        {/* Bedrag */}
        <div className={`text-center ${isThermal ? 'mb-3' : 'mb-4'}`}>
          <div
            className={`font-bold ${isThermal ? 'text-2xl' : 'text-4xl'}`}
            style={{ borderTop: '2px solid black', borderBottom: '2px solid black', padding: isThermal ? '8px 0' : '12px 0' }}
          >
            {formatCurrency(giftCard.initial_balance)}
          </div>
        </div>

        {/* Code */}
        <div className={`text-center ${isThermal ? 'mb-3' : 'mb-4'}`}>
          <div className="text-xs uppercase text-gray-600 mb-1">{t('admin.pos.receipt.code_label')}</div>
          <div
            className={`font-mono font-bold tracking-wider ${isThermal ? 'text-lg' : 'text-2xl'}`}
            style={{ letterSpacing: '2px' }}
          >
            {giftCard.code}
          </div>
        </div>

        {/* ADMIN-DEAD-1: echte QR met de cadeauboncode. Tot 16-10-2026 stond hier een
            gestreept vlak dat op een QR leek, maar niet scanbaar was. */}
        <div className={`text-center ${isThermal ? 'mb-3' : 'mb-4'}`}>
          <div className="mx-auto inline-block bg-white p-1">
            <QRCode value={giftCard.code} size={isThermal ? 80 : 112} level="M" />
          </div>
        </div>

        {/* Vervaldatum */}
        {giftCard.expires_at && (
          <div className={`text-center text-gray-600 ${isThermal ? 'text-xs mb-2' : 'text-sm mb-3'}`}>
            {t('admin.pos.receipt.valid_until', { date: format(new Date(giftCard.expires_at), 'd MMMM yyyy', { locale: dateFnsLocaleFor(i18n.language) }) })}
          </div>
        )}

        {/* Persoonlijke boodschap */}
        {giftCard.personal_message && (
          <div
            className={`text-center italic border-t border-gray-300 ${
              isThermal ? 'text-xs pt-2 mt-2' : 'text-sm pt-3 mt-3'
            }`}
          >
            "{giftCard.personal_message}"
            {giftCard.recipient_name && (
              <div className="mt-1 not-italic">- {giftCard.recipient_name}</div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`text-center text-gray-500 border-t border-gray-300 ${isThermal ? 'text-[10px] pt-2 mt-3' : 'text-xs pt-3 mt-4'}`}>
          <div>{t('admin.pos.receipt.redeem')}</div>
          <div className="mt-1">{t('admin.pos.receipt.not_cash')}</div>
        </div>
      </div>
    );
  }
);

POSGiftCardPrint.displayName = 'POSGiftCardPrint';
