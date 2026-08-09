import * as BarcodeService from '@/services/BarcodeService';
import { forgetPdfInsights } from '@/services/PDFTextService';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/** The scannable symbol found in a document, extracted once when it's added. */
export interface PDFBarcode {
  /** Filename inside the shared App Group barcodes directory. */
  file: string;
  /** `file://` URI of the cached crop. */
  uri: string;
  payload: string | null;
  /** e.g. "PDF417", "QR", "Aztec". */
  symbology: string;
  page: number;
}

/** Page one rendered as an image, for documents shown rather than scanned. */
export interface PDFPreview {
  file: string;
  uri: string;
  width: number;
  height: number;
}

export interface PDFDocument {
  id: string;
  name: string;
  dateAdded: string;
  fileSize: string;
  traveler: string;
  filePath: string;
  originalName: string;
  /** Absent on documents added before barcode extraction existed, and on
   *  documents that simply have no scannable symbol. */
  barcode?: PDFBarcode | null;
  /** Present on documents in a "show me" category, such as passports. */
  preview?: PDFPreview | null;
}

export interface PDFCategory {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
  documents: PDFDocument[];
}

/**
 * Categories whose documents are presented as images rather than searched for a
 * scannable code.
 */
const SHOWN_CATEGORY_IDS = new Set(['passports']);

class PDFService {
  private documentsDirectory: string;
  private categoriesFile: string;
  /** The content of the last save that completed, kept one generation back. */
  private categoriesBackupFile: string;
  /** Where a save is assembled before it is allowed to replace the real one. */
  private categoriesTempFile: string;
  private declareFile: string;
  private isWeb: boolean;

  constructor() {
    this.isWeb = Platform.OS === 'web';

    if (this.isWeb) {
      this.documentsDirectory = 'web-storage';
      this.categoriesFile = 'categories.json';
      this.categoriesBackupFile = 'categories.backup.json';
      this.categoriesTempFile = 'categories.writing.json';
      this.declareFile = 'declareItems.json';
      this.initializeWebStorage();
    } else {
      this.documentsDirectory = `${FileSystem.documentDirectory}PDFs/`;
      this.categoriesFile = `${this.documentsDirectory}categories.json`;
      this.categoriesBackupFile = `${this.documentsDirectory}categories.backup.json`;
      this.categoriesTempFile = `${this.documentsDirectory}categories.writing.json`;
      this.declareFile = `${this.documentsDirectory}declare.json`;
      this.initializeDirectories();
    }
  }

  private async initializeDirectories() {
    if (this.isWeb) return;

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.documentsDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.documentsDirectory, { intermediates: true });
      }

      const categoriesExist = await FileSystem.getInfoAsync(this.categoriesFile);
      if (!categoriesExist.exists) {
        await this.saveCategories(this.getDefaultCategories());
      }
    } catch (error) {
      console.error('Error initializing directories:', error);
    }
  }

  private initializeWebStorage() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const categories = localStorage.getItem('travelet-categories');
        const items = localStorage.getItem('travelet-declare-items');

        if (!categories) {
          localStorage.setItem('travelet-categories', JSON.stringify(this.getDefaultCategories()));
        }
        if (!items) {
          localStorage.setItem('travelet-declare-items', JSON.stringify([]));
        }
      }
    } catch (error) {
      console.error('Error initializing web storage:', error);
    }
  }

  /**
   * Rebases a stored path onto the container the app is running in *now*.
   *
   * iOS does not guarantee an app's container path stays the same across
   * updates or a restore from backup — the UUID in the middle can change. An
   * absolute path saved earlier then points at nothing, and every document in
   * the app becomes unreadable. The filename is the durable part; the directory
   * is resolved fresh each launch.
   */
  private resolveDocumentPath(filePath: string): string {
    if (this.isWeb || !filePath || filePath.startsWith('web://')) return filePath;

    const fileName = filePath.split('/').pop();
    if (!fileName) return filePath;

    return `${this.documentsDirectory}${fileName}`;
  }

  /** Applied on every read, so stale paths self-heal without a migration. */
  private resolveCategories(categories: PDFCategory[]): PDFCategory[] {
    if (this.isWeb) return categories;

    return categories.map((category) => ({
      ...category,
      documents: category.documents.map((document) => ({
        ...document,
        filePath: this.resolveDocumentPath(document.filePath),
        // The App Group container can move for the same reason.
        barcode: document.barcode
          ? { ...document.barcode, uri: BarcodeService.uriFor(document.barcode.file) ?? document.barcode.uri }
          : document.barcode,
        preview: document.preview
          ? { ...document.preview, uri: BarcodeService.uriFor(document.preview.file) ?? document.preview.uri }
          : document.preview,
      })),
    }));
  }

  private getDefaultCategories(): PDFCategory[] {
    return [
      {
        id: "evisas",
        name: "E-Visas",
        color: "#eff6ff",
        borderColor: "#bfdbfe",
        accentColor: "#dbeafe",
        textColor: "#1d4ed8",
        documents: [],
      },
      {
        id: "boarding-passes",
        name: "Boarding Passes",
        color: "#f0fdf4",
        borderColor: "#bbf7d0",
        accentColor: "#dcfce7",
        textColor: "#15803d",
        documents: [],
      },
      {
        id: "insurance",
        name: "Medical Insurance",
        color: "#faf5ff",
        borderColor: "#d8b4fe",
        accentColor: "#e9d5ff",
        textColor: "#7c3aed",
        documents: [],
      },
      {
        id: "passports",
        name: "Passports & IDs",
        color: "#fff1f2",
        borderColor: "#fecaca",
        accentColor: "#fecaca",
        textColor: "#dc2626",
        documents: [],
      },
      {
        id: "other",
        name: "Other Documents",
        color: "#fffbeb",
        borderColor: "#fde68a",
        accentColor: "#fef3c7",
        textColor: "#d97706",
        documents: [],
      },
    ];
  }

  /**
   * The shelf, from the first copy of it that is still readable.
   *
   * There are three copies to try because losing this file loses the whole
   * library: the PDFs stay on disk but nothing points at them any more, and an
   * empty shelf that then gets saved makes that permanent. So a fall back to
   * defaults is the last resort here rather than the first, and even that
   * gathers the documents back off the disk before it gives up.
   */
  async getCategories(): Promise<PDFCategory[]> {
    if (this.isWeb) {
      try {
        if (typeof localStorage === 'undefined') return this.getDefaultCategories();
        const stored = localStorage.getItem('travelet-categories');
        return stored ? JSON.parse(stored) : this.getDefaultCategories();
      } catch (error) {
        console.error('Error reading from localStorage:', error);
        return this.getDefaultCategories();
      }
    }

    const live = await this.readStore(this.categoriesFile, { quarantine: true });
    if (live) return this.resolveCategories(live);

    const backup = await this.readStore(this.categoriesBackupFile);
    if (backup) {
      console.warn('categories.json was unreadable; restored from the backup copy');
      // Promoted back to the live copy straight away: leaving the backup as the
      // only good one means the next ordinary save overwrites it.
      await this.writeStore(backup).catch(() => {});
      return this.resolveCategories(backup);
    }

    return this.resolveCategories(await this.rebuildFromDisk());
  }

  async saveCategories(categories: PDFCategory[]): Promise<void> {
    try {
      if (this.isWeb) {
        localStorage.setItem('travelet-categories', JSON.stringify(categories));
      } else {
        await this.writeStore(categories);
      }
    } catch (error) {
      console.error('Error saving categories:', error);
      throw error;
    }
  }

  /**
   * Reads one copy of the shelf, or reports that it is not usable.
   *
   * `null` covers both "not there" and "there but not JSON" on purpose — the
   * caller's next move is the same either way, which is to try the copy behind
   * it. A file that is present and unreadable is moved aside as it is found:
   * that stops the next save from writing over the evidence, and means the
   * corruption is dealt with once rather than rediscovered on every read.
   */
  private async readStore(
    path: string,
    { quarantine = false }: { quarantine?: boolean } = {}
  ): Promise<PDFCategory[] | null> {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;

      const content = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(content);
      // A truncated write can still parse — as an object, a number, anything.
      // The shelf is a list, and nothing else is worth handing back.
      if (!Array.isArray(parsed)) throw new Error('not a list of categories');

      return parsed as PDFCategory[];
    } catch (error) {
      console.error(`Could not read ${path}:`, error);
      if (quarantine) {
        await FileSystem.moveAsync({
          from: path,
          to: `${path}.corrupt-${Date.now()}`,
        }).catch(() => {});
      }
      return null;
    }
  }

  /**
   * Replaces the shelf in one step, and never leaves it half-written.
   *
   * The old version wrote the real file directly, so a kill mid-write — the
   * phone running out of room, the app being swiped away — truncated it, and
   * the truncated file read back as no library at all. Written somewhere else
   * first, checked that it reads back, and only then moved into place: the move
   * is a rename, which either happened or did not.
   *
   * The copy being replaced becomes the backup, so there is always one
   * generation to fall back to.
   */
  private async writeStore(categories: PDFCategory[]): Promise<void> {
    await FileSystem.writeAsStringAsync(
      this.categoriesTempFile,
      JSON.stringify(categories, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );

    // Proof that what reached the disk is what we meant to put there. Cheap
    // next to what it guards against, and it runs before anything is replaced,
    // so a failure here leaves the existing shelf untouched.
    if (!(await this.readStore(this.categoriesTempFile))) {
      throw new Error('categories failed to write cleanly');
    }

    await FileSystem.deleteAsync(this.categoriesBackupFile, { idempotent: true }).catch(() => {});
    // Moved rather than copied: it is being replaced in the same breath, and a
    // move cannot half-succeed the way a copy of a large file can.
    await FileSystem.moveAsync({ from: this.categoriesFile, to: this.categoriesBackupFile }).catch(
      () => {}
    );

    await FileSystem.deleteAsync(this.categoriesFile, { idempotent: true }).catch(() => {});
    await FileSystem.moveAsync({ from: this.categoriesTempFile, to: this.categoriesFile });
  }

  /**
   * Puts the documents still sitting on disk back on the shelf.
   *
   * Reached only when every copy of the index is gone. The PDFs themselves are
   * untouched by whatever happened to the index — they are separate files —
   * so an empty shelf here would be throwing away documents that are right
   * there. They come back without the names, travellers or categories they were
   * filed under, because that is exactly what the lost file held; a page image
   * on each card makes them identifiable enough to sort out by hand.
   */
  private async rebuildFromDisk(): Promise<PDFCategory[]> {
    const categories = this.getDefaultCategories();

    try {
      const names = await FileSystem.readDirectoryAsync(this.documentsDirectory);
      const pdfs = names.filter((name) => name.toLowerCase().endsWith('.pdf')).sort();
      if (pdfs.length === 0) return categories;

      const recovered: PDFDocument[] = [];
      for (const name of pdfs) {
        const filePath = `${this.documentsDirectory}${name}`;
        const info = (await FileSystem.getInfoAsync(filePath)) as FileSystem.FileInfo & {
          size?: number;
          modificationTime?: number;
        };
        if (!info.exists) continue;

        recovered.push({
          // The id is in the file name the app gave it; falling back to the
          // name itself keeps it unique either way.
          id: name.replace(/^doc_/, '').replace(/\.pdf$/i, '') || name,
          name: `Recovered ${recovered.length + 1}`,
          dateAdded: new Date((info.modificationTime ?? Date.now() / 1000) * 1000).toISOString(),
          fileSize: this.formatFileSize(info.size ?? 0),
          traveler: '',
          filePath,
          originalName: name,
        });
      }

      if (recovered.length === 0) return categories;

      console.warn(`Rebuilt the shelf from disk: ${recovered.length} document(s) recovered`);
      const other = categories.find((c) => c.id === 'other') ?? categories[categories.length - 1];
      other.documents = recovered;

      // Written now so the rescue survives however the app is closed next.
      await this.writeStore(categories).catch(() => {});
      return categories;
    } catch (error) {
      console.error('Could not rebuild the shelf from disk:', error);
      return categories;
    }
  }

  async addDocument(
    categoryId: string,
    filePath: string,
    originalName: string,
    traveler: string,
    /** Overrides the name taken from the file, set while importing. */
    displayName?: string
  ): Promise<PDFDocument> {
    try {
      const categories = await this.getCategories();
      const category = categories.find(c => c.id === categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      if (this.isWeb) {
        const document: PDFDocument = {
          id: Date.now().toString(),
          name: originalName.replace(/\.pdf$/i, ''),
          dateAdded: new Date().toISOString(),
          fileSize: 'Web Document',
          traveler,
          filePath: 'web://' + originalName,
          originalName,
        };

        category.documents.push(document);
        await this.saveCategories(categories);
        return document;
      } else {
        // Verify file exists
        const fileInfo = await FileSystem.getInfoAsync(filePath) as FileSystem.FileInfo & { size?: number };
        if (!fileInfo.exists) {
          throw new Error('File not found at specified path');
        }

        // Generate unique filename
        const timestamp = Date.now();
        const extension = originalName.split('.').pop() || 'pdf';
        const fileName = `doc_${timestamp}.${extension}`;
        const newFilePath = `${this.documentsDirectory}${fileName}`;

        // Copy file to app directory
        await FileSystem.copyAsync({ from: filePath, to: newFilePath });

        // Get file stats
        const stats = await FileSystem.getInfoAsync(newFilePath) as FileSystem.FileInfo & { size?: number };
        const fileSize = this.formatFileSize(stats.size || 0);

        const id = timestamp.toString();
        // Passports and IDs carry nothing a scanner wants, so they get a page
        // image instead of a Vision pass that would find nothing.
        const showsImage = SHOWN_CATEGORY_IDS.has(categoryId);

        // Extract once, here, rather than on every open: rasterising a page and
        // running Vision over it is far too slow to do while presenting a card.
        // `undefined` means the scan couldn't run, so the key is left off and
        // ensureBarcode() will retry.
        const barcode = showsImage ? null : await BarcodeService.extract(newFilePath, id);

        /**
         * A document with no code is one to look at.
         *
         * Only passports used to get a page image, so everything else without a
         * symbol — a hotel voucher, a museum ticket, a receipt — opened into the
         * text peek and then needed a whole PDF viewer to actually be read. A
         * rendered page is just an image: it pinches, pages and comes back
         * instantly once cached, which is the same route a passport already
         * takes. `null` is the deciding value, not falsy: `undefined` means the
         * scan never ran, and a document that might yet turn out to have a code
         * should not be committed to the image path.
         */
        const preview =
          showsImage || barcode === null
            ? await BarcodeService.preview(newFilePath, id)
            : undefined;

        // Create document object
        const document: PDFDocument = {
          id,
          name: displayName?.trim() || originalName.replace(`.${extension}`, ''),
          dateAdded: new Date().toISOString(),
          fileSize,
          traveler,
          filePath: newFilePath,
          originalName,
          ...(barcode !== undefined ? { barcode } : {}),
          ...(preview !== undefined ? { preview } : {}),
        };

        // Add to category
        category.documents.push(document);

        // Save updated categories
        await this.saveCategories(categories);

        return document;
      }
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async deleteDocument(categoryId: string, documentId: string): Promise<void> {
    try {
      const categories = await this.getCategories();
      const category = categories.find(c => c.id === categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      const documentIndex = category.documents.findIndex(d => d.id === documentId);
      if (documentIndex === -1) {
        throw new Error('Document not found');
      }

      const document = category.documents[documentIndex];

      if (!this.isWeb) {
        const fileInfo = await FileSystem.getInfoAsync(document.filePath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(document.filePath);
        }
        BarcodeService.remove(document.id);
        BarcodeService.removePreview(document.id);
        // The parse is cached on the path, so let go of it before the path is
        // free to be handed to a different file.
        forgetPdfInsights(document.filePath);
      }

      // Remove from category
      category.documents.splice(documentIndex, 1);

      // Save updated categories
      await this.saveCategories(categories);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async getDocument(categoryId: string, documentId: string): Promise<PDFDocument | null> {
    try {
      const categories = await this.getCategories();
      const category = categories.find(c => c.id === categoryId);

      if (!category) {
        return null;
      }

      return category.documents.find(d => d.id === documentId) || null;
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * Renames a document. Only the display name changes — the file on disk keeps
   * its generated name, so nothing that points at it has to be rewritten.
   */
  async renameDocument(documentId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const categories = await this.getCategories();
      const document = categories
        .flatMap((category) => category.documents)
        .find((candidate) => candidate.id === documentId);

      if (!document) return;

      document.name = trimmed;
      await this.saveCategories(categories);
    } catch (error) {
      console.error('Error renaming document:', error);
      throw error;
    }
  }

  /**
   * Whether a document should be shown as page images rather than as a code.
   *
   * Either it lives somewhere that never has a code to find, or it was scanned
   * and turned out not to have one. A document whose scan has not run yet
   * (`barcode === undefined`) is neither, and waits.
   */
  private wantsPreview(categoryId: string, document: PDFDocument): boolean {
    return SHOWN_CATEGORY_IDS.has(categoryId) || document.barcode === null;
  }

  /**
   * Gives page images to codeless documents already on the shelf.
   *
   * Documents added before this existed have `barcode: null` recorded, which is
   * exactly the value that stops ensureBarcode() from ever looking at them
   * again — so without a sweep they would keep opening into the text peek for
   * the life of the install.
   *
   * Rendered outside the store, then written back onto a fresh read. Rasterising
   * a whole shelf takes seconds, and holding the copy that was loaded at the
   * start across all of it means a document added in the meantime is erased by
   * the save at the end — the sweep would be writing a shelf that no longer
   * exists. Only the preview keys are carried over, onto whatever the shelf
   * looks like by the time the work is done.
   *
   * Returns how many were rendered, so the caller only reloads if something
   * actually changed.
   */
  async backfillPreviews(): Promise<number> {
    if (this.isWeb) return 0;

    try {
      const missing = (await this.getCategories()).flatMap((category) =>
        category.documents
          .filter((d) => d.preview === undefined && this.wantsPreview(category.id, d))
          .map((d) => ({ id: d.id, filePath: d.filePath }))
      );
      if (missing.length === 0) return 0;

      // `null` belongs in here as much as an image does: it means the render
      // ran and the document has no first page, which is an answer worth
      // keeping so the next sweep stops asking. Only `undefined` — a render
      // that could not run at all — is left out, to be retried.
      const rendered = new Map<string, PDFPreview | null>();
      for (const { id, filePath } of missing) {
        const preview = await BarcodeService.preview(filePath, id);
        if (preview !== undefined) rendered.set(id, preview);
      }
      if (rendered.size === 0) return 0;

      const categories = await this.getCategories();
      let applied = 0;
      for (const category of categories) {
        for (const document of category.documents) {
          // Anything set while we were rendering is the newer answer.
          if (!rendered.has(document.id) || document.preview !== undefined) continue;
          document.preview = rendered.get(document.id) ?? null;
          applied++;
        }
      }

      if (applied > 0) await this.saveCategories(categories);
      return applied;
    } catch (error) {
      console.error('Error backfilling previews:', error);
      return 0;
    }
  }

  /** Renders the page image for a document added before it would have had one. */
  async ensurePreview(documentId: string): Promise<PDFPreview | null> {
    if (this.isWeb) return null;

    try {
      const categories = await this.getCategories();
      const category = categories.find((c) => c.documents.some((d) => d.id === documentId));
      const document = category?.documents.find((d) => d.id === documentId);

      if (!category || !document) return null;
      if (!this.wantsPreview(category.id, document)) return null;
      if (document.preview !== undefined) return document.preview;

      const preview = await BarcodeService.preview(document.filePath, document.id);
      if (preview === undefined) return null;

      document.preview = preview;
      await this.saveCategories(categories);

      return preview;
    } catch (error) {
      console.error('Error backfilling preview:', error);
      return null;
    }
  }

  /**
   * Backfills the barcode for a document added before extraction existed.
   *
   * `barcode === undefined` means never attempted; `null` means attempted and
   * the document genuinely has no symbol. Only the former is retried, so a visa
   * isn't re-scanned every time it's opened.
   */
  async ensureBarcode(documentId: string): Promise<PDFBarcode | null> {
    if (this.isWeb) return null;

    try {
      const categories = await this.getCategories();
      const category = categories.find((c) => c.documents.some((d) => d.id === documentId));
      const document = category?.documents.find((d) => d.id === documentId);

      if (!category || !document) return null;
      if (document.barcode !== undefined) return document.barcode;

      const barcode = await BarcodeService.extract(document.filePath, document.id);

      // Only remember a result the scan actually produced; a failed scan stays
      // unset so it's retried instead of permanently reading as "no barcode".
      if (barcode === undefined) return null;

      document.barcode = barcode;

      // Nothing to scan means it is meant to be read, so it gets the page image
      // here too — otherwise a document that has just been found to be codeless
      // would still open into the text peek until something else backfilled it.
      if (barcode === null && document.preview === undefined) {
        const preview = await BarcodeService.preview(document.filePath, document.id);
        if (preview !== undefined) document.preview = preview;
      }

      await this.saveCategories(categories);

      return barcode;
    } catch (error) {
      console.error('Error backfilling barcode:', error);
      return null;
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async addCategory(name: string, color: string, borderColor: string, accentColor: string, textColor: string): Promise<PDFCategory> {
    try {
      const categories = await this.getCategories();

      const newCategory: PDFCategory = {
        id: `category_${Date.now()}`,
        name,
        color,
        borderColor,
        accentColor,
        textColor,
        documents: [],
      };

      categories.push(newCategory);
      await this.saveCategories(categories);

      return newCategory;
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const categories = await this.getCategories();
      const categoryIndex = categories.findIndex(c => c.id === categoryId);

      if (categoryIndex === -1) {
        throw new Error('Category not found');
      }

      const category = categories[categoryIndex];

      if (!this.isWeb) {
        for (const document of category.documents) {
          const fileInfo = await FileSystem.getInfoAsync(document.filePath);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(document.filePath);
          }
          BarcodeService.remove(document.id);
          BarcodeService.removePreview(document.id);
        BarcodeService.removePreview(document.id);
        }
      }

      // Remove category
      categories.splice(categoryIndex, 1);

      // Save updated categories
      await this.saveCategories(categories);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  async getDeclareItems(): Promise<string[]> {
    try {
      if (this.isWeb) {
        if (typeof localStorage !== 'undefined') {
          try {
            const stored = localStorage.getItem('travelet-declare-items');
            return stored ? JSON.parse(stored) : [];
          } catch (e) {
            console.error('Error reading declare items from localStorage:', e);
            return [];
          }
        }
        return [];
      } else {
        const exists = await FileSystem.getInfoAsync(this.declareFile);
        if (!exists.exists) {
          return [];
        }

        const content = await FileSystem.readAsStringAsync(this.declareFile, { encoding: FileSystem.EncodingType.UTF8 });
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading declare items:', error);
      return [];
    }
  }

  async saveDeclareItems(items: string[]): Promise<void> {
    try {
      if (this.isWeb) {
        localStorage.setItem('travelet-declare-items', JSON.stringify(items));
      } else {
        await FileSystem.writeAsStringAsync(this.declareFile, JSON.stringify(items, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      }
    } catch (error) {
      console.error('Error saving declare items:', error);
      throw error;
    }
  }
}

export default new PDFService();