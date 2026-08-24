import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Settings,
  Ban,
  TrendingUp,
  Wallet,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useGiftCards, useGiftCardStats, useUpdateGiftCard } from '@/hooks/useGiftCards';
import { GiftCardFormDialog } from '@/components/admin/promotions/GiftCardFormDialog';
import { GiftCardBalanceDialog } from '@/components/admin/promotions/GiftCardBalanceDialog';
import { giftCardStatusInfo, type GiftCard, type GiftCardStatus } from '@/types/giftCard';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

export default function GiftCards() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { data: giftCards = [], isLoading } = useGiftCards();
  const { data: stats } = useGiftCardStats();
  const updateGiftCard = useUpdateGiftCard();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);

  const filteredCards = giftCards.filter((card) => {
    const matchesSearch =
      card.code.toLowerCase().includes(search.toLowerCase()) ||
      card.recipient_email?.toLowerCase().includes(search.toLowerCase()) ||
      card.recipient_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || card.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = async (card: GiftCard) => {
    const newStatus: GiftCardStatus = card.status === 'active' ? 'disabled' : 'active';
    await updateGiftCard.mutateAsync({
      id: card.id,
      formData: { status: newStatus },
    });
  };

  const maskCode = (code: string) => {
    const parts = code.split('-');
    if (parts.length >= 3) {
      return `${parts[0]}-${parts[1]}-****-${parts[parts.length - 1]}`;
    }
    return code;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8" />
            {t('admin.giftCards.cadeaukaarten')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.giftCards.beheer_digitale_cadeaukaarten_voor_je_webshop')}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.giftCards.nieuwe_cadeaukaart')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('admin.giftCards.totaal_uitgegeven')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              €{stats?.total_issued_amount.toFixed(2) || '0.00'}
            </p>
            <p className="text-sm text-muted-foreground">
              {stats?.total_issued || 0} kaarten
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t('admin.giftCards.openstaand_saldo')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              €{stats?.outstanding_balance.toFixed(2) || '0.00'}
            </p>
            <p className="text-sm text-muted-foreground">{t('admin.giftCards.nog_in_te_wisselen')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {t('admin.giftCards.ingewisseld')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              €{stats?.total_redeemed_amount.toFixed(2) || '0.00'}
            </p>
            <p className="text-sm text-muted-foreground">
              {stats?.depleted_count || 0} volledig opgebruikt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('admin.giftCards.actieve_kaarten')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.active_count || 0}</p>
            <p className="text-sm text-muted-foreground">
              {t('admin.giftCards.met_beschikbaar_saldo')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.giftCards.overzicht')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.giftCards.zoek_op_code_email_of_naam')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.marketing.contentHistoryList.alle_statussen')}</SelectItem>
                <SelectItem value="active">{t('admin.marketing.aBTestingPanel.actief')}</SelectItem>
                <SelectItem value="depleted">{t('admin.giftCards.opgebruikt')}</SelectItem>
                <SelectItem value="expired">{t('admin.giftCards.verlopen')}</SelectItem>
                <SelectItem value="disabled">{t('admin.giftCards.gedeactiveerd')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{t('admin.giftCards.geen_cadeaukaarten_gevonden')}</h3>
              <p className="text-muted-foreground mb-4">
                {search || statusFilter !== 'all'
                  ? t('admin.giftCards.pas_je_filters_aan') : t('admin.giftCards.maak_je_eerste_cadeaukaart_aan')}
              </p>
              {!search && statusFilter === 'all' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('admin.giftCards.nieuwe_cadeaukaart')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
            <div className="min-w-[650px] px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.products.productDescriptionEditor.code')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('admin.giftCards.ontvanger')}</TableHead>
                  <TableHead className="hidden md:table-cell text-right">{t('admin.giftCards.oorspronkelijk')}</TableHead>
                  <TableHead className="text-right">{t('admin.giftCards.saldo')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('admin.giftCards.aangemaakt')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {maskCode(card.code)}
                      </code>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {card.recipient_name || card.recipient_email || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      €{Number(card.initial_balance).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{Number(card.current_balance).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={giftCardStatusInfo[card.status].color}
                      >
                        {giftCardStatusInfo[card.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {format(new Date(card.created_at), 'd MMM yyyy', {
                        locale: dateLocale,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCard(card);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('admin.marketing.aIContentLibrary.bekijken')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCard(card);
                              setShowBalanceDialog(true);
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            {t('admin.promotions.giftCardBalanceDialog.saldo_aanpassen')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(card)}
                            className={
                              card.status === 'active'
                                ? 'text-destructive'
                                : 'text-green-600'
                            }
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            {card.status === 'active'
                              ? t('admin.products.bulk.bulkVisibilityTab.deactiveren') : t('admin.seo.scheduledAuditsPanel.activeren')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      <GiftCardFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <GiftCardBalanceDialog
        open={showBalanceDialog}
        onOpenChange={setShowBalanceDialog}
        giftCard={selectedCard}
      />
    </div>
  );
}
