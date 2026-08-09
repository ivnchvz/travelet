import { requireOptionalNativeModule } from 'expo-modules-core';

export interface ExtractedBarcode {
  /** Filename inside the shared App Group barcodes directory. */
  file: string;
  /** `file://` URI, usable directly as an <Image> source. */
  uri: string;
  /** Decoded contents, when the symbol carried readable text. */
  payload: string | null;
  /** e.g. "PDF417", "QR", "Aztec". */
  symbology: string;
  /** Zero-based page the symbol was found on. */
  page: number;
}

export interface DocumentPreview {
  file: string;
  uri: string;
  width: number;
  height: number;
}

export interface TraveletBarcodeModule {
  preview(filePath: string, documentId: string): Promise<DocumentPreview | null>;
  pages(filePath: string, documentId: string): Promise<DocumentPreview[]>;
  removePreview(documentId: string): void;
  extract(filePath: string, documentId: string): Promise<ExtractedBarcode | null>;
  /** Current `file://` URI for a cached crop, resolved against today's container. */
  uriFor(file: string): string | null;
  remove(documentId: string): void;
}

/** `null` on Android, web, and in Expo Go. */
export default requireOptionalNativeModule<TraveletBarcodeModule>('TraveletBarcode');
