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
import { nl } from 'date-fns/locale';

export default function GiftCards() {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
              Cadeaukaarten
            </h1>
            <p className="text-muted-foreground mt-1">
              Beheer digitale cadeaukaarten voor je webshop
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe cadeaukaart
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Totaal uitgegeven
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
                Openstaand saldo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                €{stats?.outstanding_balance.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-muted-foreground">Nog in te wisselen</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Ingewisseld
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
                Actieve kaarten
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.active_count || 0}</p>
              <p className="text-sm text-muted-foreground">
                Met beschikbaar saldo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Overzicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek op code, email of naam..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="active">Actief</SelectItem>
                  <SelectItem value="depleted">Opgebruikt</SelectItem>
                  <SelectItem value="expired">Verlopen</SelectItem>
                  <SelectItem value="disabled">Gedeactiveerd</SelectItem>
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
                <h3 className="text-lg font-medium">Geen cadeaukaarten gevonden</h3>
                <p className="text-muted-foreground mb-4">
                  {search || statusFilter !== 'all'
                    ? 'Pas je filters aan'
                    : 'Maak je eerste cadeaukaart aan'}
                </p>
                {!search && statusFilter === 'all' && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nieuwe cadeaukaart
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Ontvanger</TableHead>
                    <TableHead className="text-right">Oorspronkelijk</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aangemaakt</TableHead>
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
                      <TableCell>
                        {card.recipient_name || card.recipient_email || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
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
                      <TableCell className="text-muted-foreground">
                        {format(new Date(card.created_at), 'd MMM yyyy', {
                          locale: nl,
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
                                // TODO: Open detail dialog
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Bekijken
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCard(card);
                                setShowBalanceDialog(true);
                              }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Saldo aanpassen
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
                                ? 'Deactiveren'
                                : 'Activeren'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

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
