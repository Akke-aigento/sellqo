import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
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
          Cadeaukaart
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
          <div className="text-xs uppercase text-gray-600 mb-1">Code</div>
          <div
            className={`font-mono font-bold tracking-wider ${isThermal ? 'text-lg' : 'text-2xl'}`}
            style={{ letterSpacing: '2px' }}
          >
            {giftCard.code}
          </div>
        </div>

        {/* QR Code placeholder - using text representation */}
        <div className={`text-center ${isThermal ? 'mb-3' : 'mb-4'}`}>
          <div
            className={`mx-auto border-2 border-black flex items-center justify-center font-mono ${
              isThermal ? 'w-20 h-20 text-xs' : 'w-28 h-28 text-sm'
            }`}
            style={{ 
              background: `repeating-linear-gradient(
                0deg,
                #000 0px,
                #000 2px,
                #fff 2px,
                #fff 4px
              )`,
              backgroundSize: '100% 4px',
            }}
          >
            <div className="bg-white px-1 py-0.5 text-[8px]">
              {giftCard.code}
            </div>
          </div>
        </div>

        {/* Vervaldatum */}
        {giftCard.expires_at && (
          <div className={`text-center text-gray-600 ${isThermal ? 'text-xs mb-2' : 'text-sm mb-3'}`}>
            Geldig tot: {format(new Date(giftCard.expires_at), 'd MMMM yyyy', { locale: nl })}
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
          <div>Inwisselen in de winkel of online</div>
          <div className="mt-1">Niet inwisselbaar voor contant geld</div>
        </div>
      </div>
    );
  }
);

POSGiftCardPrint.displayName = 'POSGiftCardPrint';
