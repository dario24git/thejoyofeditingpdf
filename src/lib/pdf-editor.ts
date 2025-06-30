import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: string;
  textTransform: string;
  lineHeight: number;
  letterSpacing: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  padding: number;
  confidence?: number;
  originalText?: string;
  pageNumber: number;
}

export interface FormField {
  id: string;
  type: 'text' | 'checkbox' | 'date';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  dateFormat?: string;
  pageNumber: number;
}

export class PDFEditor {
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private pdfDoc: any = null;
  private currentPage: number = 1;
  private totalPages: number = 0;
  public scale: number = 1.0;
  private textElements: TextElement[] = [];
  private formFields: FormField[] = [];
  public selectedElement: TextElement | null = null;
  public selectedFormField: FormField | null = null;
  private isModifyMode: boolean = false;
  private callbacks: any;
  private isPlacingField: boolean = false;
  private isPlacingTextBox: boolean = false;
  private pendingFieldConfig: any = null;
  private pendingTextBoxConfig: any = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, callbacks: any = {}) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.callbacks = callbacks;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;

    this.setupEventListeners();
  }

  async loadPDF(arrayBuffer: ArrayBuffer) {
    try {
      console.log('Loading PDF with PDF.js...');
      
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      });

      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;

      console.log(`PDF loaded successfully. Total pages: ${this.totalPages}`);
      
      await this.renderCurrentPage();
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error(`Failed to load PDF: ${error.message}`);
    }
  }

  async loadOCRData(ocrData: any[]) {
    console.log('Loading OCR data into editor...');
    
    this.textElements = [];
    
    for (const pageData of ocrData) {
      if (pageData.text_blocks && Array.isArray(pageData.text_blocks)) {
        for (const block of pageData.text_blocks) {
          const element: TextElement = {
            id: `ocr-${pageData.page_number}-${Math.random().toString(36).substr(2, 9)}`,
            text: block.text || '',
            x: block.boundingBox?.x || 0,
            y: block.boundingBox?.y || 0,
            width: block.boundingBox?.width || 100,
            height: block.boundingBox?.height || 20,
            fontSize: 14,
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            textAlign: 'left',
            textTransform: 'none',
            lineHeight: 1.2,
            letterSpacing: 0,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderStyle: 'none',
            padding: 2,
            confidence: block.confidence || 0,
            originalText: block.text || '',
            pageNumber: pageData.page_number
          };
          
          this.textElements.push(element);
        }
      }
    }
    
    console.log(`Loaded ${this.textElements.length} text elements from OCR data`);
    this.updateOverlay();
  }

  private async renderCurrentPage() {
    if (!this.pdfDoc) return;

    try {
      const page = await this.pdfDoc.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: this.scale });

      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;
      this.canvas.style.width = `${viewport.width}px`;
      this.canvas.style.height = `${viewport.height}px`;

      // Update overlay size
      this.overlay.style.width = `${viewport.width}px`;
      this.overlay.style.height = `${viewport.height}px`;

      const renderContext = {
        canvasContext: this.ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      this.updateOverlay();
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }

  private updateOverlay() {
    // Clear overlay
    this.overlay.innerHTML = '';

    // Render text elements for current page
    const currentPageElements = this.textElements.filter(el => el.pageNumber === this.currentPage);
    currentPageElements.forEach(element => {
      this.createTextElementDiv(element);
    });

    // Render form fields for current page
    const currentPageFields = this.formFields.filter(field => field.pageNumber === this.currentPage);
    currentPageFields.forEach(field => {
      this.createFormFieldDiv(field);
    });
  }

  private createTextElementDiv(element: TextElement) {
    const div = document.createElement('div');
    div.className = 'text-element';
    div.dataset.elementId = element.id;
    
    div.style.position = 'absolute';
    div.style.left = `${element.x}px`;
    div.style.top = `${element.y}px`;
    div.style.width = `${element.width}px`;
    div.style.height = `${element.height}px`;
    div.style.fontSize = `${element.fontSize}px`;
    div.style.fontFamily = element.fontFamily;
    div.style.color = element.color;
    div.style.fontWeight = element.fontWeight;
    div.style.fontStyle = element.fontStyle;
    div.style.textDecoration = element.textDecoration;
    div.style.textAlign = element.textAlign;
    div.style.textTransform = element.textTransform;
    div.style.lineHeight = element.lineHeight.toString();
    div.style.letterSpacing = `${element.letterSpacing}px`;
    div.style.backgroundColor = element.backgroundColor;
    div.style.borderColor = element.borderColor;
    div.style.borderWidth = `${element.borderWidth}px`;
    div.style.borderStyle = element.borderStyle;
    div.style.padding = `${element.padding}px`;
    div.style.cursor = this.isModifyMode ? 'pointer' : 'default';
    div.style.userSelect = 'none';
    div.style.overflow = 'hidden';
    div.style.wordWrap = 'break-word';
    
    div.textContent = element.text;

    if (this.isModifyMode) {
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectTextElement(element);
      });
    }

    this.overlay.appendChild(div);
  }

  private createFormFieldDiv(field: FormField) {
    const div = document.createElement('div');
    div.className = 'form-field';
    div.dataset.fieldId = field.id;
    
    div.style.position = 'absolute';
    div.style.left = `${field.x}px`;
    div.style.top = `${field.y}px`;
    div.style.width = `${field.width}px`;
    div.style.height = `${field.height}px`;
    div.style.border = '2px solid #3b82f6';
    div.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    div.style.cursor = this.isModifyMode ? 'pointer' : 'default';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.fontSize = '12px';
    div.style.color = '#3b82f6';
    div.style.fontWeight = 'bold';

    if (field.type === 'checkbox') {
      div.textContent = '☐';
      div.style.fontSize = '16px';
    } else {
      div.textContent = field.name;
    }

    if (this.isModifyMode) {
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectFormField(field);
      });
    }

    this.overlay.appendChild(div);
  }

  private setupEventListeners() {
    this.overlay.addEventListener('click', (e) => {
      if (this.isPlacingField && this.pendingFieldConfig) {
        this.placeFormField(e);
      } else if (this.isPlacingTextBox && this.pendingTextBoxConfig) {
        this.placeTextBox(e);
      } else if (this.isModifyMode) {
        this.clearSelection();
      }
    });
  }

  private placeFormField(e: MouseEvent) {
    if (!this.pendingFieldConfig) return;

    const rect = this.overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const field: FormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.pendingFieldConfig.type,
      name: this.pendingFieldConfig.name,
      x: x,
      y: y,
      width: this.pendingFieldConfig.width,
      height: this.pendingFieldConfig.height,
      dateFormat: this.pendingFieldConfig.dateFormat,
      pageNumber: this.currentPage
    };

    this.formFields.push(field);
    this.updateOverlay();
    this.cancelFieldPlacement();

    console.log('Form field placed:', field);
  }

  private placeTextBox(e: MouseEvent) {
    if (!this.pendingTextBoxConfig) return;

    const rect = this.overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const element: TextElement = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: this.pendingTextBoxConfig.text,
      x: x,
      y: y,
      width: this.pendingTextBoxConfig.width,
      height: this.pendingTextBoxConfig.height,
      fontSize: this.pendingTextBoxConfig.fontSize,
      fontFamily: this.pendingTextBoxConfig.fontFamily,
      color: this.pendingTextBoxConfig.color,
      fontWeight: this.pendingTextBoxConfig.fontWeight,
      fontStyle: this.pendingTextBoxConfig.fontStyle,
      textDecoration: this.pendingTextBoxConfig.textDecoration,
      textAlign: this.pendingTextBoxConfig.textAlign,
      textTransform: this.pendingTextBoxConfig.textTransform,
      lineHeight: this.pendingTextBoxConfig.lineHeight,
      letterSpacing: this.pendingTextBoxConfig.letterSpacing,
      backgroundColor: this.pendingTextBoxConfig.backgroundColor,
      borderColor: this.pendingTextBoxConfig.borderColor,
      borderWidth: this.pendingTextBoxConfig.borderWidth,
      borderStyle: this.pendingTextBoxConfig.borderStyle,
      padding: this.pendingTextBoxConfig.padding,
      pageNumber: this.currentPage
    };

    this.textElements.push(element);
    this.updateOverlay();
    this.cancelTextBoxPlacement();

    console.log('Text box placed:', element);
  }

  private selectTextElement(element: TextElement) {
    this.clearSelection();
    this.selectedElement = element;
    this.selectedFormField = null;
    
    // Highlight selected element
    const elementDiv = this.overlay.querySelector(`[data-element-id="${element.id}"]`) as HTMLElement;
    if (elementDiv) {
      elementDiv.style.outline = '2px solid #3b82f6';
    }

    if (this.callbacks.onElementSelect) {
      this.callbacks.onElementSelect(element);
    }
  }

  private selectFormField(field: FormField) {
    this.clearSelection();
    this.selectedFormField = field;
    this.selectedElement = null;
    
    // Highlight selected field
    const fieldDiv = this.overlay.querySelector(`[data-field-id="${field.id}"]`) as HTMLElement;
    if (fieldDiv) {
      fieldDiv.style.outline = '2px solid #ef4444';
    }

    if (this.callbacks.onFormFieldSelect) {
      this.callbacks.onFormFieldSelect(field);
    }
  }

  private clearSelection() {
    // Remove highlights
    this.overlay.querySelectorAll('.text-element').forEach(el => {
      (el as HTMLElement).style.outline = '';
    });
    this.overlay.querySelectorAll('.form-field').forEach(el => {
      (el as HTMLElement).style.outline = '';
    });

    this.selectedElement = null;
    this.selectedFormField = null;

    if (this.callbacks.onElementSelect) {
      this.callbacks.onElementSelect(null);
    }
    if (this.callbacks.onFormFieldSelect) {
      this.callbacks.onFormFieldSelect(null);
    }
  }

  // Public methods
  setModifyMode(enabled: boolean) {
    this.isModifyMode = enabled;
    this.updateOverlay();
    if (!enabled) {
      this.clearSelection();
    }
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  getTotalPages(): number {
    return this.totalPages;
  }

  async nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      await this.renderCurrentPage();
    }
  }

  async previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      await this.renderCurrentPage();
    }
  }

  async setScale(newScale: number) {
    this.scale = newScale;
    await this.renderCurrentPage();
  }

  updateSelectedElement(updates: Partial<TextElement>) {
    if (!this.selectedElement) return;

    Object.assign(this.selectedElement, updates);
    this.updateOverlay();
  }

  startFieldPlacement(fieldConfig: any) {
    this.isPlacingField = true;
    this.pendingFieldConfig = fieldConfig;
    this.overlay.style.cursor = 'crosshair';
  }

  startTextBoxPlacement(textBoxConfig: any) {
    this.isPlacingTextBox = true;
    this.pendingTextBoxConfig = textBoxConfig;
    this.overlay.style.cursor = 'crosshair';
  }

  cancelFieldPlacement() {
    this.isPlacingField = false;
    this.pendingFieldConfig = null;
    this.overlay.style.cursor = 'default';
  }

  cancelTextBoxPlacement() {
    this.isPlacingTextBox = false;
    this.pendingTextBoxConfig = null;
    this.overlay.style.cursor = 'default';
  }

  removeFormField(fieldId: string) {
    this.formFields = this.formFields.filter(field => field.id !== fieldId);
    this.updateOverlay();
  }

  removeTextElement(elementId: string) {
    this.textElements = this.textElements.filter(element => element.id !== elementId);
    this.updateOverlay();
  }

  async exportPDF(): Promise<Uint8Array> {
    // This would require pdf-lib to modify the PDF
    // For now, return the original PDF data
    throw new Error('PDF export not yet implemented');
  }
}