# GKS 2.0 — dekking officiële use cases

Gegenereerd door `GKS_WRITE_COVERAGE=1 npx vitest run src/kassa/fiscal/__tests__/uc` (KASSA-0).
Bron: FOD Financiën, POS documentation NL/ENG, map 20260821_tests (BasicSet 1.8, AdvancedSet 1.6, Reports NL + ENG 1.3).

**A** schema (officieel bericht valideert tegen ons schema) · **B** herbouw (onze builders maken hetzelfde bericht, afgeleide bedragen zelf berekend) · **C** simulator (eventlabel, operatie en btw gelijk aan het officiële FDM-antwoord; nooit handtekeningen) · **D** rapport (X/Z uit ons logboek gelijk aan het officiële rapport).

Totaal: A 192/192 · B 181/181 · C 181/181 · D 3/11 exact, 11/11 op gedocumenteerde afwijkingen in de officiële data na 

| Use case | Scope v1 | Stappen | A | B | C | D | Opmerking |
|---|---|---|---|---|---|---|---|
| advanced/UC200_DirectSale_CompositeProduct | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC201_signSale_Rounding | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC220_signSale_LinePriceChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC221A_signSale_LinePriceChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC221B_signSale_LinePriceChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC222_signSale_PriceChange_CompositeProduct | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC223_signSale_EventPriceChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC224_signSale_MultiplePriceChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC225A_PriceChange_IndirectSale | v1 | 3 | ✓ | ✓ | ✓ | – |  |
| advanced/UC225B_PriceChange_IndirectSale | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC226_PriceChange | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC229B_FreeArticle_DirectSale | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC230_signSale_Correction | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC240_TableSplitToNew | v1 | 6 | ✓ | ✓ | ✓ | – |  |
| advanced/UC241_TableSplitToExisting | v1 | 5 | ✓ | ✓ | ✓ | – |  |
| advanced/UC242_TableSplitTo2New | v1 | 4 | ✓ | ✓ | ✓ | – |  |
| advanced/UC243_TableSplit_Discount | v1 | 6 | ✓ | ✓ | ✓ | – |  |
| advanced/UC250_TableMerge | v1 | 4 | ✓ | ✓ | ✓ | – |  |
| advanced/UC251_TableMerge | v1 | 4 | ✓ | ✓ | ✓ | – |  |
| advanced/UC252_TableMerge_Discount | v1 | 4 | ✓ | ✓ | ✓ | – |  |
| advanced/UC260_MPV_Sale | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC261_MPV_Use | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC262_MPV_Use | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC270_SPV_Sale | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC271_SPV_Use | later | 4 | ✓ | ✓ | ✓ | – |  |
| advanced/UC280_CompositeProduct | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC290_PaymentForeignCurrencyMix | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC291_PaymentForeignCurrency | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC292_Tip | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC294_PaymentForeignCurrency | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC295_PaymentForeignCurrency | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC296_PaymentForeignCurrencyTip | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4100_CustomerAccount | beslissen | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4101_CostCenterChange_TableToRoom | later | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4102 | v1 | 6 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4103_SplitBill_CostCenterChange | v1 | 4 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4103bis_SplitBill | v1 | 3 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4104 | v1 | 11 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4105_MPVtoCash | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4106_MenuAllIn_PriceChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4107_VatLabelsABC | v1 | 5 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4108_VatLabelX | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4109_NoPayment | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4110_advancedPayment | later | 3 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4111_advancedPayment%of price | later | 3 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4112_WeightedProduct | later | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4113_prepaymentReservation | later | 5 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4114_festivalDeposit | later | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4116_CorrectionPriceChange | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4117_GTIN | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4118_PaymentCorrection | beslissen | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4119_SplitPayment | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4119bis_SplitBill | v1 | 5 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4120_Supplement_PriceChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4120bis_Supplement_TransactionLIne | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4121CustomerInvoice | beslissen | 3 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4122_Creditnote | beslissen | 3 | ✓ | ✓ | ✓ | – |  |
| advanced/UC4123_CostCenterChair | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M110_signSale | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M111_signSale_Refund | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M112A_signSale_RefundPartial | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| basic/M112B_signSale_RefundPartial | v1 | 2 | ✓ | ✓ | ✓ | – |  |
| basic/M121_signOrder | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M122_signCostCenterChange | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M123_signPrebill | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M130_signMoneyInOut | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M131_signDrawerOpen | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M132_signPaymentCorrection | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M133_signMoneyInOut_DrawerDeclaration | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M140_signWorkIn | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M141_signWorkOut | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M150_signInvoice | beslissen | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M160_signCopy_Sale | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M161_signCopy_Order | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M170_signWorkIn_Training | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M171_signSale_Training | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M171B_signSale_Training | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/M172_signCopy_Training | v1 | 1 | ✓ | ✓ | ✓ | – |  |
| basic/Q100_Status | v1 | 1 | – | – | – | – |  |
| basic/Q110_Status_multi_lang_messages | v1 | 1 | – | – | – | – |  |
| reports-eng/REPORTS_ENG | v1 | 12 | ✓ | ✓ | ✓ | ✓* | ENG-set telt T1 (bestelling 52,00 op TER-1-BAR) niet mee in P (3 tickets/198 i.p.v. 4/250); de NL-set telt alle P-events incl. voorrekeningen. Wij volgen NL. Q&A-vraag 13. ENG-set (Reports 1.3, juli 2024) telt rapport-events (R) mee in posDevices en de FDM-tellers; de nieuwere NL-set (2025) en FAQ Q502/Q504 niet. Wij volgen NL + FAQ. Q&A-vraag 12. ENG-set telt T1 (bestelling 52,00 op TER-1-BAR) niet mee in P (3 tickets/198 i.p.v. 4/250); de NL-set telt alle P-events incl. voorrekeningen. Wij volgen NL. Q&A-vraag 13. ENG-set (Reports 1.3, juli 2024) telt rapport-events (R) mee in posDevices en de FDM-tellers; de nieuwere NL-set (2025) en FAQ Q502/Q504 niet. Wij volgen NL + FAQ. Q&A-vraag 12. |
| reports-nl/REPORTS_NL | v1 | 17 | ✓ | ✓ | ✓ | ✓* | De NL-map bevat een kopie van de ENG-M184 (byte-identieke variabelen, data van 30-07-2024); hoort bij de ENG-inputtickets en wordt daar getest. Kopie van de ENG-M184, zie hierboven. Officieel rapport geeft gebruiker 75061189702 lastPosDateTime 13:51 (het tijdstip van zijn eigen X-rapport), terwijl posDevices en fdmDevices in hetzelfde rapport R-events uitsluiten (13:41, teller 83). Intern tegenstrijdig; wij sluiten R overal uit (FAQ Q502). Q&A-vraag 12. |

✓* = geslaagd op de gedocumenteerde afwijking in de officiële data na (src/kassa/fiscal/__tests__/uc/known.ts).
