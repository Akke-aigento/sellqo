import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useSyncHistory, type SyncActivityLog } from '@/hooks/useSyncHistory';
import type { SyncDataType } from '@/types/syncRules';

const LABELS: Record<SyncDataType, string> = {
  orders: 'Bestellingen',
  products: 'Producten',
  inventory: 'Voorraad',
  customers: 'Klanten',
  invoices: 'Facturen',
  returns: 'Retouren',
  shipments: 'Verzendingen',
  categories: 'Categorieën',
  taxes: 'BTW/Belastingen',
};

interface SyncLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
}

export function SyncLogDialog({
  open,
  onOpenChange,
  connectionId,
}: SyncLogDialogProps) {
  const [filterDataType, setFilterDataType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const { data: logs, isLoading } = useSyncHistory(connectionId, 50);

  const filteredLogs = logs?.filter((log) => {
    if (filterDataType !== 'all' && log.data_type !== filterDataType) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    return true;
  });

  const getStatusIcon = (status: SyncActivityLog['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getDirectionIcon = (direction: SyncActivityLog['direction']) => {
    switch (direction) {
      case 'import':
        return <ArrowDownToLine className="w-4 h-4 text-blue-500" />;
      case 'export':
        return <ArrowUpFromLine className="w-4 h-4 text-green-500" />;
      case 'bidirectional':
        return <ArrowLeftRight className="w-4 h-4 text-purple-500" />;
    }
  };

  const getDuration = (log: SyncActivityLog) => {
    if (!log.started_at) return '-';
    const start = new Date(log.started_at);
    const end = new Date(log.completed_at);
    const ms = end.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Synchronisatie Geschiedenis</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <Select value={filterDataType} onValueChange={setFilterDataType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter op type" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">Alle types</SelectItem>
              {Object.entries(LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter op status" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="success">Succesvol</SelectItem>
              <SelectItem value="partial">Gedeeltelijk</SelectItem>
              <SelectItem value="failed">Mislukt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-12">Richting</TableHead>
                  <TableHead className="text-right">Verwerkt</TableHead>
                  <TableHead className="text-right">Mislukt</TableHead>
                  <TableHead>Duur</TableHead>
                  <TableHead>Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{getStatusIcon(log.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{LABELS[log.data_type]}</Badge>
                    </TableCell>
                    <TableCell>{getDirectionIcon(log.direction)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {log.records_processed}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {log.records_failed > 0 ? (
                        <span className="text-red-500">{log.records_failed}</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {getDuration(log)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(log.completed_at), 'dd MMM HH:mm', {
                        locale: nl,
                      })}
                    </TableCell>
                  </TableRow>
                ))}

                {(!filteredLogs || filteredLogs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">
                        Geen synchronisaties gevonden
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
