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

  // Background - dark theme
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Subtle gradient overlay at top
  for (let i = 0; i < 60; i++) {
    const opacity = Math.max(0, 0.03 - i * 0.0005);
    doc.setFillColor(6, 182, 212, opacity * 255);
    doc.rect(0, i, pageWidth, 1, 'F');
  }

  let y = margin;

  // Logo Area
  // Draw logo circle
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.5);
  doc.circle(pageWidth / 2, y + 12, 10);

  // Draw N inside circle
  doc.setTextColor(6, 182, 212);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('N', pageWidth / 2, y + 16, { align: 'center' });

  y += 28;

  // Company name with gradient effect (simulated)
  doc.setFontSize(22);
  doc.setTextColor(6, 182, 212);
  doc.text('NOVACORP', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('PAGOS SPEI', pageWidth / 2, y, { align: 'center' });

  y += 15;

  // Receipt title
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('COMPROBANTE DE OPERACION', pageWidth / 2, y, { align: 'center' });

  y += 12;

  // Divider line with glow effect
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.3);
  doc.line(margin + 20, y, pageWidth - margin - 20, y);

  y += 15;

  // Transaction type indicator
  const isIncoming = transaction.type === 'incoming';
  const typeText = isIncoming ? 'TRANSFERENCIA RECIBIDA' : 'TRANSFERENCIA ENVIADA';
  const typeColor = isIncoming ? [34, 197, 94] : [239, 68, 68]; // green / red

  doc.setFillColor(typeColor[0], typeColor[1], typeColor[2], 0.15 * 255);
  doc.roundedRect(margin, y - 5, contentWidth, 14, 3, 3, 'F');

  doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(typeText, pageWidth / 2, y + 3, { align: 'center' });

  y += 20;

  // Amount - large centered
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  const amountText = `${isIncoming ? '+' : '-'} ${formatCurrency(transaction.amount)}`;
  doc.text(amountText, pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('MXN - Pesos Mexicanos', pageWidth / 2, y, { align: 'center' });

  y += 20;

  // Detail box background
  const detailBoxHeight = 95;
  doc.setFillColor(20, 20, 25);
  doc.roundedRect(margin, y, contentWidth, detailBoxHeight, 4, 4, 'F');

  // Border with subtle glow
  doc.setDrawColor(40, 40, 50);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, detailBoxHeight, 4, 4, 'S');

  y += 10;
  const detailX = margin + 10;
  const valueX = margin + contentWidth - 10;

  // Helper function for detail rows
  const addDetailRow = (label: string, value: string, isMono: boolean = false) => {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(label, detailX, y);

    doc.setTextColor(220, 220, 220);
    if (isMono) {
      doc.setFont('courier', 'normal');
    }
    doc.text(value, valueX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 9;
  };

  // Transaction details
  addDetailRow('Clave de Rastreo', transaction.trackingKey, true);
  addDetailRow('Fecha y Hora', formatDate(transaction.settledAt || transaction.createdAt));

  if (isIncoming) {
    addDetailRow('Ordenante', transaction.payerName || '-');
    addDetailRow('Banco Ordenante', getBankName(transaction.payerBank));
    if (transaction.payerAccount) {
      addDetailRow('CLABE Ordenante', formatClabe(transaction.payerAccount), true);
    }
  } else {
    addDetailRow('Beneficiario', transaction.beneficiaryName || '-');
    addDetailRow('Banco Destino', getBankName(transaction.beneficiaryBank));
    if (transaction.beneficiaryAccount) {
      addDetailRow('CLABE Destino', formatClabe(transaction.beneficiaryAccount), true);
    }
  }

  addDetailRow('Concepto', transaction.concept || 'Sin concepto');

  if (transaction.numericalReference) {
    addDetailRow('Referencia', transaction.numericalReference.toString(), true);
  }

  y += 15;

  // Status badge
  const statusMap: Record<string, { text: string; color: number[] }> = {
    scattered: { text: 'LIQUIDADA', color: [34, 197, 94] },
    sent: { text: 'ENVIADA', color: [234, 179, 8] },
    pending: { text: 'PENDIENTE', color: [234, 179, 8] },
    pending_confirmation: { text: 'EN ESPERA', color: [234, 179, 8] },
    returned: { text: 'DEVUELTA', color: [239, 68, 68] },
    canceled: { text: 'CANCELADA', color: [239, 68, 68] },
  };

  const status = statusMap[transaction.status] || { text: transaction.status.toUpperCase(), color: [150, 150, 150] };

  doc.setFillColor(status.color[0], status.color[1], status.color[2], 0.2 * 255);
  const statusWidth = 40;
  doc.roundedRect(pageWidth / 2 - statusWidth / 2, y, statusWidth, 10, 2, 2, 'F');

  doc.setTextColor(status.color[0], status.color[1], status.color[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(status.text, pageWidth / 2, y + 6.5, { align: 'center' });

  y += 25;

  // Footer divider
  doc.setDrawColor(40, 40, 50);
  doc.setLineWidth(0.2);
  doc.line(margin + 30, y, pageWidth - margin - 30, y);

  y += 12;

  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Este comprobante es un documento informativo generado por NOVACORP.', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Para el CEP oficial de Banxico, consulte la seccion de CEP en la plataforma.', pageWidth / 2, y, { align: 'center' });

  y += 15;

  // Timestamp
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, pageWidth / 2, y, { align: 'center' });

  // Bottom decoration - subtle line
  doc.setDrawColor(6, 182, 212, 0.3 * 255);
  doc.setLineWidth(2);
  doc.line(0, pageHeight - 5, pageWidth, pageHeight - 5);

  // Save the PDF
  const fileName = `comprobante_${transaction.trackingKey}_${Date.now()}.pdf`;
  doc.save(fileName);
}
