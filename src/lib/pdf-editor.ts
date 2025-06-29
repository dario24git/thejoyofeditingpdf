import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontFamily: string;
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
  pageNumber: number;
  confidence?: number;
  originalText?: string;
  isCustomText?: boolean;
}

export interface FormField {
  id: string;
  type: 'text' | 'checkbox' | 'date';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  pageNumber: number;
  dateFormat?: string;
}

export class PDFEditor {
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private pdfDocument: any = null;
  private currentPage: number = 1;
  private totalPages: number = 0;
  public scale: number = 1.0;
  private textElements: TextElement[] = [];
  private formFields: FormField[] = [];
  public selectedElement: TextElement | null = null;
  public selectedFormField: FormField | null = null;
  private isModifyMode: boolean = false;
  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private resizeHandle: string = '';
  private onElementSelect?: (element: TextElement | null) => void;
  private onFormFieldSelect?: (field: FormField | null) => void;
  
  // Text box placement state
  private isPlacingTextBox: boolean = false;
  private pendingTextBoxConfig: any = null;
  
  // Form field placement state
  private isPlacingField: boolean = false;
  private pendingFieldConfig: any = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, options: {
    onElementSelect?: (element: TextElement | null) => void;
    onFormFieldSelect?: (field: FormField | null) => void;
  } = {}) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.onElementSelect = options.onElementSelect;
    this.onFormFieldSelect = options.onFormFieldSelect;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;
    
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Canvas click events for placing elements
    this.canvas.addEventListener('click', (e) => {
      if (this.isPlacingTextBox && this.pendingTextBoxConfig) {
        this.placeTextBox(e);
      } else if (this.isPlacingField && this.pendingFieldConfig) {
        this.placeFormField(e);
      }
    });

    // Overlay events for selecting and manipulating elements
    this.overlay.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.overlay.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.overlay.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.overlay.addEventListener('click', (e) => this.handleOverlayClick(e));
  }

  async loadPDF(arrayBuffer: ArrayBuffer) {
    try {
      console.log('Loading PDF document...');
      this.pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      this.totalPages = this.pdfDocument.numPages;
      this.currentPage = 1;
      
      console.log('PDF loaded successfully, pages:', this.totalPages);
      await this.renderCurrentPage();
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw error;
    }
  }

  async loadOCRData(ocrData: any[]) {
    console.log('Loading OCR data:', ocrData.length, 'pages');
    
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
            color: '#000000',
            fontFamily: 'Arial, sans-serif',
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
            pageNumber: pageData.page_number,
            confidence: block.confidence || 0.9,
            originalText: block.text || '',
            isCustomText: false
          };
          
          this.textElements.push(element);
        }
      }
    }
    
    console.log('OCR data loaded:', this.textElements.length, 'text elements');
    this.updateOverlay();
  }

  private async renderCurrentPage() {
    if (!this.pdfDocument) return;
    
    try {
      const page = await this.pdfDocument.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: this.scale });
      
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;
      this.canvas.style.width = `${viewport.width}px`;
      this.canvas.style.height = `${viewport.height}px`;
      
      // Update overlay size to match canvas
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
      throw error;
    }
  }

  private updateOverlay() {
    if (!this.isModifyMode) {
      this.overlay.innerHTML = '';
      return;
    }
    
    this.overlay.innerHTML = '';
    
    // Add text elements for current page
    const currentPageElements = this.textElements.filter(el => el.pageNumber === this.currentPage);
    
    for (const element of currentPageElements) {
      const div = this.createTextElementDiv(element);
      this.overlay.appendChild(div);
    }
    
    // Add form fields for current page
    const currentPageFields = this.formFields.filter(field => field.pageNumber === this.currentPage);
    
    for (const field of currentPageFields) {
      const div = this.createFormFieldDiv(field);
      this.overlay.appendChild(div);
    }
  }

  private createTextElementDiv(element: TextElement): HTMLElement {
    const div = document.createElement('div');
    div.className = 'text-element';
    div.dataset.elementId = element.id;
    
    // Apply styles
    Object.assign(div.style, {
      position: 'absolute',
      left: `${element.x * this.scale}px`,
      top: `${element.y * this.scale}px`,
      width: `${element.width * this.scale}px`,
      height: `${element.height * this.scale}px`,
      fontSize: `${element.fontSize * this.scale}px`,
      color: element.color,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      textDecoration: element.textDecoration,
      textAlign: element.textAlign,
      textTransform: element.textTransform,
      lineHeight: element.lineHeight.toString(),
      letterSpacing: `${element.letterSpacing}px`,
      backgroundColor: element.backgroundColor,
      borderColor: element.borderColor,
      borderWidth: `${element.borderWidth}px`,
      borderStyle: element.borderStyle,
      padding: `${element.padding}px`,
      cursor: 'pointer',
      userSelect: 'none',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word'
    });
    
    div.textContent = element.text;
    
    // Add selection styling if selected
    if (this.selectedElement?.id === element.id) {
      div.style.outline = '2px solid #3b82f6';
      div.style.outlineOffset = '2px';
      this.addResizeHandles(div);
    }
    
    return div;
  }

  private createFormFieldDiv(field: FormField): HTMLElement {
    const div = document.createElement('div');
    div.className = 'form-field';
    div.dataset.fieldId = field.id;
    
    Object.assign(div.style, {
      position: 'absolute',
      left: `${field.x * this.scale}px`,
      top: `${field.y * this.scale}px`,
      width: `${field.width * this.scale}px`,
      height: `${field.height * this.scale}px`,
      border: '2px solid #6b7280',
      backgroundColor: '#f9fafb',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: '#374151'
    });
    
    if (field.type === 'checkbox') {
      div.innerHTML = field.value === 'true' ? '✓' : '☐';
    } else {
      div.textContent = field.value || `${field.type} field`;
    }
    
    // Add selection styling if selected
    if (this.selectedFormField?.id === field.id) {
      div.style.outline = '2px solid #3b82f6';
      div.style.outlineOffset = '2px';
      this.addResizeHandles(div);
    }
    
    return div;
  }

  private addResizeHandles(element: HTMLElement) {
    const handles = ['nw', 'ne', 'sw', 'se'];
    
    for (const handle of handles) {
      const handleDiv = document.createElement('div');
      handleDiv.className = `resize-handle resize-${handle}`;
      handleDiv.dataset.handle = handle;
      
      Object.assign(handleDiv.style, {
        position: 'absolute',
        width: '8px',
        height: '8px',
        backgroundColor: '#3b82f6',
        border: '1px solid white',
        cursor: `${handle}-resize`,
        zIndex: '1000'
      });
      
      // Position handles
      switch (handle) {
        case 'nw':
          handleDiv.style.top = '-4px';
          handleDiv.style.left = '-4px';
          break;
        case 'ne':
          handleDiv.style.top = '-4px';
          handleDiv.style.right = '-4px';
          break;
        case 'sw':
          handleDiv.style.bottom = '-4px';
          handleDiv.style.left = '-4px';
          break;
        case 'se':
          handleDiv.style.bottom = '-4px';
          handleDiv.style.right = '-4px';
          break;
      }
      
      element.appendChild(handleDiv);
    }
  }

  private handleMouseDown(e: MouseEvent) {
    if (!this.isModifyMode) return;
    
    const target = e.target as HTMLElement;
    
    // Check if clicking on resize handle
    if (target.classList.contains('resize-handle')) {
      this.isResizing = true;
      this.resizeHandle = target.dataset.handle || '';
      e.preventDefault();
      return;
    }
    
    // Check if clicking on text element
    if (target.classList.contains('text-element')) {
      const elementId = target.dataset.elementId;
      const element = this.textElements.find(el => el.id === elementId);
      
      if (element) {
        this.selectedElement = element;
        this.selectedFormField = null;
        this.isDragging = true;
        
        const rect = this.overlay.getBoundingClientRect();
        this.dragOffset = {
          x: e.clientX - rect.left - element.x * this.scale,
          y: e.clientY - rect.top - element.y * this.scale
        };
        
        this.onElementSelect?.(element);
        this.onFormFieldSelect?.(null);
        this.updateOverlay();
      }
      e.preventDefault();
      return;
    }
    
    // Check if clicking on form field
    if (target.classList.contains('form-field')) {
      const fieldId = target.dataset.fieldId;
      const field = this.formFields.find(f => f.id === fieldId);
      
      if (field) {
        this.selectedFormField = field;
        this.selectedElement = null;
        this.isDragging = true;
        
        const rect = this.overlay.getBoundingClientRect();
        this.dragOffset = {
          x: e.clientX - rect.left - field.x * this.scale,
          y: e.clientY - rect.top - field.y * this.scale
        };
        
        this.onFormFieldSelect?.(field);
        this.onElementSelect?.(null);
        this.updateOverlay();
      }
      e.preventDefault();
      return;
    }
    
    // Clicking on empty space - deselect
    this.selectedElement = null;
    this.selectedFormField = null;
    this.onElementSelect?.(null);
    this.onFormFieldSelect?.(null);
    this.updateOverlay();
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isModifyMode) return;
    
    const rect = this.overlay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scale;
    const y = (e.clientY - rect.top) / this.scale;
    
    if (this.isResizing && (this.selectedElement || this.selectedFormField)) {
      this.handleResize(x, y);
    } else if (this.isDragging && (this.selectedElement || this.selectedFormField)) {
      this.handleDrag(x, y);
    }
  }

  private handleMouseUp(e: MouseEvent) {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = '';
  }

  private handleOverlayClick(e: MouseEvent) {
    // Prevent event bubbling to canvas
    e.stopPropagation();
  }

  private handleDrag(x: number, y: number) {
    if (this.selectedElement) {
      this.selectedElement.x = x - this.dragOffset.x / this.scale;
      this.selectedElement.y = y - this.dragOffset.y / this.scale;
      this.updateOverlay();
    } else if (this.selectedFormField) {
      this.selectedFormField.x = x - this.dragOffset.x / this.scale;
      this.selectedFormField.y = y - this.dragOffset.y / this.scale;
      this.updateOverlay();
    }
  }

  private handleResize(x: number, y: number) {
    const element = this.selectedElement || this.selectedFormField;
    if (!element) return;
    
    const minSize = 10;
    
    switch (this.resizeHandle) {
      case 'se':
        element.width = Math.max(minSize, x - element.x);
        element.height = Math.max(minSize, y - element.y);
        break;
      case 'sw':
        const newWidth = Math.max(minSize, element.x + element.width - x);
        element.x = element.x + element.width - newWidth;
        element.width = newWidth;
        element.height = Math.max(minSize, y - element.y);
        break;
      case 'ne':
        element.width = Math.max(minSize, x - element.x);
        const newHeight = Math.max(minSize, element.y + element.height - y);
        element.y = element.y + element.height - newHeight;
        element.height = newHeight;
        break;
      case 'nw':
        const newW = Math.max(minSize, element.x + element.width - x);
        const newH = Math.max(minSize, element.y + element.height - y);
        element.x = element.x + element.width - newW;
        element.y = element.y + element.height - newH;
        element.width = newW;
        element.height = newH;
        break;
    }
    
    this.updateOverlay();
  }

  // Text box placement methods
  startTextBoxPlacement(config: any) {
    console.log('🎯 Starting text box placement mode');
    this.isPlacingTextBox = true;
    this.pendingTextBoxConfig = config;
    this.canvas.style.cursor = 'crosshair';
  }

  cancelTextBoxPlacement() {
    console.log('🛑 Cancelling text box placement');
    this.isPlacingTextBox = false;
    this.pendingTextBoxConfig = null;
    this.canvas.style.cursor = 'default';
  }

  private placeTextBox(e: MouseEvent) {
    if (!this.pendingTextBoxConfig) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scale;
    const y = (e.clientY - rect.top) / this.scale;
    
    console.log('📍 Placing text box at:', x, y);
    
    const textElement: TextElement = {
      id: `textbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: this.pendingTextBoxConfig.text,
      x: x,
      y: y,
      width: this.pendingTextBoxConfig.width,
      height: this.pendingTextBoxConfig.height,
      fontSize: this.pendingTextBoxConfig.fontSize,
      color: this.pendingTextBoxConfig.color,
      fontFamily: this.pendingTextBoxConfig.fontFamily,
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
      pageNumber: this.currentPage,
      isCustomText: true
    };
    
    this.textElements.push(textElement);
    this.selectedElement = textElement;
    this.selectedFormField = null;
    
    // Exit placement mode
    this.isPlacingTextBox = false;
    this.pendingTextBoxConfig = null;
    this.canvas.style.cursor = 'default';
    
    // Update UI
    this.updateOverlay();
    this.onElementSelect?.(textElement);
    this.onFormFieldSelect?.(null);
    
    console.log('✅ Text box placed successfully');
    
    // Hide placement instructions
    const placementInstructions = document.getElementById('placement-instructions');
    placementInstructions?.classList.add('hidden');
  }

  // Form field placement methods
  startFieldPlacement(config: any) {
    console.log('🎯 Starting field placement mode');
    this.isPlacingField = true;
    this.pendingFieldConfig = config;
    this.canvas.style.cursor = 'crosshair';
  }

  cancelFieldPlacement() {
    console.log('🛑 Cancelling field placement');
    this.isPlacingField = false;
    this.pendingFieldConfig = null;
    this.canvas.style.cursor = 'default';
  }

  private placeFormField(e: MouseEvent) {
    if (!this.pendingFieldConfig) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scale;
    const y = (e.clientY - rect.top) / this.scale;
    
    console.log('📍 Placing form field at:', x, y);
    
    const formField: FormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.pendingFieldConfig.type,
      name: this.pendingFieldConfig.name,
      x: x,
      y: y,
      width: this.pendingFieldConfig.width,
      height: this.pendingFieldConfig.height,
      value: '',
      pageNumber: this.currentPage,
      dateFormat: this.pendingFieldConfig.dateFormat
    };
    
    this.formFields.push(formField);
    this.selectedFormField = formField;
    this.selectedElement = null;
    
    // Exit placement mode
    this.isPlacingField = false;
    this.pendingFieldConfig = null;
    this.canvas.style.cursor = 'default';
    
    // Update UI
    this.updateOverlay();
    this.onFormFieldSelect?.(formField);
    this.onElementSelect?.(null);
    
    console.log('✅ Form field placed successfully');
    
    // Hide placement instructions
    const placementInstructions = document.getElementById('placement-instructions');
    placementInstructions?.classList.add('hidden');
  }

  // Element management methods
  updateSelectedElement(updates: Partial<TextElement>) {
    if (!this.selectedElement) return;
    
    Object.assign(this.selectedElement, updates);
    this.updateOverlay();
  }

  removeTextElement(elementId: string) {
    this.textElements = this.textElements.filter(el => el.id !== elementId);
    if (this.selectedElement?.id === elementId) {
      this.selectedElement = null;
      this.onElementSelect?.(null);
    }
    this.updateOverlay();
  }

  removeFormField(fieldId: string) {
    this.formFields = this.formFields.filter(field => field.id !== fieldId);
    if (this.selectedFormField?.id === fieldId) {
      this.selectedFormField = null;
      this.onFormFieldSelect?.(null);
    }
    this.updateOverlay();
  }

  // Mode and navigation methods
  setModifyMode(enabled: boolean) {
    this.isModifyMode = enabled;
    this.selectedElement = null;
    this.selectedFormField = null;
    this.onElementSelect?.(null);
    this.onFormFieldSelect?.(null);
    this.updateOverlay();
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

  // Export functionality
  async exportPDF(): Promise<Uint8Array> {
    if (!this.pdfDocument) {
      throw new Error('No PDF document loaded');
    }

    // For now, return the original PDF
    // In a full implementation, you would use PDF-lib to modify the PDF
    console.log('Exporting PDF with modifications...');
    
    // This is a placeholder - you would need to implement actual PDF modification
    // using a library like PDF-lib to apply the text elements and form fields
    throw new Error('PDF export with modifications not yet implemented');
  }
}