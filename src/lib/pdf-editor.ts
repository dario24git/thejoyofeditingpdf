import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { TextBlock, OCRData } from './ocr';

// Configure PDF.js worker - use the correct worker file for version 5.3.31
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.origin).href;
}

export interface EditableTextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  pageNumber: number;
  isEditing: boolean;
  confidence: number;
  originalText: string;
  // Store original OCR data for proper scaling
  originalBoundingBox: any;
  // Track if this element has been modified
  hasBeenModified: boolean;
  // Store the base coordinates and properties (at scale 1.0) for consistent scaling
  baseX: number;
  baseY: number;
  baseWidth: number;
  baseHeight: number;
  baseFontSize: number;
  // Enhanced text formatting properties
  textAlign: 'left' | 'center' | 'right' | 'justify';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  lineHeight: number;
  letterSpacing: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
  padding: number;
  textTransform: 'none' | 'uppercase' | 'lowercase';
}

export interface FormField {
  id: string;
  type: 'text' | 'checkbox' | 'date';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  value?: string;
  dateFormat?: 'mm/dd/yyyy' | 'dd/mm/yyyy';
  // Add base coordinates for proper scaling
  baseX?: number;
  baseY?: number;
  baseWidth?: number;
  baseHeight?: number;
}

export class PDFEditor {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private overlayContainer: HTMLElement;
  private pdfDocument: any = null;
  private currentPage: number = 1;
  public scale: number = 1.0;
  private editableElements: EditableTextElement[] = [];
  private formFields: FormField[] = [];
  private ocrData: OCRData[] = [];
  private isModifyMode: boolean = false;
  public selectedElement: EditableTextElement | null = null;
  public selectedFormField: FormField | null = null;
  private onElementSelect?: (element: EditableTextElement | null) => void;
  private onFormFieldSelect?: (field: FormField | null) => void;
  private pageViewports: Map<number, any> = new Map();
  
  // Form field placement
  private pendingFieldConfig: any = null;
  private isPlacingField: boolean = false;
  private placementIndicator: HTMLElement | null = null;
  
  // Resize functionality
  private isResizing: boolean = false;
  private resizeHandle: string = '';
  private resizeStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private resizeStartBounds: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 };
  private resizeTarget: 'text' | 'form' = 'text';

  constructor(
    canvas: HTMLCanvasElement,
    overlayContainer: HTMLElement,
    options: {
      onElementSelect?: (element: EditableTextElement | null) => void;
      onFormFieldSelect?: (field: FormField | null) => void;
    } = {}
  ) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d')!;
    this.overlayContainer = overlayContainer;
    this.onElementSelect = options.onElementSelect;
    this.onFormFieldSelect = options.onFormFieldSelect;

    this.setupEventListeners();
  }

  async loadPDF(pdfData: ArrayBuffer): Promise<void> {
    try {
      // Ensure worker is properly configured
      if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.origin).href;
      }

      this.pdfDocument = await pdfjsLib.getDocument({ 
        data: pdfData,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.3.31/cmaps/',
        cMapPacked: true
      }).promise;
      
      // Pre-calculate viewports for all pages at scale 1.0 for coordinate conversion
      await this.precalculateViewports();
      
      await this.renderPage(this.currentPage);
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error(`Failed to load PDF document: ${error.message}`);
    }
  }

  private async precalculateViewports(): Promise<void> {
    for (let pageNum = 1; pageNum <= this.pdfDocument.numPages; pageNum++) {
      const page = await this.pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 }); // Always use scale 1.0 for base coordinates
      this.pageViewports.set(pageNum, viewport);
    }
  }

  async loadOCRData(ocrData: OCRData[]): Promise<void> {
    this.ocrData = ocrData;
    this.createEditableElements();
  }

  private createEditableElements(): void {
    this.editableElements = [];
    
    this.ocrData.forEach(pageData => {
      if (pageData.text_blocks && Array.isArray(pageData.text_blocks)) {
        pageData.text_blocks.forEach((block: TextBlock, index: number) => {
          // Convert OCR coordinates to base viewport coordinates (scale 1.0)
          const baseCoords = this.convertOCRToBaseViewport(block.boundingBox, pageData.page_number);
          
          // Calculate base font size with improved formula
          const baseFontSize = this.calculateBaseFontSize(baseCoords.height, pageData.page_number);
          
          const element: EditableTextElement = {
            id: `text-${pageData.page_number}-${index}`,
            text: block.text,
            // Current display coordinates (will be updated on scale changes)
            x: baseCoords.x * this.scale,
            y: baseCoords.y * this.scale,
            width: baseCoords.width * this.scale,
            height: baseCoords.height * this.scale,
            fontSize: baseFontSize * this.scale,
            // Base coordinates (scale 1.0) - these never change unless manually resized
            baseX: baseCoords.x,
            baseY: baseCoords.y,
            baseWidth: baseCoords.width,
            baseHeight: baseCoords.height,
            baseFontSize: baseFontSize,
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            pageNumber: pageData.page_number,
            isEditing: false,
            confidence: block.confidence,
            originalText: block.text,
            originalBoundingBox: { ...block.boundingBox },
            hasBeenModified: false,
            // Enhanced formatting properties with defaults
            textAlign: 'left',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            lineHeight: 1.2,
            letterSpacing: 0,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderStyle: 'none',
            padding: 2,
            textTransform: 'none'
          };
          
          this.editableElements.push(element);
        });
      }
    });
  }

  private calculateBaseFontSize(height: number, pageNumber: number): number {
    // FIXED: More conservative font size calculation to prevent skyrocketing
    // Use smaller multiplier (0.3 instead of 0.6) and lower max cap (16 instead of 24)
    // This prevents multi-line text blocks from having excessively large font sizes
    const fontSize = Math.max(8, Math.min(16, height * 0.3));
    return fontSize;
  }

  private convertOCRToBaseViewport(boundingBox: any, pageNumber: number): { x: number; y: number; width: number; height: number } {
    const baseViewport = this.pageViewports.get(pageNumber);
    
    if (!baseViewport) {
      return {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height
      };
    }

    // Check if coordinates seem to be normalized (0-1 range) or absolute
    const maxCoord = Math.max(
      boundingBox.x + boundingBox.width,
      boundingBox.y + boundingBox.height
    );
    
    const isNormalized = maxCoord <= 1.0;

    let x, y, width, height;

    if (isNormalized) {
      // Coordinates are normalized (0-1), convert to viewport coordinates
      x = boundingBox.x * baseViewport.width;
      y = boundingBox.y * baseViewport.height;
      width = boundingBox.width * baseViewport.width;
      height = boundingBox.height * baseViewport.height;
    } else {
      // Coordinates are absolute, but we need to scale them to match the viewport
      const scaleX = baseViewport.width / 1684; // Approximate A4 width in points at 72 DPI
      const scaleY = baseViewport.height / 2384; // Approximate A4 height in points at 72 DPI
      
      x = boundingBox.x * scaleX;
      y = boundingBox.y * scaleY;
      width = boundingBox.width * scaleX;
      height = boundingBox.height * scaleY;
    }

    // Return base coordinates (no scale applied)
    return { x, y, width, height };
  }

  async renderPage(pageNumber: number): Promise<void> {
    if (!this.pdfDocument) return;

    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.scale });

      // Set canvas dimensions to exactly match viewport
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;
      
      // Set CSS dimensions to match canvas dimensions exactly (no stretching)
      this.canvas.style.width = `${viewport.width}px`;
      this.canvas.style.height = `${viewport.height}px`;

      // Set overlay container dimensions to match exactly
      this.overlayContainer.style.width = `${viewport.width}px`;
      this.overlayContainer.style.height = `${viewport.height}px`;

      // Clear canvas
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Render PDF page
      const renderContext = {
        canvasContext: this.context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      this.currentPage = pageNumber;

      // Update element positions for current scale and update overlay
      this.updateElementPositionsForScale();
      this.updateOverlay();
    } catch (error) {
      console.error('Error rendering page:', error);
      throw new Error('Failed to render PDF page');
    }
  }

  private updateElementPositionsForScale(): void {
    // Update positions for all elements based on current scale
    this.editableElements.forEach(element => {
      if (element.pageNumber === this.currentPage) {
        // CRITICAL FIX: Always use base coordinates for scaling
        // This prevents font size from accumulating on each click
        element.x = element.baseX * this.scale;
        element.y = element.baseY * this.scale;
        element.width = element.baseWidth * this.scale;
        element.height = element.baseHeight * this.scale;
        
        // CRITICAL FIX: Only scale font size if element hasn't been manually modified
        // If it has been modified, preserve the user's font size choice
        if (!element.hasBeenModified) {
          element.fontSize = element.baseFontSize * this.scale;
        }
        // If modified, keep the current fontSize as-is (user's choice)
      }
    });

    // Update form field positions
    this.formFields.forEach(field => {
      if (field.pageNumber === this.currentPage) {
        // Update form field positions based on base coordinates if available
        if (field.baseX !== undefined) {
          field.x = field.baseX * this.scale;
          field.y = field.baseY * this.scale;
          field.width = field.baseWidth! * this.scale;
          field.height = field.baseHeight! * this.scale;
        }
      }
    });
  }

  private updateOverlay(): void {
    // Clear existing overlay elements
    this.overlayContainer.innerHTML = '';

    // Add editable text elements for current page
    const currentPageElements = this.editableElements.filter(
      el => el.pageNumber === this.currentPage
    );

    currentPageElements.forEach(element => {
      this.createTextOverlay(element);
    });

    // Add form fields for current page
    const currentPageFields = this.formFields.filter(
      field => field.pageNumber === this.currentPage
    );

    currentPageFields.forEach(field => {
      this.createFormFieldOverlay(field);
    });

    // Re-add placement indicator if we're placing a field
    if (this.isPlacingField && this.placementIndicator) {
      this.overlayContainer.appendChild(this.placementIndicator);
    }
  }

  private createTextOverlay(element: EditableTextElement): void {
    const textDiv = document.createElement('div');
    textDiv.className = 'absolute cursor-pointer transition-all duration-200';
    textDiv.style.left = `${element.x}px`;
    textDiv.style.top = `${element.y}px`;
    textDiv.style.width = `${element.width}px`;
    textDiv.style.height = `${element.height}px`;
    textDiv.style.fontSize = `${element.fontSize}px`;
    textDiv.style.fontFamily = element.fontFamily;
    textDiv.style.color = element.color;
    textDiv.style.lineHeight = element.lineHeight.toString();
    textDiv.style.letterSpacing = `${element.letterSpacing}px`;
    textDiv.style.fontWeight = element.fontWeight;
    textDiv.style.fontStyle = element.fontStyle;
    textDiv.style.textDecoration = element.textDecoration;
    textDiv.style.textTransform = element.textTransform;
    textDiv.style.overflow = 'hidden';
    textDiv.style.wordWrap = 'break-word';
    textDiv.style.whiteSpace = 'normal';
    textDiv.style.pointerEvents = this.isModifyMode && !this.isPlacingField ? 'auto' : 'none';
    textDiv.style.padding = `${element.padding}px`;
    textDiv.style.margin = '0';
    textDiv.style.boxSizing = 'border-box';
    textDiv.style.display = 'flex';
    textDiv.style.flexDirection = 'column';
    textDiv.style.justifyContent = 'flex-start';
    textDiv.dataset.elementId = element.id;

    // Apply text alignment properly
    switch (element.textAlign) {
      case 'left':
        textDiv.style.textAlign = 'left';
        textDiv.style.alignItems = 'flex-start';
        break;
      case 'center':
        textDiv.style.textAlign = 'center';
        textDiv.style.alignItems = 'center';
        break;
      case 'right':
        textDiv.style.textAlign = 'right';
        textDiv.style.alignItems = 'flex-end';
        break;
      case 'justify':
        textDiv.style.textAlign = 'justify';
        textDiv.style.alignItems = 'stretch';
        break;
    }

    // Apply background color
    if (element.backgroundColor !== 'transparent') {
      textDiv.style.backgroundColor = element.backgroundColor;
    }
    
    // FIXED: Apply border properly - only when border width > 0 and color is not transparent
    if (element.borderWidth > 0 && element.borderColor !== 'transparent' && element.borderStyle !== 'none') {
      textDiv.style.border = `${element.borderWidth}px ${element.borderStyle} ${element.borderColor}`;
    }

    // Determine if this text box should show content
    const isSelected = this.selectedElement?.id === element.id;
    const shouldShowContent = isSelected || element.hasBeenModified || element.isEditing;

    if (this.isModifyMode) {
      // Always show the border for all text boxes in modify mode
      textDiv.style.border = '1px dashed rgba(59, 130, 246, 0.8)';
      
      // Only show white background and content for selected/modified text boxes
      if (shouldShowContent) {
        textDiv.style.backgroundColor = element.backgroundColor === 'transparent' ? 'white' : element.backgroundColor;
        
        // Add confidence indicator only for content-visible boxes
        const confidenceIndicator = document.createElement('div');
        confidenceIndicator.className = 'absolute -top-5 left-0 text-xs px-1 bg-blue-500 text-white rounded';
        confidenceIndicator.textContent = `${(element.confidence * 100).toFixed(0)}%`;
        textDiv.appendChild(confidenceIndicator);
      } else {
        // For non-selected boxes, show transparent background so border is visible
        textDiv.style.backgroundColor = 'transparent';
      }
    }

    if (element.isEditing) {
      // Create editable textarea with proper sizing and wrapping
      const textarea = document.createElement('textarea');
      textarea.value = element.text;
      textarea.className = 'w-full h-full resize-none border-2 border-blue-500 bg-white';
      textarea.style.fontSize = `${element.fontSize}px`;
      textarea.style.fontFamily = element.fontFamily;
      textarea.style.color = element.color;
      textarea.style.backgroundColor = 'white';
      textarea.style.padding = `${element.padding}px`;
      textarea.style.margin = '0';
      textarea.style.boxSizing = 'border-box';
      textarea.style.lineHeight = element.lineHeight.toString();
      textarea.style.letterSpacing = `${element.letterSpacing}px`;
      textarea.style.textAlign = element.textAlign;
      textarea.style.fontWeight = element.fontWeight;
      textarea.style.fontStyle = element.fontStyle;
      textarea.style.textDecoration = element.textDecoration;
      textarea.style.textTransform = element.textTransform;
      textarea.style.overflow = 'hidden';
      textarea.style.wordWrap = 'break-word';
      textarea.style.whiteSpace = 'normal';
      
      // Auto-resize textarea to fit content
      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, element.height) + 'px';
      };
      
      textarea.addEventListener('input', () => {
        autoResize();
        // Mark as modified when user types
        element.hasBeenModified = true;
      });
      
      // FIXED: Click outside to exit editing instead of Enter
      textarea.addEventListener('blur', () => {
        element.text = textarea.value;
        element.isEditing = false;
        // Mark as modified if text changed
        if (element.text !== element.originalText) {
          element.hasBeenModified = true;
        }
        this.updateOverlay();
      });

      // FIXED: Only exit on Escape, allow Enter for new lines
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          element.text = element.originalText;
          element.isEditing = false;
          this.updateOverlay();
        }
        // Allow Enter key to create new lines (removed the Enter handler)
      });

      textDiv.appendChild(textarea);
      setTimeout(() => {
        textarea.focus();
        autoResize();
      }, 0);
    } else {
      // Only show text content for selected/modified text boxes
      if (shouldShowContent) {
        // Create a text container that properly wraps text
        const textContainer = document.createElement('div');
        textContainer.style.width = '100%';
        textContainer.style.height = '100%';
        textContainer.style.fontSize = `${element.fontSize}px`;
        textContainer.style.fontFamily = element.fontFamily;
        textContainer.style.color = element.color;
        textContainer.style.lineHeight = element.lineHeight.toString();
        textContainer.style.letterSpacing = `${element.letterSpacing}px`;
        textContainer.style.textAlign = element.textAlign;
        textContainer.style.fontWeight = element.fontWeight;
        textContainer.style.fontStyle = element.fontStyle;
        textContainer.style.textDecoration = element.textDecoration;
        textContainer.style.textTransform = element.textTransform;
        textContainer.style.wordWrap = 'break-word';
        textContainer.style.whiteSpace = 'normal';
        textContainer.style.overflow = 'hidden';
        textContainer.style.padding = '0';
        textContainer.style.margin = '0';
        textContainer.style.display = 'block';
        
        // Display text with line breaks
        textContainer.innerHTML = element.text.replace(/\n/g, '<br>');
        
        textDiv.appendChild(textContainer);
      }
      
      if (this.isModifyMode && !this.isPlacingField) {
        textDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectElement(element);
        });

        textDiv.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          element.isEditing = true;
          this.updateOverlay();
        });
      }
    }

    // Highlight selected element with stronger styling and add resize handles
    if (isSelected) {
      // FIXED: Apply custom border for selected elements, preserving user's border settings
      if (element.borderWidth > 0 && element.borderColor !== 'transparent' && element.borderStyle !== 'none') {
        // Show user's custom border with selection highlight
        textDiv.style.border = `${element.borderWidth}px ${element.borderStyle} ${element.borderColor}`;
        textDiv.style.boxShadow = '0 0 0 2px #3b82f6';
      } else {
        // Show selection border when no custom border
        textDiv.style.border = '2px solid #3b82f6';
      }
      
      textDiv.style.backgroundColor = element.backgroundColor === 'transparent' ? 'rgba(255, 255, 255, 0.95)' : element.backgroundColor;
      
      // Add resize handles
      this.addResizeHandles(textDiv, element, 'text');
    }

    this.overlayContainer.appendChild(textDiv);
  }

  private createFormFieldOverlay(field: FormField): void {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'absolute border-2 border-green-500 bg-green-100 bg-opacity-50 cursor-pointer';
    fieldDiv.style.left = `${field.x}px`;
    fieldDiv.style.top = `${field.y}px`;
    fieldDiv.style.width = `${field.width}px`;
    fieldDiv.style.height = `${field.height}px`;
    fieldDiv.style.pointerEvents = this.isModifyMode && !this.isPlacingField ? 'auto' : 'none';
    fieldDiv.dataset.fieldId = field.id;

    // Add field type indicator
    const typeIndicator = document.createElement('div');
    typeIndicator.className = 'absolute -top-5 left-0 text-xs px-1 bg-green-500 text-white rounded';
    
    let displayText = field.type.toUpperCase();
    if (field.type === 'date' && field.dateFormat) {
      displayText = `DATE (${field.dateFormat.toUpperCase()})`;
    }
    typeIndicator.textContent = displayText;
    fieldDiv.appendChild(typeIndicator);

    // Add field name label
    const nameLabel = document.createElement('div');
    nameLabel.className = 'absolute top-1 left-1 text-xs text-green-700 font-medium';
    nameLabel.textContent = field.name;
    fieldDiv.appendChild(nameLabel);

    // Add interactive input for the field
    if (this.isModifyMode && !this.isPlacingField) {
      this.addFormFieldInput(fieldDiv, field);
      
      fieldDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectFormField(field);
      });
    }

    // Highlight selected form field and add resize handles
    if (this.selectedFormField?.id === field.id) {
      fieldDiv.style.border = '2px solid #059669';
      fieldDiv.style.boxShadow = '0 0 0 2px #10b981';
      
      // Add resize handles for form fields
      this.addResizeHandles(fieldDiv, field, 'form');
    }

    this.overlayContainer.appendChild(fieldDiv);
  }

  private addFormFieldInput(fieldDiv: HTMLElement, field: FormField): void {
    let input: HTMLElement;

    switch (field.type) {
      case 'text':
        input = document.createElement('input');
        (input as HTMLInputElement).type = 'text';
        (input as HTMLInputElement).value = field.value || '';
        (input as HTMLInputElement).placeholder = 'Enter text...';
        break;

      case 'checkbox':
        input = document.createElement('input');
        (input as HTMLInputElement).type = 'checkbox';
        (input as HTMLInputElement).checked = field.value === 'true';
        input.style.width = '100%';
        input.style.height = '100%';
        break;

      case 'date':
        input = document.createElement('input');
        (input as HTMLInputElement).type = 'date';
        (input as HTMLInputElement).value = field.value || '';
        
        // Add date format validation
        (input as HTMLInputElement).addEventListener('change', (e) => {
          const dateValue = (e.target as HTMLInputElement).value;
          if (dateValue) {
            // Validate and format the date according to the field's format
            const isValid = this.validateAndFormatDate(dateValue, field.dateFormat || 'mm/dd/yyyy');
            if (!isValid) {
              alert(`Please enter a valid date in ${field.dateFormat?.toUpperCase()} format`);
              (e.target as HTMLInputElement).value = '';
              return;
            }
          }
          field.value = dateValue;
        });
        break;

      default:
        return;
    }

    // Style the input
    input.className = 'absolute inset-1 bg-white border border-gray-300 rounded px-1 text-xs';
    input.style.fontSize = '10px';
    input.style.zIndex = '10';

    // Handle value changes
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (field.type === 'checkbox') {
        field.value = target.checked ? 'true' : 'false';
      } else {
        field.value = target.value;
      }
    });

    // Prevent event bubbling
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    fieldDiv.appendChild(input);
  }

  private validateAndFormatDate(dateValue: string, format: string): boolean {
    // HTML date input always returns YYYY-MM-DD format
    // We just need to validate it's a valid date
    const date = new Date(dateValue);
    return !isNaN(date.getTime());
  }

  private addResizeHandles(container: HTMLElement, target: EditableTextElement | FormField, type: 'text' | 'form'): void {
    const handleSize = 8;
    const handleStyle = {
      position: 'absolute',
      width: `${handleSize}px`,
      height: `${handleSize}px`,
      backgroundColor: type === 'text' ? '#3b82f6' : '#059669',
      border: '1px solid white',
      borderRadius: '2px',
      zIndex: '1000'
    };

    // Create resize handles for each corner and edge
    const handles = [
      { name: 'nw', cursor: 'nw-resize', top: -handleSize/2, left: -handleSize/2 },
      { name: 'n', cursor: 'n-resize', top: -handleSize/2, left: '50%', transform: 'translateX(-50%)' },
      { name: 'ne', cursor: 'ne-resize', top: -handleSize/2, right: -handleSize/2 },
      { name: 'e', cursor: 'e-resize', top: '50%', right: -handleSize/2, transform: 'translateY(-50%)' },
      { name: 'se', cursor: 'se-resize', bottom: -handleSize/2, right: -handleSize/2 },
      { name: 's', cursor: 's-resize', bottom: -handleSize/2, left: '50%', transform: 'translateX(-50%)' },
      { name: 'sw', cursor: 'sw-resize', bottom: -handleSize/2, left: -handleSize/2 },
      { name: 'w', cursor: 'w-resize', top: '50%', left: -handleSize/2, transform: 'translateY(-50%)' }
    ];

    handles.forEach(handle => {
      const handleDiv = document.createElement('div');
      handleDiv.className = 'resize-handle';
      handleDiv.dataset.handle = handle.name;
      
      // Apply base styles
      Object.assign(handleDiv.style, handleStyle);
      
      // Apply position styles
      if (handle.top !== undefined) handleDiv.style.top = typeof handle.top === 'number' ? `${handle.top}px` : handle.top;
      if (handle.bottom !== undefined) handleDiv.style.bottom = typeof handle.bottom === 'number' ? `${handle.bottom}px` : handle.bottom;
      if (handle.left !== undefined) handleDiv.style.left = typeof handle.left === 'number' ? `${handle.left}px` : handle.left;
      if (handle.right !== undefined) handleDiv.style.right = typeof handle.right === 'number' ? `${handle.right}px` : handle.right;
      if (handle.transform) handleDiv.style.transform = handle.transform;
      
      handleDiv.style.cursor = handle.cursor;

      // Add resize event listeners
      handleDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.startResize(e, target, handle.name, type);
      });

      container.appendChild(handleDiv);
    });
  }

  private startResize(e: MouseEvent, target: EditableTextElement | FormField, handle: string, type: 'text' | 'form'): void {
    this.isResizing = true;
    this.resizeHandle = handle;
    this.resizeTarget = type;
    this.resizeStartPos = { x: e.clientX, y: e.clientY };
    this.resizeStartBounds = {
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height
    };

    // Add global mouse event listeners
    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.stopResize);
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = this.getCursorForHandle(handle);
  }

  private handleResize = (e: MouseEvent): void => {
    if (!this.isResizing) return;

    const target = this.resizeTarget === 'text' ? this.selectedElement : this.selectedFormField;
    if (!target) return;

    const deltaX = e.clientX - this.resizeStartPos.x;
    const deltaY = e.clientY - this.resizeStartPos.y;
    
    const minWidth = 20;
    const minHeight = 10;
    
    let newBounds = { ...this.resizeStartBounds };

    switch (this.resizeHandle) {
      case 'nw':
        newBounds.x = this.resizeStartBounds.x + deltaX;
        newBounds.y = this.resizeStartBounds.y + deltaY;
        newBounds.width = Math.max(minWidth, this.resizeStartBounds.width - deltaX);
        newBounds.height = Math.max(minHeight, this.resizeStartBounds.height - deltaY);
        break;
      case 'n':
        newBounds.y = this.resizeStartBounds.y + deltaY;
        newBounds.height = Math.max(minHeight, this.resizeStartBounds.height - deltaY);
        break;
      case 'ne':
        newBounds.y = this.resizeStartBounds.y + deltaY;
        newBounds.width = Math.max(minWidth, this.resizeStartBounds.width + deltaX);
        newBounds.height = Math.max(minHeight, this.resizeStartBounds.height - deltaY);
        break;
      case 'e':
        newBounds.width = Math.max(minWidth, this.resizeStartBounds.width + deltaX);
        break;
      case 'se':
        newBounds.width = Math.max(minWidth, this.resizeStartBounds.width + deltaX);
        newBounds.height = Math.max(minHeight, this.resizeStartBounds.height + deltaY);
        break;
      case 's':
        newBounds.height = Math.max(minHeight, this.resizeStartBounds.height + deltaY);
        break;
      case 'sw':
        newBounds.x = this.resizeStartBounds.x + deltaX;
        newBounds.width = Math.max(minWidth, this.resizeStartBounds.width - deltaX);
        newBounds.height = Math.max(minHeight, this.resizeStartBounds.height + deltaY);
        break;
      case 'w':
        newBounds.x = this.resizeStartBounds.x + deltaX;
        newBounds.width = Math.max(minWidth, this.resizeStartBounds.width - deltaX);
        break;
    }

    // Update the target bounds
    target.x = newBounds.x;
    target.y = newBounds.y;
    target.width = newBounds.width;
    target.height = newBounds.height;

    // Update base coordinates to reflect the manual resize
    if (this.resizeTarget === 'text') {
      const element = target as EditableTextElement;
      element.baseX = newBounds.x / this.scale;
      element.baseY = newBounds.y / this.scale;
      element.baseWidth = newBounds.width / this.scale;
      element.baseHeight = newBounds.height / this.scale;

      // Adjust font size based on new height (optional)
      const newFontSize = Math.max(8, Math.min(24, newBounds.height * 0.4));
      element.fontSize = newFontSize;
      element.baseFontSize = newFontSize / this.scale;

      // Mark as modified when resized
      element.hasBeenModified = true;
    } else {
      const field = target as FormField;
      field.baseX = newBounds.x / this.scale;
      field.baseY = newBounds.y / this.scale;
      field.baseWidth = newBounds.width / this.scale;
      field.baseHeight = newBounds.height / this.scale;
    }

    // Update the overlay to reflect changes
    this.updateOverlay();
    
    // Notify the parent component of the change
    if (this.resizeTarget === 'text' && this.onElementSelect) {
      this.onElementSelect(this.selectedElement);
    } else if (this.resizeTarget === 'form' && this.onFormFieldSelect) {
      this.onFormFieldSelect(this.selectedFormField);
    }
  };

  private stopResize = (): void => {
    this.isResizing = false;
    this.resizeHandle = '';
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    
    // Restore normal cursor and text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  private getCursorForHandle(handle: string): string {
    const cursors: { [key: string]: string } = {
      'nw': 'nw-resize',
      'n': 'n-resize',
      'ne': 'ne-resize',
      'e': 'e-resize',
      'se': 'se-resize',
      's': 's-resize',
      'sw': 'sw-resize',
      'w': 'w-resize'
    };
    return cursors[handle] || 'default';
  }

  private selectElement(element: EditableTextElement): void {
    this.selectedElement = element;
    this.selectedFormField = null; // Deselect form field
    this.onElementSelect?.(element);
    this.updateOverlay();
  }

  private selectFormField(field: FormField): void {
    this.selectedFormField = field;
    this.selectedElement = null; // Deselect text element
    this.onFormFieldSelect?.(field);
    this.updateOverlay();
  }

  private setupEventListeners(): void {
    console.log('Setting up event listeners for PDF editor');

    // CRITICAL FIX: Use proper event delegation and capture
    this.overlayContainer.addEventListener('click', (e) => {
      console.log('=== OVERLAY CLICK EVENT ===');
      console.log('Target:', e.target);
      console.log('Current target:', e.currentTarget);
      console.log('Is placing field:', this.isPlacingField);
      console.log('Pending field config:', this.pendingFieldConfig);
      console.log('Event phase:', e.eventPhase);
      console.log('Coordinates:', { x: e.offsetX, y: e.offsetY });

      // CRITICAL: Handle field placement with highest priority
      if (this.isPlacingField && this.pendingFieldConfig) {
        console.log('🎯 HANDLING FIELD PLACEMENT');
        e.preventDefault();
        e.stopPropagation();
        this.handleFieldPlacement(e);
        return;
      }
      
      // Handle form field selection
      const fieldDiv = (e.target as HTMLElement).closest('[data-field-id]');
      if (fieldDiv && this.isModifyMode && !this.isPlacingField) {
        const fieldId = fieldDiv.getAttribute('data-field-id');
        const field = this.formFields.find(f => f.id === fieldId);
        if (field) {
          console.log('Selecting form field:', fieldId);
          e.stopPropagation();
          this.selectFormField(field);
          return;
        }
      }
      
      // Handle text element selection
      const elementDiv = (e.target as HTMLElement).closest('[data-element-id]');
      if (elementDiv && this.isModifyMode && !this.isPlacingField) {
        const elementId = elementDiv.getAttribute('data-element-id');
        const element = this.editableElements.find(el => el.id === elementId);
        if (element) {
          console.log('Selecting text element:', elementId);
          e.stopPropagation();
          this.selectElement(element);
          return;
        }
      }
      
      // Deselect if clicking on empty overlay area
      if (e.target === this.overlayContainer) {
        console.log('Clicking on empty overlay, deselecting');
        this.selectedElement = null;
        this.selectedFormField = null;
        this.onElementSelect?.(null);
        this.onFormFieldSelect?.(null);
        this.updateOverlay();
      }
    }, true); // Use capture phase to ensure we get the event first

    // Mouse move handler for placement indicator
    this.overlayContainer.addEventListener('mousemove', (e) => {
      if (this.isPlacingField && this.pendingFieldConfig) {
        this.updatePlacementIndicator(e);
      }
    });

    // Mouse enter/leave for placement mode
    this.overlayContainer.addEventListener('mouseenter', () => {
      if (this.isPlacingField) {
        this.overlayContainer.style.cursor = 'crosshair';
      }
    });

    this.overlayContainer.addEventListener('mouseleave', () => {
      if (this.isPlacingField && this.placementIndicator) {
        this.placementIndicator.style.display = 'none';
      }
    });

    // Prevent context menu on resize handles
    this.overlayContainer.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement).classList.contains('resize-handle')) {
        e.preventDefault();
      }
    });

    console.log('Event listeners setup complete');
  }

  private updatePlacementIndicator(e: MouseEvent): void {
    if (!this.isPlacingField || !this.pendingFieldConfig) return;

    const rect = this.overlayContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!this.placementIndicator) {
      this.placementIndicator = document.createElement('div');
      this.placementIndicator.className = 'absolute border-2 border-dashed border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none z-50';
      this.placementIndicator.style.position = 'absolute';
      this.overlayContainer.appendChild(this.placementIndicator);
      
      console.log('Created placement indicator');
    }

    // Show the indicator
    this.placementIndicator.style.display = 'block';

    // Position the indicator at mouse position (centered)
    const indicatorX = Math.max(0, Math.min(x - this.pendingFieldConfig.width / 2, this.overlayContainer.offsetWidth - this.pendingFieldConfig.width));
    const indicatorY = Math.max(0, Math.min(y - this.pendingFieldConfig.height / 2, this.overlayContainer.offsetHeight - this.pendingFieldConfig.height));

    this.placementIndicator.style.left = `${indicatorX}px`;
    this.placementIndicator.style.top = `${indicatorY}px`;
    this.placementIndicator.style.width = `${this.pendingFieldConfig.width}px`;
    this.placementIndicator.style.height = `${this.pendingFieldConfig.height}px`;

    // Add type indicator if not already present
    if (!this.placementIndicator.querySelector('.type-indicator')) {
      const typeIndicator = document.createElement('div');
      typeIndicator.className = 'type-indicator absolute -top-5 left-0 text-xs px-1 bg-blue-500 text-white rounded whitespace-nowrap';
      let displayText = this.pendingFieldConfig.type.toUpperCase();
      if (this.pendingFieldConfig.type === 'date' && this.pendingFieldConfig.dateFormat) {
        displayText = `DATE (${this.pendingFieldConfig.dateFormat.toUpperCase()})`;
      }
      typeIndicator.textContent = displayText;
      this.placementIndicator.appendChild(typeIndicator);
    }
  }

  private handleFieldPlacement(e: MouseEvent): void {
    console.log('🎯 PLACING FIELD AT CLICK POSITION');
    
    if (!this.pendingFieldConfig || !this.isPlacingField) {
      console.error('❌ No pending field config or not in placement mode');
      return;
    }

    // Get click coordinates relative to overlay
    const rect = this.overlayContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Center the field at click position
    const fieldX = Math.max(0, Math.min(clickX - this.pendingFieldConfig.width / 2, this.overlayContainer.offsetWidth - this.pendingFieldConfig.width));
    const fieldY = Math.max(0, Math.min(clickY - this.pendingFieldConfig.height / 2, this.overlayContainer.offsetHeight - this.pendingFieldConfig.height));

    console.log('Field placement coordinates:', { clickX, clickY, fieldX, fieldY });
    console.log('Field config:', this.pendingFieldConfig);

    // Create the field
    const field: FormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.pendingFieldConfig.type,
      name: this.pendingFieldConfig.name,
      x: fieldX,
      y: fieldY,
      width: this.pendingFieldConfig.width,
      height: this.pendingFieldConfig.height,
      pageNumber: this.currentPage,
      dateFormat: this.pendingFieldConfig.dateFormat,
      // Set base coordinates for proper scaling
      baseX: fieldX / this.scale,
      baseY: fieldY / this.scale,
      baseWidth: this.pendingFieldConfig.width / this.scale,
      baseHeight: this.pendingFieldConfig.height / this.scale
    };

    // Add to form fields array
    this.formFields.push(field);
    console.log('✅ Form field created and added:', field);
    console.log('Total form fields:', this.formFields.length);

    // Reset placement mode
    this.cancelFieldPlacement();
    
    // Update overlay to show the new field
    this.updateOverlay();

    console.log('🎉 Field placement completed successfully!');
  }

  setModifyMode(enabled: boolean): void {
    console.log('Setting modify mode:', enabled);
    this.isModifyMode = enabled;
    
    // Cancel field placement if exiting modify mode
    if (!enabled && this.isPlacingField) {
      this.cancelFieldPlacement();
    }
    
    // Clear selections when exiting modify mode
    if (!enabled) {
      this.selectedElement = null;
      this.selectedFormField = null;
      this.onElementSelect?.(null);
      this.onFormFieldSelect?.(null);
    }
    
    this.updateOverlay();
  }

  updateSelectedElement(updates: Partial<EditableTextElement>): void {
    if (this.selectedElement) {
      // Check if text content is being updated
      if (updates.text !== undefined && updates.text !== this.selectedElement.originalText) {
        this.selectedElement.hasBeenModified = true;
      }
      
      // Mark as modified for any property change
      this.selectedElement.hasBeenModified = true;
      
      // Apply updates
      Object.assign(this.selectedElement, updates);
      
      // CRITICAL FIX: If fontSize is being updated manually, update the base font size
      // and mark as modified to prevent auto-scaling
      if (updates.fontSize !== undefined) {
        this.selectedElement.baseFontSize = updates.fontSize / this.scale;
        this.selectedElement.hasBeenModified = true;
      }
      
      this.updateOverlay();
    }
  }

  addFormField(field: Omit<FormField, 'id'>): void {
    const newField: FormField = {
      ...field,
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pageNumber: this.currentPage
    };
    this.formFields.push(newField);
    this.updateOverlay();
  }

  removeFormField(fieldId: string): void {
    this.formFields = this.formFields.filter(field => field.id !== fieldId);
    this.updateOverlay();
  }

  // CRITICAL FIX: Enhanced field placement method
  startFieldPlacement(fieldConfig: any): void {
    console.log('🚀 STARTING FIELD PLACEMENT');
    console.log('Field config received:', fieldConfig);
    
    this.pendingFieldConfig = { ...fieldConfig };
    this.isPlacingField = true;
    
    // Set cursor and visual feedback
    this.overlayContainer.style.cursor = 'crosshair';
    
    // Remove any existing placement indicator
    if (this.placementIndicator) {
      this.placementIndicator.remove();
      this.placementIndicator = null;
    }
    
    console.log('✅ Field placement mode activated');
    console.log('- Pending config:', this.pendingFieldConfig);
    console.log('- Is placing field:', this.isPlacingField);
    console.log('- Overlay cursor:', this.overlayContainer.style.cursor);
  }

  // CRITICAL FIX: Enhanced cancellation method
  cancelFieldPlacement(): void {
    console.log('🛑 CANCELLING FIELD PLACEMENT');
    
    this.isPlacingField = false;
    this.pendingFieldConfig = null;
    this.overlayContainer.style.cursor = 'default';
    
    // Remove placement indicator
    if (this.placementIndicator) {
      this.placementIndicator.remove();
      this.placementIndicator = null;
    }
    
    console.log('✅ Field placement cancelled');
  }

  async exportPDF(): Promise<Uint8Array> {
    if (!this.pdfDocument) {
      throw new Error('No PDF document loaded');
    }

    try {
      // Get original PDF data
      const originalData = await this.pdfDocument.getData();
      const pdfDoc = await PDFDocument.load(originalData);
      const pages = pdfDoc.getPages();

      // Apply text modifications only for modified elements
      for (const element of this.editableElements) {
        if (element.hasBeenModified || element.text !== element.originalText) {
          const page = pages[element.pageNumber - 1];
          if (page) {
            // Get the correct font based on formatting
            let font;
            if (element.fontWeight === 'bold' && element.fontStyle === 'italic') {
              font = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
            } else if (element.fontWeight === 'bold') {
              font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            } else if (element.fontStyle === 'italic') {
              font = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
            } else {
              font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            }
            
            // Get the base viewport for coordinate conversion
            const baseViewport = this.pageViewports.get(element.pageNumber);
            if (!baseViewport) continue;

            // CRITICAL FIX: Use the current base coordinates (which include manual resizing)
            const exportX = element.baseX;
            const exportY = element.baseY;
            const exportWidth = element.baseWidth;
            const exportHeight = element.baseHeight;
            const exportFontSize = element.baseFontSize;

            console.log(`Exporting element ${element.id}:`);
            console.log(`- Position: (${exportX}, ${exportY})`);
            console.log(`- Size: ${exportWidth} x ${exportHeight}`);
            console.log(`- Font size: ${exportFontSize}`);
            console.log(`- Text: "${element.text}"`);
            console.log(`- Font weight: ${element.fontWeight}, style: ${element.fontStyle}`);

            // Draw background rectangle if needed
            if (element.backgroundColor !== 'transparent') {
              const bgColor = this.hexToRgb(element.backgroundColor);
              page.drawRectangle({
                x: exportX,
                y: baseViewport.height - (exportY + exportHeight),
                width: exportWidth,
                height: exportHeight,
                color: rgb(bgColor.r / 255, bgColor.g / 255, bgColor.b / 255),
              });
            } else {
              // Draw white rectangle to cover original text
              page.drawRectangle({
                x: exportX,
                y: baseViewport.height - (exportY + exportHeight),
                width: exportWidth,
                height: exportHeight,
                color: rgb(1, 1, 1),
              });
            }

            // FIXED: Draw border in PDF export if specified
            if (element.borderWidth > 0 && element.borderColor !== 'transparent' && element.borderStyle !== 'none') {
              const borderColor = this.hexToRgb(element.borderColor);
              
              // Draw border rectangle (outline only)
              page.drawRectangle({
                x: exportX,
                y: baseViewport.height - (exportY + exportHeight),
                width: exportWidth,
                height: exportHeight,
                borderColor: rgb(borderColor.r / 255, borderColor.g / 255, borderColor.b / 255),
                borderWidth: element.borderWidth,
              });
            }

            // Convert text color
            const textColor = this.hexToRgb(element.color);

            // Apply text transform (removed capitalize)
            let processedText = element.text;
            switch (element.textTransform) {
              case 'uppercase':
                processedText = processedText.toUpperCase();
                break;
              case 'lowercase':
                processedText = processedText.toLowerCase();
                break;
            }

            // Regular text export
            const textLines = processedText.split('\n');
            const lineHeight = exportFontSize * element.lineHeight;
            
            textLines.forEach((line, index) => {
              if (line.trim()) {
                // Calculate the Y position (PDF coordinates are bottom-up)
                const textY = baseViewport.height - (exportY + element.padding + exportFontSize + (index * lineHeight));
                
                // Calculate X position based on text alignment
                let textX = exportX + element.padding;
                
                // For center and right alignment, we need to calculate text width
                if (element.textAlign === 'center') {
                  const textWidth = font.widthOfTextAtSize(line, exportFontSize);
                  const availableWidth = exportWidth - (2 * element.padding);
                  textX = exportX + element.padding + (availableWidth - textWidth) / 2;
                } else if (element.textAlign === 'right') {
                  const textWidth = font.widthOfTextAtSize(line, exportFontSize);
                  textX = exportX + exportWidth - element.padding - textWidth;
                }

                console.log(`- Line ${index + 1}: "${line}" at (${textX}, ${textY})`);

                page.drawText(line, {
                  x: textX,
                  y: textY,
                  size: exportFontSize,
                  font: font,
                  color: rgb(textColor.r / 255, textColor.g / 255, textColor.b / 255),
                  maxWidth: exportWidth - (2 * element.padding),
                });
              }
            });
          }
        }
      }

      // Add form fields
      for (const field of this.formFields) {
        const page = pages[field.pageNumber - 1];
        if (page) {
          const baseViewport = this.pageViewports.get(field.pageNumber);
          if (!baseViewport) continue;

          const pdfX = (field.baseX || field.x / this.scale);
          const pdfY = baseViewport.height - ((field.baseY || field.y / this.scale) + (field.baseHeight || field.height / this.scale));
          const pdfWidth = field.baseWidth || field.width / this.scale;
          const pdfHeight = field.baseHeight || field.height / this.scale;

          const form = pdfDoc.getForm();

          switch (field.type) {
            case 'text':
              const textField = form.createTextField(field.name);
              textField.addToPage(page, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
              });
              if (field.value) textField.setText(field.value);
              break;

            case 'checkbox':
              const checkBox = form.createCheckBox(field.name);
              checkBox.addToPage(page, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
              });
              if (field.value === 'true') checkBox.check();
              break;

            case 'date':
              // Create a text field for date input with validation
              const dateField = form.createTextField(field.name);
              dateField.addToPage(page, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
              });
              
              // Set value or placeholder based on format
              if (field.value) {
                // Format the date according to the field's format
                const date = new Date(field.value);
                let formattedDate = '';
                
                if (field.dateFormat === 'dd/mm/yyyy') {
                  formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                } else {
                  formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
                }
                
                dateField.setText(formattedDate);
              } else {
                const placeholder = field.dateFormat === 'dd/mm/yyyy' ? 'DD/MM/YYYY' : 'MM/DD/YYYY';
                dateField.setText(placeholder);
              }
              break;
          }
        }
      }

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      throw new Error('Failed to export PDF');
    }
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  nextPage(): void {
    if (this.pdfDocument && this.currentPage < this.pdfDocument.numPages) {
      this.renderPage(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.renderPage(this.currentPage - 1);
    }
  }

  setScale(scale: number): void {
    this.scale = scale;
    this.renderPage(this.currentPage);
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  getTotalPages(): number {
    return this.pdfDocument?.numPages || 0;
  }

  getEditableElements(): EditableTextElement[] {
    return this.editableElements;
  }

  getFormFields(): FormField[] {
    return this.formFields;
  }
}