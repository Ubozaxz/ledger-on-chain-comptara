import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface EntryData {
  id: string;
  date: string;
  libelle: string;
  montant: string;
  devise: string;
  compteDebit: string;
  compteCredit: string;
  txHash: string;
  timestamp: string;
  status: string;
}

interface PaymentData {
  id: string;
  type: string;
  destinataire: string;
  montant: string;
  devise: string;
  objet: string;
  txHash: string;
  timestamp: string;
  status: string;
}

export async function generateEntryProofPDF(entry: EntryData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(33, 150, 243);
  doc.text('comptara', 20, 30);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Justificatif d\'écriture comptable', 20, 50);
  
  // Transaction details
  doc.setFontSize(12);
  let yPos = 80;
  
  const details = [
    ['Date:', new Date(entry.date).toLocaleDateString('fr-FR')],
    ['Libellé:', entry.libelle],
    ['Montant:', `${entry.montant} ${entry.devise}`],
    ['Compte débit:', entry.compteDebit],
    ['Compte crédit:', entry.compteCredit],
    ['Hash transaction:', entry.txHash],
    ['Timestamp blockchain:', new Date(entry.timestamp).toLocaleString('fr-FR')],
    ['Statut:', entry.status === 'success' ? 'Confirmé' : 'Échec'],
  ];
  
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    
    const maxWidth = pageWidth - 80;
    const splitText = doc.splitTextToSize(value, maxWidth);
    doc.text(splitText, 80, yPos);
    yPos += splitText.length * 7 + 3;
  });
  
  // QR Code
  try {
    const qrCodeDataURL = await QRCode.toDataURL(entry.txHash, {
      width: 100,
      margin: 1,
    });
    
    doc.addImage(qrCodeDataURL, 'PNG', pageWidth - 80, 80, 60, 60);
    doc.setFontSize(10);
    doc.text('Scan pour voir', pageWidth - 80, 150);
    doc.text('sur HashScan', pageWidth - 80, 160);
  } catch (error) {
    console.error('Erreur génération QR code:', error);
  }
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text('Document généré automatiquement par comptara', 20, pageWidth - 20);
  doc.text(`Le ${new Date().toLocaleString('fr-FR')}`, 20, pageWidth - 10);
  
  // Blockchain verification info
  doc.text('Vérifiable sur Hedera Testnet HashScan', pageWidth - 120, pageWidth - 20);
  
  // Save
  doc.save(`comptara_justificatif_${entry.id}.pdf`);
}

export async function generatePaymentProofPDF(payment: PaymentData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(33, 150, 243);
  doc.text('comptara', 20, 30);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(`Justificatif de ${payment.type}`, 20, 50);
  
  // Payment details
  doc.setFontSize(12);
  let yPos = 80;
  
  const details = [
    ['Type:', payment.type === 'paiement' ? 'Paiement fournisseur' : 'Encaissement client'],
    ['Destinataire:', payment.destinataire],
    ['Montant:', `${payment.montant} ${payment.devise}`],
    ['Objet:', payment.objet],
    ['Hash transaction:', payment.txHash],
    ['Timestamp:', new Date(payment.timestamp).toLocaleString('fr-FR')],
    ['Statut:', payment.status === 'success' ? 'Confirmé' : 'Échec'],
  ];
  
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    
    const maxWidth = pageWidth - 80;
    const splitText = doc.splitTextToSize(value, maxWidth);
    doc.text(splitText, 80, yPos);
    yPos += splitText.length * 7 + 3;
  });
  
  // QR Code
  try {
    const qrCodeDataURL = await QRCode.toDataURL(payment.txHash, {
      width: 100,
      margin: 1,
    });
    
    doc.addImage(qrCodeDataURL, 'PNG', pageWidth - 80, 80, 60, 60);
    doc.setFontSize(10);
    doc.text('Scan pour voir', pageWidth - 80, 150);
    doc.text('sur HashScan', pageWidth - 80, 160);
  } catch (error) {
    console.error('Erreur génération QR code:', error);
  }
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text('Document généré automatiquement par comptara', 20, pageWidth - 20);
  doc.text(`Le ${new Date().toLocaleString('fr-FR')}`, 20, pageWidth - 10);
  
  // Blockchain verification info
  doc.text('Vérifiable sur Hedera Testnet HashScan', pageWidth - 120, pageWidth - 20);
  
  // Save
  doc.save(`comptara_justificatif_${payment.type}_${payment.id}.pdf`);
}

export function generateFullExportPDF(entries: EntryData[], payments: PaymentData[], walletAddress: string | null): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(33, 150, 243);
  doc.text('comptara', 20, 30);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Export comptable complet', 20, 50);
  
  // Summary
  doc.setFontSize(12);
  let yPos = 80;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Résumé:', 20, yPos);
  yPos += 15;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Portefeuille: ${walletAddress || 'Non connecté'}`, 20, yPos);
  yPos += 10;
  doc.text(`Nombre d'écritures: ${entries.length}`, 20, yPos);
  yPos += 10;
  doc.text(`Nombre de paiements: ${payments.length}`, 20, yPos);
  yPos += 10;
  doc.text(`Date d'export: ${new Date().toLocaleString('fr-FR')}`, 20, yPos);
  yPos += 20;
  
  // Entries section
  if (entries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Écritures comptables:', 20, yPos);
    yPos += 15;
    
    entries.forEach((entry, index) => {
      if (yPos > pageWidth - 40) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${index + 1}. ${entry.libelle} - ${entry.montant} ${entry.devise}`, 20, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.text(`   Hash: ${entry.txHash}`, 20, yPos);
      yPos += 7;
      doc.text(`   Date: ${new Date(entry.date).toLocaleDateString('fr-FR')}`, 20, yPos);
      yPos += 12;
      doc.setFontSize(12);
    });
  }
  
  // Payments section
  if (payments.length > 0) {
    if (yPos > pageWidth - 60) {
      doc.addPage();
      yPos = 30;
    }
    
    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Paiements et encaissements:', 20, yPos);
    yPos += 15;
    
    payments.forEach((payment, index) => {
      if (yPos > pageWidth - 40) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${index + 1}. ${payment.objet} - ${payment.montant} ${payment.devise}`, 20, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.text(`   Hash: ${payment.txHash}`, 20, yPos);
      yPos += 7;
      doc.text(`   Type: ${payment.type}`, 20, yPos);
      yPos += 12;
      doc.setFontSize(12);
    });
  }
  
  // Save
  doc.save(`comptara_export_complet_${new Date().toISOString().split('T')[0]}.pdf`);
}