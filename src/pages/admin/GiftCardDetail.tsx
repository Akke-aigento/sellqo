import { useState } from 'react';
import { useIsCompact } from '@/hooks/use-mobile';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  ArrowLeft,
  CreditCard,
  MoreHorizontal,
  Mail,
  Ban,
  Settings,
  User,
  Calendar,
  Wallet,
  History,
  Check,
  Loader2,
} from 'lucide-react';
import { useGiftCard, useUpdateGiftCard } from '@/hooks/useGiftCards';
import { useSendGiftCardEmail } from '@/hooks/useGiftCards';
import { GiftCardBalanceDialog } from '@/components/admin/promotions/GiftCardBalanceDialog';
import { giftCardStatusInfo, type GiftCardStatus, type GiftCardTransactionType } from '@/types/giftCard';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

const transactionTypeLabels: Record<GiftCardTransactionType, { label: string; color: string }> = {
  purchase: { label: 'Aankoop', color: 'bg-green-100 text-green-800' },
  redeem: { label: 'Inwisseling', color: 'bg-blue-100 text-blue-800' },
  refund: { label: 'Terugbetaling', color: 'bg-orange-100 text-orange-800' },
  adjustment: { label: 'Aanpassing', color: 'bg-gray-100 text-gray-800' },
};

export default function GiftCardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCompact = useIsCompact();
  const { data: giftCard, isLoading } = useGiftCard(id);
  const updateGiftCard = useUpdateGiftCard();
  const sendEmail = useSendGiftCardEmail();

  const [showBalanceDialog, setShowBalanceDialog] = useState(false);

  const handleToggleStatus = async () => {
    if (!giftCard) return;
    const newStatus: GiftCardStatus = giftCard.status === 'active' ? 'disabled' : 'active';
    await updateGiftCard.mutateAsync({
      id: giftCard.id,
      formData: { status: newStatus },
    });
  };

  const handleResendEmail = async () => {
    if (!giftCard) return;
    if (!giftCard.recipient_email) {
      toast({
        title: 'Geen ontvanger email',
        description: 'Er is geen email adres ingesteld voor deze cadeaukaart',
        variant: 'destructive',
      });
      return;
    }
    await sendEmail.mutateAsync(giftCard.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!giftCard) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cadeaukaart niet gevonden</h2>
        <Button onClick={() => navigate('/admin/promotions/gift-cards')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar overzicht
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/promotions/gift-cards')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{giftCard.code}</h1>
            <Badge className={giftCardStatusInfo[giftCard.status].color}>
              {giftCardStatusInfo[giftCard.status].label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Aangemaakt op{' '}
            {format(new Date(giftCard.created_at), 'd MMMM yyyy', { locale: nl })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreHorizontal className="h-4 w-4 mr-2" />
              Acties
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowBalanceDialog(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Saldo aanpassen
            </DropdownMenuItem>
            {giftCard.recipient_email && (
              <DropdownMenuItem onClick={handleResendEmail} disabled={sendEmail.isPending}>
                {sendEmail.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {giftCard.email_sent_at ? 'Opnieuw verzenden' : 'Email verzenden'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleToggleStatus}
              className={giftCard.status === 'active' ? 'text-destructive' : 'text-green-600'}
            >
              <Ban className="h-4 w-4 mr-2" />
              {giftCard.status === 'active' ? 'Deactiveren' : 'Activeren'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Balance Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              €{Number(giftCard.current_balance).toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              van €{Number(giftCard.initial_balance).toFixed(2)} oorspronkelijk
            </p>
            {giftCard.expires_at && (
              <p className="text-sm text-orange-600 mt-2">
                Verloopt op {format(new Date(giftCard.expires_at), 'd MMM yyyy', { locale: nl })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recipient Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Ontvanger
            </CardDescription>
          </CardHeader>
          <CardContent>
            {giftCard.recipient_name || giftCard.recipient_email ? (
              <>
                {giftCard.recipient_name && (
                  <p className="font-medium">{giftCard.recipient_name}</p>
                )}
                {giftCard.recipient_email && (
                  <p className="text-sm text-muted-foreground">{giftCard.recipient_email}</p>
                )}
                {giftCard.email_sent_at && (
                  <div className="flex items-center gap-1 text-sm text-green-600 mt-2">
                    <Check className="h-3 w-3" />
                    Email verzonden
                    {giftCard.email_resent_count > 0 && ` (${giftCard.email_resent_count + 1}x)`}
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Geen ontvanger ingesteld</p>
            )}
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {giftCard.activated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Geactiveerd</span>
                <span>{format(new Date(giftCard.activated_at), 'd MMM yyyy', { locale: nl })}</span>
              </div>
            )}
            {giftCard.purchased_by_email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gekocht door</span>
                <span className="truncate max-w-[150px]">{giftCard.purchased_by_email}</span>
              </div>
            )}
            {giftCard.design && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ontwerp</span>
                <span>{giftCard.design.name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personal Message */}
      {giftCard.personal_message && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persoonlijk bericht</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="italic text-muted-foreground">"{giftCard.personal_message}"</p>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transactiegeschiedenis
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {giftCard.transactions && giftCard.transactions.length > 0 ? (
            <div className="min-w-[550px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Omschrijving</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead className="text-right">Saldo na</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {giftCard.transactions
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(tx.created_at), 'd MMM yyyy HH:mm', { locale: nl })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={transactionTypeLabels[tx.transaction_type].color}>
                          {transactionTypeLabels[tx.transaction_type].label}
                        </Badge>
                      </TableCell>
                      <TableCell>{tx.description || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.amount >= 0 ? '+' : ''}€{Number(tx.amount).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        €{Number(tx.balance_after).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              Nog geen transacties
            </p>
          )}
        </CardContent>
      </Card>

      <GiftCardBalanceDialog
        open={showBalanceDialog}
        onOpenChange={setShowBalanceDialog}
        giftCard={giftCard}
      />
    </div>
  );
}