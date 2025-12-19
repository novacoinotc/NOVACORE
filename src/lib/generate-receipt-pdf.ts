import jsPDF from 'jspdf';
import { formatCurrency, formatDate, formatClabe } from './utils';
import { getBankFromSpeiCode } from './banks';

interface TransactionData {
  trackingKey: string;
  type: 'incoming' | 'outgoing';
  status: string;
  amount: number;
  concept: string | null;
  beneficiaryName: string | null;
  beneficiaryAccount: string | null;
  beneficiaryBank: string | null;
  payerName: string | null;
  payerAccount: string | null;
  payerBank: string | null;
  numericalReference: number | null;
  createdAt: number;
  settledAt: number | null;
}

function getBankName(bankCode: string | null): string {
  if (!bankCode) return '-';
  const bank = getBankFromSpeiCode(bankCode);
  return bank?.shortName || bank?.name || bankCode;
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    scattered: 'Liquidada',
    sent: 'Enviada',
    pending: 'Pendiente',
    pending_confirmation: 'En Espera',
    returned: 'Devuelta',
    canceled: 'Cancelada',
  };
  return statusMap[status] || status;
}

// Draw gradient background (simulated with rectangles)
function drawGradientBackground(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const steps = 50;
  const stepHeight = pageHeight / steps;

  for (let i = 0; i < steps; i++) {
    const progress = i / steps;
    // From dark purple (#0f0a1a) to deep purple (#1a0f2e)
    const r = Math.round(15 + progress * 11);
    const g = Math.round(10 + progress * 5);
    const b = Math.round(26 + progress * 20);

    doc.setFillColor(r, g, b);
    doc.rect(0, i * stepHeight, pageWidth, stepHeight + 1, 'F');
  }
}

// Draw a transparent card (simulated glass effect)
function drawGlassCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number = 0.1
) {
  // Semi-transparent white overlay
  const alpha = Math.round(255 * opacity);
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: opacity }));
  doc.roundedRect(x, y, width, height, 3, 3, 'F');

  // Subtle border
  doc.setGState(doc.GState({ opacity: 0.15 }));
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 3, 3, 'S');

  // Reset opacity
  doc.setGState(doc.GState({ opacity: 1 }));
}

export function generateReceiptPDF(transaction: TransactionData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Draw gradient background
  drawGradientBackground(doc, pageWidth, pageHeight);

  let y = 25;

  // NOVACORP Header
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('NOVA', margin, y);

  const novaWidth = doc.getTextWidth('NOVA');
  doc.setTextColor(167, 139, 250); // Purple-400
  doc.text('CORP', margin + novaWidth, y);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.5 }));
  doc.text('Comprobante de Transferencia SPEI', margin, y + 8);
  doc.setGState(doc.GState({ opacity: 1 }));

  y += 25;

  // Amount Card - Main prominent card
  const amountCardHeight = 50;
  drawGlassCard(doc, margin, y, contentWidth, amountCardHeight, 0.08);

  // Transaction type label
  const isIncoming = transaction.type === 'incoming';
  const typeText = isIncoming ? 'Depósito Recibido' : 'Transferencia Enviada';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.6 }));
  doc.text(typeText, margin + 12, y + 14);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Amount
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const amountText = formatCurrency(transaction.amount);
  doc.text(amountText, margin + 12, y + 36);

  // MXN label
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 139, 250);
  doc.text('MXN', margin + 12 + doc.getTextWidth(amountText) + 4, y + 36);

  y += amountCardHeight + 12;

  // Details Card
  const detailsCardHeight = 90;
  drawGlassCard(doc, margin, y, contentWidth, detailsCardHeight, 0.06);

  let detailY = y + 14;
  const labelX = margin + 12;
  const valueX = margin + contentWidth - 12;

  // Helper function for detail rows
  const addDetailRow = (label: string, value: string, isMono: boolean = false) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.5 }));
    doc.text(label, labelX, detailY);
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setTextColor(255, 255, 255);
    if (isMono) {
      doc.setFont('courier', 'normal');
    }

    // Truncate if too long
    let displayValue = value;
    const maxWidth = contentWidth - 70;
    while (doc.getTextWidth(displayValue) > maxWidth && displayValue.length > 3) {
      displayValue = displayValue.slice(0, -4) + '...';
    }

    doc.text(displayValue, valueX, detailY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    detailY += 14;
  };

  // Counterparty details
  if (isIncoming) {
    addDetailRow('Ordenante', transaction.payerName || 'No especificado');
    addDetailRow('Banco Origen', getBankName(transaction.payerBank));
    if (transaction.payerAccount) {
      addDetailRow('CLABE Origen', formatClabe(transaction.payerAccount), true);
    }
  } else {
    addDetailRow('Beneficiario', transaction.beneficiaryName || 'No especificado');
    addDetailRow('Banco Destino', getBankName(transaction.beneficiaryBank));
    if (transaction.beneficiaryAccount) {
      addDetailRow('CLABE Destino', formatClabe(transaction.beneficiaryAccount), true);
    }
  }

  addDetailRow('Concepto', transaction.concept || 'Sin concepto');

  if (transaction.numericalReference) {
    addDetailRow('Referencia', transaction.numericalReference.toString(), true);
  }

  y += detailsCardHeight + 12;

  // Tracking Key Card
  const trackingCardHeight = 35;
  drawGlassCard(doc, margin, y, contentWidth, trackingCardHeight, 0.1);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 139, 250);
  doc.text('CLAVE DE RASTREO', margin + 12, y + 12);

  doc.setFontSize(12);
  doc.setFont('courier', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(transaction.trackingKey, margin + 12, y + 25);

  y += trackingCardHeight + 12;

  // Status and Date Card
  const statusCardHeight = 35;
  drawGlassCard(doc, margin, y, contentWidth / 2 - 6, statusCardHeight, 0.06);
  drawGlassCard(doc, margin + contentWidth / 2 + 6, y, contentWidth / 2 - 6, statusCardHeight, 0.06);

  // Status
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.5 }));
  doc.text('ESTADO', margin + 12, y + 12);
  doc.setGState(doc.GState({ opacity: 1 }));

  const statusColors: Record<string, number[]> = {
    scattered: [74, 222, 128],   // Green
    sent: [96, 165, 250],        // Blue
    pending: [251, 191, 36],     // Amber
    pending_confirmation: [251, 191, 36],
    returned: [248, 113, 113],   // Red
    canceled: [248, 113, 113],
  };

  const statusColor = statusColors[transaction.status] || [255, 255, 255];
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(getStatusText(transaction.status), margin + 12, y + 25);

  // Date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.5 }));
  doc.text('FECHA', margin + contentWidth / 2 + 18, y + 12);
  doc.setGState(doc.GState({ opacity: 1 }));

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(formatDate(transaction.settledAt || transaction.createdAt), margin + contentWidth / 2 + 18, y + 25);

  y += statusCardHeight + 20;

  // Divider line with gradient effect
  doc.setGState(doc.GState({ opacity: 0.2 }));
  doc.setDrawColor(167, 139, 250);
  doc.setLineWidth(0.5);
  doc.line(margin + 40, y, pageWidth - margin - 40, y);
  doc.setGState(doc.GState({ opacity: 1 }));

  y += 15;

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.4 }));
  doc.text('Este comprobante es un documento informativo generado por NOVACORP.', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Para el Comprobante Electronico de Pago (CEP) oficial, consulte Banxico.', pageWidth / 2, y, { align: 'center' });
  doc.setGState(doc.GState({ opacity: 1 }));

  // Bottom accent - thin purple line
  doc.setFillColor(167, 139, 250);
  doc.setGState(doc.GState({ opacity: 0.6 }));
  doc.rect(0, pageHeight - 2, pageWidth, 2, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // Generated timestamp
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.3 }));
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  doc.setGState(doc.GState({ opacity: 1 }));

  // Save the PDF
  const fileName = `comprobante_${transaction.trackingKey}_${Date.now()}.pdf`;
  doc.save(fileName);
}
