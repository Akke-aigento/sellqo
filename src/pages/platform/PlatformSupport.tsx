import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Send,
  Link2,
  ShoppingBag,
  ExternalLink,
  Check,
  X,
  Trash2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  useSupportTickets, 
  useSupportMessages, 
  SupportTicket, 
  TicketStatus, 
  TicketPriority 
} from "@/hooks/useSupportTickets";
import { useShopifyRequestsAdmin, ShopifyConnectionRequest } from "@/hooks/useShopifyRequests";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In behandeling', color: 'bg-yellow-100 text-yellow-800' },
  waiting: { label: 'Wachtend', color: 'bg-purple-100 text-purple-800' },
  resolved: { label: 'Opgelost', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Gesloten', color: 'bg-gray-100 text-gray-800' },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Laag', color: 'bg-gray-100 text-gray-800' },
  medium: { label: 'Normaal', color: 'bg-blue-100 text-blue-800' },
  high: { label: 'Hoog', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
};

export default function PlatformSupport() {
  const { tickets, isLoading, createTicket, updateTicket, deleteTicket, getTicketStats, isCreating } = useSupportTickets();
  const [searchParams] = useSearchParams();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    requester_email: "",
    requester_name: "",
    subject: "",
    category: "other" as const,
    priority: "medium" as const,
  });

  const ticketIdFromUrl = searchParams.get('ticket');

  // Auto-select ticket from URL parameter
  useEffect(() => {
    if (ticketIdFromUrl && tickets.length > 0 && !selectedTicket) {
      const ticket = tickets.find(t => t.id === ticketIdFromUrl);
      if (ticket) {
        setSelectedTicket(ticket);
      }
    }
  }, [ticketIdFromUrl, tickets, selectedTicket]);

  const stats = getTicketStats();

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = !searchQuery || 
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.requester_email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateTicket = async () => {
    await createTicket(newTicket);
    setNewTicket({
      requester_email: "",
      requester_name: "",
      subject: "",
      category: "other",
      priority: "medium",
    });
    setIsCreateOpen(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Inbox</h1>
          <p className="text-muted-foreground">Beheer klantvragen en tickets</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nieuw Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuw Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    value={newTicket.requester_email}
                    onChange={(e) => setNewTicket({ ...newTicket, requester_email: e.target.value })}
                    placeholder="klant@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Naam</Label>
                  <Input
                    value={newTicket.requester_name}
                    onChange={(e) => setNewTicket({ ...newTicket, requester_name: e.target.value })}
                    placeholder="Klantnaam"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Onderwerp *</Label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Onderwerp van de vraag"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categorie</Label>
                  <Select value={newTicket.category} onValueChange={(v: any) => setNewTicket({ ...newTicket, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="billing">Facturatie</SelectItem>
                      <SelectItem value="technical">Technisch</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="integration">Integratie</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="other">Overig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioriteit</Label>
                  <Select value={newTicket.priority} onValueChange={(v: any) => setNewTicket({ ...newTicket, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Laag</SelectItem>
                      <SelectItem value="medium">Normaal</SelectItem>
                      <SelectItem value="high">Hoog</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateTicket} disabled={isCreating || !newTicket.requester_email || !newTicket.subject}>
                Ticket Aanmaken
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("open")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Open</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.open}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("in_progress")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">In behandeling</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("waiting")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Wachtend</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.waiting}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("resolved")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Opgelost</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.resolved}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 border-red-200" onClick={() => setStatusFilter("all")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Urgent</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.urgent}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoeken..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredTickets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Geen tickets gevonden</p>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedTicket?.id === ticket.id ? 'bg-muted border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ticket.subject}</p>
                          <p className="text-sm text-muted-foreground truncate">{ticket.requester_email}</p>
                        </div>
                        <Badge className={PRIORITY_CONFIG[ticket.priority].color}>
                          {PRIORITY_CONFIG[ticket.priority].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={STATUS_CONFIG[ticket.status].color}>
                          {STATUS_CONFIG[ticket.status].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), 'd MMM', { locale: nl })}
                        </span>
                        {ticket.message_count && ticket.message_count > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {ticket.message_count}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Ticket Detail */}
        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <TicketDetail 
              ticket={selectedTicket} 
              onUpdate={updateTicket}
              onDelete={async (ticketId) => {
                await deleteTicket(ticketId);
                setSelectedTicket(null);
              }}
            />
          ) : (
            <CardContent className="flex items-center justify-center h-[600px]">
              <p className="text-muted-foreground">Selecteer een ticket om details te bekijken</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function TicketDetail({ ticket, onUpdate, onDelete }: { 
  ticket: SupportTicket; 
  onUpdate: (data: any) => Promise<any>;
  onDelete: (ticketId: string) => Promise<void>;
}) {
  const { messages, isLoading, addMessage, isAdding } = useSupportMessages(ticket.id);
  const [newMessage, setNewMessage] = useState("");

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    await addMessage({
      ticket_id: ticket.id,
      sender_type: 'support',
      message: newMessage,
    });
    setNewMessage("");
  };

  const handleStatusChange = async (status: TicketStatus) => {
    await onUpdate({ id: ticket.id, status });
  };

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{ticket.subject}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Van: {ticket.requester_name || ticket.requester_email}
              {ticket.tenant && ` (${ticket.tenant.name})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={ticket.status} onValueChange={(v: TicketStatus) => handleStatusChange(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In behandeling</SelectItem>
                <SelectItem value="waiting">Wachtend</SelectItem>
                <SelectItem value="resolved">Opgelost</SelectItem>
                <SelectItem value="closed">Gesloten</SelectItem>
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ticket verwijderen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dit verwijdert het ticket en alle bijbehorende berichten permanent. Deze actie kan niet ongedaan worden gemaakt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(ticket.id)}>
                    Verwijderen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col h-[500px]">
        {/* Integration Context for Shopify requests */}
        {ticket.related_resource_type === 'shopify_connection_request' && ticket.related_resource_id && (
          <IntegrationContext 
            resourceType={ticket.related_resource_type} 
            resourceId={ticket.related_resource_id}
            ticketId={ticket.id}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Laden...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nog geen berichten</p>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.sender_type === 'support' 
                      ? 'bg-primary/10 ml-8' 
                      : msg.sender_type === 'system' || msg.sender_type === 'ai'
                      ? 'bg-muted text-center'
                      : 'bg-muted mr-8'
                  } ${msg.is_internal_note ? 'border-2 border-dashed border-yellow-400' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {msg.sender_type === 'merchant' ? 'Klant' : msg.sender_type === 'support' ? 'Support' : msg.sender_type}
                    </Badge>
                    {msg.is_internal_note && <Badge variant="secondary" className="text-xs">Interne notitie</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(msg.created_at), 'HH:mm, d MMM', { locale: nl })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Reply Input */}
        <div className="mt-4 flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Typ een antwoord..."
            className="flex-1"
            rows={2}
          />
          <Button onClick={handleSendMessage} disabled={isAdding || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </>
  );
}

// IntegrationContext component for Shopify requests
function IntegrationContext({ 
  resourceType, 
  resourceId, 
  ticketId,
  onStatusChange 
}: { 
  resourceType: string; 
  resourceId: string;
  ticketId: string;
  onStatusChange: (status: TicketStatus) => Promise<void>;
}) {
  const { updateRequest } = useShopifyRequestsAdmin();
  const [installLink, setInstallLink] = useState("");
  const [showInstallInput, setShowInstallInput] = useState(false);

  // Fetch the Shopify request details
  const { data: shopifyRequest, isLoading, refetch } = useQuery({
    queryKey: ['shopify-request', resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_connection_requests')
        .select('*')
        .eq('id', resourceId)
        .single();
      
      if (error) throw error;
      return data as ShopifyConnectionRequest;
    },
    enabled: !!resourceId,
  });

  if (isLoading) {
    return <div className="mb-4 p-4 border rounded-lg bg-muted/50">Laden...</div>;
  }

  if (!shopifyRequest) {
    return null;
  }

  const statusLabels: Record<string, string> = {
    pending: 'In afwachting',
    in_review: 'In behandeling',
    approved: 'Goedgekeurd',
    completed: 'Voltooid',
    rejected: 'Afgewezen',
  };

  const handleApprove = async () => {
    await onStatusChange('resolved');
    refetch();
  };

  const handleReject = async () => {
    await onStatusChange('closed');
    refetch();
  };

  const handleAddInstallLink = async () => {
    if (!installLink.trim()) return;
    await updateRequest.mutateAsync({
      id: resourceId,
      install_link: installLink,
    });
    setShowInstallInput(false);
    setInstallLink("");
    refetch();
  };

  return (
    <div className="mb-4 p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingBag className="h-5 w-5 text-green-600" />
        <span className="font-semibold text-green-800 dark:text-green-200">Integratie Details</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <span className="text-muted-foreground">Type:</span>
          <p className="font-medium">Shopify Connection Request</p>
        </div>
        <div>
          <span className="text-muted-foreground">Store:</span>
          <p className="font-medium">{shopifyRequest.store_name}.myshopify.com</p>
        </div>
        <div>
          <span className="text-muted-foreground">Status aanvraag:</span>
          <Badge variant="outline" className="ml-2">{statusLabels[shopifyRequest.status] || shopifyRequest.status}</Badge>
        </div>
        {shopifyRequest.install_link && (
          <div>
            <span className="text-muted-foreground">Install Link:</span>
            <a 
              href={shopifyRequest.install_link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 text-primary hover:underline flex items-center gap-1"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {!shopifyRequest.install_link && !showInstallInput && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowInstallInput(true)}
          >
            <Link2 className="h-4 w-4 mr-1" />
            Installatie Link
          </Button>
        )}

        {showInstallInput && (
          <div className="flex gap-2 w-full">
            <Input
              placeholder="https://..."
              value={installLink}
              onChange={(e) => setInstallLink(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={handleAddInstallLink}>Opslaan</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowInstallInput(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {shopifyRequest.status !== 'approved' && shopifyRequest.status !== 'completed' && shopifyRequest.status !== 'rejected' && (
          <>
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
            >
              <Check className="h-4 w-4 mr-1" />
              Goedkeuren
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleReject}
            >
              <X className="h-4 w-4 mr-1" />
              Afwijzen
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
