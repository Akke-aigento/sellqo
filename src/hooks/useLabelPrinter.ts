import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

// Extend Navigator interface for WebUSB
declare global {
  interface Navigator {
    usb?: {
      getDevices(): Promise<USBDevice[]>;
      requestDevice(options: { filters: { vendorId: number }[] }): Promise<USBDevice>;
    };
  }

  interface USBDevice {
    vendorId: number;
    productId: number;
    productName?: string;
    opened: boolean;
    configuration: USBConfiguration | null;
    configurations: USBConfiguration[];
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: ArrayBuffer | ArrayBufferView): Promise<USBOutTransferResult>;
  }

  interface USBConfiguration {
    configurationValue: number;
    interfaces: USBInterface[];
  }

  interface USBInterface {
    interfaceNumber: number;
    alternate: USBAlternateInterface;
  }

  interface USBAlternateInterface {
    endpoints: USBEndpoint[];
  }

  interface USBEndpoint {
    endpointNumber: number;
    direction: 'in' | 'out';
  }

  interface USBOutTransferResult {
    bytesWritten: number;
    status: 'ok' | 'stall' | 'babble';
  }
}

// Known USB Vendor IDs for label printers
const PRINTER_VENDORS = {
  ZEBRA: 0x0A5F,
  DYMO: 0x0922,
  BROTHER: 0x04F9,
  TSC: 0x1203,
  CITIZEN: 0x1D90,
  EPSON: 0x04B8,
};

export type PrinterProtocol = 'zpl' | 'epl' | 'raw' | 'tspl' | 'escp';

export interface LabelPrinter {
  id: string;
  name: string;
  vendorId: number;
  productId: number;
  protocol: PrinterProtocol;
  device?: USBDevice;
}

export interface LabelPrinterConfig {
  enabled: boolean;
  vendorId?: number;
  productId?: number;
  protocol?: PrinterProtocol;
  labelFormat?: 'a6' | '4x6' | 'brother_62mm';
  printMethod?: 'webusb' | 'browser';
}

interface PrintOptions {
  copies?: number;
  labelFormat?: 'a6' | '4x6' | 'brother_62mm';
}

// Detect printer brand from vendor ID
function getPrinterBrand(vendorId: number): string {
  switch (vendorId) {
    case PRINTER_VENDORS.ZEBRA: return 'Zebra';
    case PRINTER_VENDORS.DYMO: return 'Dymo';
    case PRINTER_VENDORS.BROTHER: return 'Brother';
    case PRINTER_VENDORS.TSC: return 'TSC';
    case PRINTER_VENDORS.CITIZEN: return 'Citizen';
    case PRINTER_VENDORS.EPSON: return 'Epson';
    default: return 'Onbekend';
  }
}

// Determine protocol based on vendor
function getDefaultProtocol(vendorId: number): PrinterProtocol {
  switch (vendorId) {
    case PRINTER_VENDORS.ZEBRA: return 'zpl';
    case PRINTER_VENDORS.TSC: return 'tspl';
    case PRINTER_VENDORS.EPSON: return 'escp';
    default: return 'raw';
  }
}

export function useLabelPrinter() {
  const { toast } = useToast();
  const [connectedPrinter, setConnectedPrinter] = useState<LabelPrinter | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastPrintTime, setLastPrintTime] = useState<Date | null>(null);

  // Check if WebUSB is supported
  const isSupported = typeof navigator !== 'undefined' && 'usb' in navigator;

  // Check for previously connected devices on mount
  useEffect(() => {
    if (!isSupported) return;

    const checkPreviousDevices = async () => {
      try {
        const devices = await navigator.usb.getDevices();
        if (devices.length > 0) {
          const device = devices[0];
          const printer: LabelPrinter = {
            id: `${device.vendorId}-${device.productId}`,
            name: device.productName || `${getPrinterBrand(device.vendorId)} Printer`,
            vendorId: device.vendorId,
            productId: device.productId,
            protocol: getDefaultProtocol(device.vendorId),
            device,
          };
          setConnectedPrinter(printer);
        }
      } catch (error) {
        console.error('Error checking previous devices:', error);
      }
    };

    checkPreviousDevices();
  }, [isSupported]);

  // Detect available printers
  const detectPrinters = useCallback(async (): Promise<LabelPrinter[]> => {
    if (!isSupported) {
      toast({
        title: 'WebUSB niet ondersteund',
        description: 'Gebruik Chrome of Edge voor directe printerfunctionaliteit.',
        variant: 'destructive',
      });
      return [];
    }

    try {
      // Request access to any USB device matching our printer vendors
      const device = await navigator.usb.requestDevice({
        filters: Object.values(PRINTER_VENDORS).map(vendorId => ({ vendorId })),
      });

      const printer: LabelPrinter = {
        id: `${device.vendorId}-${device.productId}`,
        name: device.productName || `${getPrinterBrand(device.vendorId)} Printer`,
        vendorId: device.vendorId,
        productId: device.productId,
        protocol: getDefaultProtocol(device.vendorId),
        device,
      };

      return [printer];
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        // User cancelled the picker
        return [];
      }
      console.error('Error detecting printers:', error);
      toast({
        title: 'Printer detectie mislukt',
        description: (error as Error).message,
        variant: 'destructive',
      });
      return [];
    }
  }, [isSupported, toast]);

  // Connect to a specific printer
  const connectPrinter = useCallback(async (printer: LabelPrinter): Promise<boolean> => {
    if (!printer.device) {
      toast({
        title: 'Geen apparaat',
        description: 'Printer apparaat niet gevonden.',
        variant: 'destructive',
      });
      return false;
    }

    setIsConnecting(true);

    try {
      const device = printer.device;

      if (!device.opened) {
        await device.open();
      }

      // Select the first configuration if available
      if (device.configuration === null && device.configurations.length > 0) {
        await device.selectConfiguration(device.configurations[0].configurationValue);
      }

      // Claim the first interface
      if (device.configuration && device.configuration.interfaces.length > 0) {
        const interfaceNumber = device.configuration.interfaces[0].interfaceNumber;
        await device.claimInterface(interfaceNumber);
      }

      setConnectedPrinter(printer);
      toast({
        title: 'Printer verbonden',
        description: `${printer.name} is succesvol gekoppeld.`,
      });

      return true;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      toast({
        title: 'Verbinding mislukt',
        description: (error as Error).message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  // Disconnect the current printer
  const disconnectPrinter = useCallback(async (): Promise<void> => {
    if (!connectedPrinter?.device) return;

    try {
      if (connectedPrinter.device.opened) {
        await connectedPrinter.device.close();
      }
      setConnectedPrinter(null);
      toast({
        title: 'Printer ontkoppeld',
        description: 'De printer is losgekoppeld.',
      });
    } catch (error) {
      console.error('Error disconnecting printer:', error);
    }
  }, [connectedPrinter, toast]);

  // Send raw data to printer
  const sendToPrinter = useCallback(async (data: Uint8Array): Promise<boolean> => {
    if (!connectedPrinter?.device) {
      toast({
        title: 'Geen printer',
        description: 'Koppel eerst een printer.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const device = connectedPrinter.device;

      if (!device.opened) {
        await device.open();
        if (device.configuration === null) {
          await device.selectConfiguration(1);
        }
        await device.claimInterface(0);
      }

      // Find the OUT endpoint
      const iface = device.configuration?.interfaces[0];
      const endpoint = iface?.alternate.endpoints.find(e => e.direction === 'out');
      
      // Convert to ArrayBuffer to ensure compatibility
      const buffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(buffer).set(data);

      if (endpoint) {
        await device.transferOut(endpoint.endpointNumber, buffer);
      } else {
        // Fallback: try control transfer or endpoint 1
        await device.transferOut(1, buffer);
      }

      return true;
    } catch (error) {
      console.error('Error sending to printer:', error);
      throw error;
    }
  }, [connectedPrinter, toast]);

  // Print a label from PDF URL
  const printLabel = useCallback(async (
    pdfUrl: string,
    options?: PrintOptions
  ): Promise<boolean> => {
    setIsPrinting(true);

    try {
      // If we have a connected WebUSB printer, try direct printing
      if (connectedPrinter?.device) {
        // Fetch the PDF
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error('Label ophalen mislukt');
        }

        const pdfBytes = new Uint8Array(await response.arrayBuffer());
        
        // Send directly to printer (most label printers accept raw PDF or image data)
        const success = await sendToPrinter(pdfBytes);
        
        if (success) {
          setLastPrintTime(new Date());
          toast({
            title: 'Label geprint',
            description: 'Het label is naar de printer gestuurd.',
          });
          return true;
        }
      }

      // Fallback: open browser print dialog
      return printViaBrowser(pdfUrl);
    } catch (error) {
      console.error('Error printing label:', error);
      toast({
        title: 'Printen mislukt',
        description: (error as Error).message,
        variant: 'destructive',
      });
      
      // Try browser fallback
      return printViaBrowser(pdfUrl);
    } finally {
      setIsPrinting(false);
    }
  }, [connectedPrinter, sendToPrinter, toast]);

  // Browser print fallback
  const printViaBrowser = useCallback((pdfUrl: string): boolean => {
    try {
      // Create an iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = pdfUrl;

      iframe.onload = () => {
        try {
          iframe.contentWindow?.print();
          // Remove iframe after print dialog closes
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (e) {
          // If same-origin policy blocks printing, open in new tab
          window.open(pdfUrl, '_blank');
          document.body.removeChild(iframe);
        }
      };

      document.body.appendChild(iframe);
      setLastPrintTime(new Date());
      return true;
    } catch (error) {
      // Final fallback: just open the PDF
      window.open(pdfUrl, '_blank');
      return true;
    }
  }, []);

  // Print raw data directly (for ZPL, TSPL, etc.)
  const printRaw = useCallback(async (data: string | Uint8Array): Promise<boolean> => {
    setIsPrinting(true);

    try {
      const bytes = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

      const success = await sendToPrinter(bytes);
      
      if (success) {
        setLastPrintTime(new Date());
        toast({
          title: 'Data verstuurd',
          description: 'De printdata is naar de printer gestuurd.',
        });
      }

      return success;
    } catch (error) {
      console.error('Error printing raw data:', error);
      toast({
        title: 'Printen mislukt',
        description: (error as Error).message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsPrinting(false);
    }
  }, [sendToPrinter, toast]);

  // Test print
  const testPrint = useCallback(async (): Promise<boolean> => {
    if (!connectedPrinter) {
      toast({
        title: 'Geen printer',
        description: 'Koppel eerst een printer om een testprint te maken.',
        variant: 'destructive',
      });
      return false;
    }

    // Create a simple test label based on protocol
    let testData: string;

    switch (connectedPrinter.protocol) {
      case 'zpl':
        testData = `
^XA
^FO50,50^A0N,50,50^FDSellqo Test Label^FS
^FO50,120^A0N,30,30^FDPrinter: ${connectedPrinter.name}^FS
^FO50,160^A0N,30,30^FD${new Date().toLocaleString('nl-NL')}^FS
^FO50,220^BY3,2,80^BCN,,Y,N^FDTESTPRINt^FS
^XZ
        `.trim();
        break;
      case 'tspl':
        testData = `
SIZE 100 mm, 150 mm
GAP 3 mm, 0 mm
CLS
TEXT 50,50,"4",0,1,1,"Sellqo Test Label"
TEXT 50,100,"3",0,1,1,"Printer: ${connectedPrinter.name}"
TEXT 50,140,"3",0,1,1,"${new Date().toLocaleString('nl-NL')}"
BARCODE 50,200,"128",80,1,0,2,2,"TESTPRINT"
PRINT 1
        `.trim();
        break;
      default:
        testData = `Sellqo Test Label\n${connectedPrinter.name}\n${new Date().toLocaleString('nl-NL')}\n`;
    }

    return printRaw(testData);
  }, [connectedPrinter, printRaw, toast]);

  return {
    // State
    connectedPrinter,
    isConnected: !!connectedPrinter,
    isConnecting,
    isPrinting,
    isSupported,
    lastPrintTime,

    // Actions
    detectPrinters,
    connectPrinter,
    disconnectPrinter,
    printLabel,
    printViaBrowser,
    printRaw,
    testPrint,

    // Constants
    PRINTER_VENDORS,
  };
}
