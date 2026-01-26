import { useState } from 'react';
import { Printer, Usb, Check, X, RefreshCw, AlertCircle, TestTube } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLabelPrinter, type LabelPrinter, type PrinterProtocol } from '@/hooks/useLabelPrinter';
import { useShippingIntegrations } from '@/hooks/useShippingIntegrations';

interface LabelPrinterSettingsProps {
  onSettingsChange?: (settings: LabelPrinterConfig) => void;
}

interface LabelPrinterConfig {
  enabled: boolean;
  vendorId?: number;
  productId?: number;
  protocol?: PrinterProtocol;
  labelFormat: 'a6' | '4x6' | 'brother_62mm';
  printMethod: 'webusb' | 'browser';
}

export function LabelPrinterSettings({ onSettingsChange }: LabelPrinterSettingsProps) {
  const {
    connectedPrinter,
    isConnected,
    isConnecting,
    isPrinting,
    isSupported,
    lastPrintTime,
    detectPrinters,
    connectPrinter,
    disconnectPrinter,
    testPrint,
  } = useLabelPrinter();

  const [labelFormat, setLabelFormat] = useState<'a6' | '4x6' | 'brother_62mm'>('a6');
  const [printMethod, setPrintMethod] = useState<'webusb' | 'browser'>('webusb');
  const [isDetecting, setIsDetecting] = useState(false);

  const handleDetectPrinters = async () => {
    setIsDetecting(true);
    try {
      const printers = await detectPrinters();
      if (printers.length > 0) {
        await connectPrinter(printers[0]);
        updateSettings(printers[0]);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectPrinter();
    onSettingsChange?.({
      enabled: false,
      labelFormat,
      printMethod,
    });
  };

  const updateSettings = (printer?: LabelPrinter) => {
    onSettingsChange?.({
      enabled: !!printer,
      vendorId: printer?.vendorId,
      productId: printer?.productId,
      protocol: printer?.protocol,
      labelFormat,
      printMethod,
    });
  };

  const handleLabelFormatChange = (value: 'a6' | '4x6' | 'brother_62mm') => {
    setLabelFormat(value);
    onSettingsChange?.({
      enabled: isConnected,
      vendorId: connectedPrinter?.vendorId,
      productId: connectedPrinter?.productId,
      protocol: connectedPrinter?.protocol,
      labelFormat: value,
      printMethod,
    });
  };

  const handlePrintMethodChange = (value: 'webusb' | 'browser') => {
    setPrintMethod(value);
    onSettingsChange?.({
      enabled: isConnected,
      vendorId: connectedPrinter?.vendorId,
      productId: connectedPrinter?.productId,
      protocol: connectedPrinter?.protocol,
      labelFormat,
      printMethod: value,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Labelprinter Instellingen
        </CardTitle>
        <CardDescription>
          Koppel een labelprinter voor direct printen vanuit Sellqo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Browser Support Warning */}
        {!isSupported && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              WebUSB wordt niet ondersteund in deze browser. 
              Gebruik Chrome of Edge voor directe printerfunctionaliteit.
              Je kunt nog steeds de browser print dialoog gebruiken.
            </AlertDescription>
          </Alert>
        )}

        {/* Connected Printer */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Gekoppelde Printer</Label>
          
          {isConnected && connectedPrinter ? (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{connectedPrinter.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                >
                  <X className="h-4 w-4 mr-1" />
                  Ontkoppelen
                </Button>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Verbonden
                  </Badge>
                </div>
                <div>
                  Protocol: <span className="font-mono uppercase">{connectedPrinter.protocol}</span>
                </div>
              </div>

              {lastPrintTime && (
                <div className="text-xs text-muted-foreground">
                  Laatste print: {lastPrintTime.toLocaleString('nl-NL')}
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-4 border-dashed">
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Usb className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Geen printer gekoppeld
                </p>
                <Button
                  onClick={handleDetectPrinters}
                  disabled={!isSupported || isDetecting || isConnecting}
                >
                  {isDetecting || isConnecting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Usb className="h-4 w-4 mr-2" />
                  )}
                  Detecteer Printers
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Label Format */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Labelformaat</Label>
          <RadioGroup
            value={labelFormat}
            onValueChange={handleLabelFormatChange}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="a6" id="format-a6" />
              <Label htmlFor="format-a6" className="flex-1 cursor-pointer">
                <div className="font-medium">A6 (105 × 148 mm)</div>
                <div className="text-sm text-muted-foreground">
                  Standaard verzendlabel - Meest gebruikt
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="4x6" id="format-4x6" />
              <Label htmlFor="format-4x6" className="flex-1 cursor-pointer">
                <div className="font-medium">4×6 inch (102 × 152 mm)</div>
                <div className="text-sm text-muted-foreground">
                  US standaard - Zebra printers
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="brother_62mm" id="format-brother" />
              <Label htmlFor="format-brother" className="flex-1 cursor-pointer">
                <div className="font-medium">Brother 62mm breed</div>
                <div className="text-sm text-muted-foreground">
                  Brother QL labelprinters
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Print Method */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Print methode</Label>
          <RadioGroup
            value={printMethod}
            onValueChange={handlePrintMethodChange}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem 
                value="webusb" 
                id="method-webusb" 
                disabled={!isSupported}
              />
              <Label 
                htmlFor="method-webusb" 
                className={`flex-1 cursor-pointer ${!isSupported ? 'opacity-50' : ''}`}
              >
                <div className="font-medium flex items-center gap-2">
                  Direct printen (WebUSB)
                  <Badge variant="secondary" className="text-xs">Aanbevolen</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Print direct zonder dialoog - Chrome/Edge vereist
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="browser" id="method-browser" />
              <Label htmlFor="method-browser" className="flex-1 cursor-pointer">
                <div className="font-medium">Browser print dialoog</div>
                <div className="text-sm text-muted-foreground">
                  Werkt in alle browsers - Print dialoog verschijnt
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Test Print */}
        {isConnected && (
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={testPrint}
              disabled={isPrinting}
              className="w-full"
            >
              {isPrinting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Print
            </Button>
          </div>
        )}

        {/* Supported Printers Info */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-medium mb-1">Ondersteunde printers:</p>
          <p>Zebra (ZPL), Dymo, Brother QL, TSC, Citizen, Epson</p>
        </div>
      </CardContent>
    </Card>
  );
}
