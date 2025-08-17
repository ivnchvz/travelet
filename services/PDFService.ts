import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface PDFDocument {
  id: string;
  name: string;
  dateAdded: string;
  fileSize: string;
  traveler: string;
  filePath: string;
  originalName: string;
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

class PDFService {
  private documentsDirectory: string;
  private categoriesFile: string;
  private isWeb: boolean;

  constructor() {
    this.isWeb = Platform.OS === 'web';
    
    if (this.isWeb) {
      this.documentsDirectory = 'web-storage';
      this.categoriesFile = 'categories.json';
      this.initializeWebStorage();
    } else {
      this.documentsDirectory = `${FileSystem.documentDirectory}PDFs/`;
      this.categoriesFile = `${this.documentsDirectory}categories.json`;
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
    if (typeof window !== 'undefined' && !localStorage.getItem('travelet-categories')) {
      localStorage.setItem('travelet-categories', JSON.stringify(this.getDefaultCategories()));
    }
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

  async getCategories(): Promise<PDFCategory[]> {
    try {
      if (this.isWeb) {
        const stored = localStorage.getItem('travelet-categories');
        return stored ? JSON.parse(stored) : this.getDefaultCategories();
      } else {
        const exists = await FileSystem.getInfoAsync(this.categoriesFile);
        if (!exists.exists) {
          return this.getDefaultCategories();
        }
        
        const content = await FileSystem.readAsStringAsync(this.categoriesFile, { encoding: FileSystem.EncodingType.UTF8 });
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading categories:', error);
      return this.getDefaultCategories();
    }
  }

  async saveCategories(categories: PDFCategory[]): Promise<void> {
    try {
      if (this.isWeb) {
        localStorage.setItem('travelet-categories', JSON.stringify(categories));
      } else {
        await FileSystem.writeAsStringAsync(this.categoriesFile, JSON.stringify(categories, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      }
    } catch (error) {
      console.error('Error saving categories:', error);
      throw error;
    }
  }

  async addDocument(
    categoryId: string,
    filePath: string,
    originalName: string,
    traveler: string
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

        // Create document object
        const document: PDFDocument = {
          id: timestamp.toString(),
          name: originalName.replace(`.${extension}`, ''),
          dateAdded: new Date().toISOString(),
          fileSize,
          traveler,
          filePath: newFilePath,
          originalName,
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
}

export default new PDFService();