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

export function generateReceiptPDF(transaction: TransactionData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;

  // Clean white background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Top accent bar - gradient effect (purple to cyan)
  doc.setFillColor(139, 92, 246); // Purple
  doc.rect(0, 0, pageWidth, 4, 'F');

  let y = 20;

  // Company name header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 40);
  doc.text('NOVACORP', margin, y);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 130);
  doc.text('Comprobante de Operacion SPEI', margin, y + 7);

  // Date on the right
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 160);
  doc.text(formatDate(transaction.settledAt || transaction.createdAt), pageWidth - margin, y + 3, { align: 'right' });

  y += 25;

  // Divider line
  doc.setDrawColor(230, 230, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 15;

  // Transaction type badge
  const isIncoming = transaction.type === 'incoming';
  const typeText = isIncoming ? 'DEPOSITO RECIBIDO' : 'TRANSFERENCIA ENVIADA';
  const badgeColor = isIncoming ? [16, 185, 129] : [99, 102, 241]; // Green / Indigo

  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  const badgeWidth = doc.getTextWidth(typeText) + 16;
  doc.roundedRect(margin, y - 5, badgeWidth, 8, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(typeText, margin + 8, y);

  y += 15;

  // Amount - large and prominent
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 40);
  const amountText = formatCurrency(transaction.amount);
  doc.text(amountText, margin, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 160);
  doc.text('MXN', margin + doc.getTextWidth(amountText) + 3, y - 6);

  y += 20;

  // Main info card - light gray background
  const cardHeight = 85;
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 4, 4, 'F');

  // Card border
  doc.setDrawColor(230, 230, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 4, 4, 'S');

  y += 12;
  const labelX = margin + 12;
  const valueX = margin + contentWidth - 12;

  // Helper function for rows inside card
  const addCardRow = (label: string, value: string, isMono: boolean = false) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 130);
    doc.text(label, labelX, y);

    doc.setTextColor(50, 50, 60);
    if (isMono) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }

    // Truncate if too long
    let displayValue = value;
    const maxWidth = contentWidth - 80;
    while (doc.getTextWidth(displayValue) > maxWidth && displayValue.length > 3) {
      displayValue = displayValue.slice(0, -4) + '...';
    }

    doc.text(displayValue, valueX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 11;
  };

  // Counterparty info
  if (isIncoming) {
    addCardRow('Ordenante', transaction.payerName || 'No especificado');
    addCardRow('Banco Origen', getBankName(transaction.payerBank));
    if (transaction.payerAccount) {
      addCardRow('CLABE Origen', formatClabe(transaction.payerAccount), true);
    }
  } else {
    addCardRow('Beneficiario', transaction.beneficiaryName || 'No especificado');
    addCardRow('Banco Destino', getBankName(transaction.beneficiaryBank));
    if (transaction.beneficiaryAccount) {
      addCardRow('CLABE Destino', formatClabe(transaction.beneficiaryAccount), true);
    }
  }

  addCardRow('Concepto', transaction.concept || 'Sin concepto');

  if (transaction.numericalReference) {
    addCardRow('Referencia', transaction.numericalReference.toString(), true);
  }

  // Jump out of card
  y += 20;

  // Tracking key section
  doc.setFillColor(139, 92, 246, 0.08 * 255);
  doc.roundedRect(margin, y, contentWidth, 28, 4, 4, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(139, 92, 246);
  doc.text('CLAVE DE RASTREO', margin + 12, y + 10);

  doc.setFontSize(11);
  doc.setFont('courier', 'bold');
  doc.setTextColor(80, 60, 120);
  doc.text(transaction.trackingKey, margin + 12, y + 20);

  y += 40;

  // Status badge
  const statusMap: Record<string, { color: number[] }> = {
    scattered: { color: [16, 185, 129] },
    sent: { color: [59, 130, 246] },
    pending: { color: [245, 158, 11] },
    pending_confirmation: { color: [245, 158, 11] },
    returned: { color: [239, 68, 68] },
    canceled: { color: [239, 68, 68] },
  };

  const status = statusMap[transaction.status] || { color: [150, 150, 150] };
  const statusText = getStatusText(transaction.status);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const statusWidth = doc.getTextWidth(statusText) + 20;

  doc.setFillColor(status.color[0], status.color[1], status.color[2], 0.1 * 255);
  doc.roundedRect(pageWidth / 2 - statusWidth / 2, y, statusWidth, 10, 3, 3, 'F');

  doc.setTextColor(status.color[0], status.color[1], status.color[2]);
  doc.text(statusText, pageWidth / 2, y + 7, { align: 'center' });

  y += 25;

  // Divider
  doc.setDrawColor(230, 230, 235);
  doc.setLineWidth(0.3);
  doc.line(margin + 30, y, pageWidth - margin - 30, y);

  y += 15;

  // Footer info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 170);
  doc.text('Este comprobante es un documento informativo generado por NOVACORP.', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Para el Comprobante Electronico de Pago (CEP) oficial, consulte Banxico.', pageWidth / 2, y, { align: 'center' });

  // Bottom accent line
  doc.setFillColor(139, 92, 246);
  doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');

  // Timestamp in corner
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 190);
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, pageWidth - margin, pageHeight - 8, { align: 'right' });

  // Save the PDF
  const fileName = `comprobante_${transaction.trackingKey}_${Date.now()}.pdf`;
  doc.save(fileName);
}
