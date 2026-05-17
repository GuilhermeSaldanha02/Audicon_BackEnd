import { Injectable } from '@nestjs/common';
import { Writable } from 'stream';
import { Condominium } from 'src/condominiums/entities/condominium.entity';
import { Infraction } from 'src/infractions/entities/infraction.entity';
import PDFDocument from 'pdfkit';
@Injectable()
export class PdfService {
  async gerarDocumentoInfracao(
    infraction: Infraction,
    imageBuffers: Buffer[] = [],
  ): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.fontSize(20).text('Infraction Notice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Condominium: ${infraction.unit.condominium.name}`);
    doc.text(`Unit: ${infraction.unit.identifier}`);
    doc.text(`Owner: ${infraction.unit.ownerName}`);
    doc.moveDown();
    doc.fontSize(14).text('Occurrence Details', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(
      `Occurrence Date: ${new Date(infraction.occurrenceDate).toLocaleString('en-US')}`,
    );
    doc.moveDown();
    doc.text('Description:', { continued: false });
    doc.text(infraction.formalDescription || 'Description not available.', {
      align: 'justify',
      indent: 20,
    });
    doc.moveDown();
    doc.fontSize(14).text('Recommended Action', { underline: true });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(
        `The suggested penalty for this occurrence is: ${infraction.suggestedPenalty || 'Not defined'}.`,
      );
    if (imageBuffers.length > 0) {
      doc.addPage();
      doc.fontSize(14).text('Evidence', { underline: true });
      doc.moveDown();
      const thumbWidth = 230;
      const thumbHeight = 170;
      const gapX = 20;
      const gapY = 20;
      const startX = doc.page.margins.left;
      let row = 0;
      let col = 0;
      for (const buf of imageBuffers.slice(0, 4)) {
        const x = startX + col * (thumbWidth + gapX);
        const y = doc.y + row * (thumbHeight + gapY);
        try {
          doc.image(buf, x, y, {
            fit: [thumbWidth, thumbHeight],
            align: 'center',
            valign: 'center',
          });
        } catch {
          // skip invalid image (corrupt or unsupported)
        }
        col++;
        if (col === 2) {
          col = 0;
          row++;
        }
      }
      doc.y = doc.y + Math.ceil(imageBuffers.length / 2) * (thumbHeight + gapY);
    }
    doc.moveDown(3);
    doc.fontSize(10).text('Sincerely,', { align: 'center' });
    doc
      .fontSize(10)
      .text('Audicon Condominiums Administration', { align: 'center' });
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }
  streamInfractionReport(
    sink: Writable,
    condominium: Condominium,
    infractions: Infraction[],
  ): Promise<void> {
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(sink);
    doc.fontSize(20).text('Infractions Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Condominium: ${condominium.name}`);
    doc.text(`CNPJ: ${condominium.cnpj}`);
    doc.text(`Address: ${condominium.address}`);
    doc.text(`Generated at: ${new Date().toISOString()}`);
    doc.text(`Total infractions: ${infractions.length}`);
    doc.moveDown();
    doc.fontSize(14).text('Infractions', { underline: true });
    doc.moveDown(0.5);
    if (infractions.length === 0) {
      doc.fontSize(12).text('No infractions found in the selected period.');
    } else {
      for (const inf of infractions) {
        doc
          .fontSize(12)
          .text(`#${inf.id} · ${new Date(inf.occurrenceDate).toISOString()}`);
        if (inf.unit) {
          doc.text(
            `Unit: ${inf.unit.identifier ?? '-'} | Owner: ${inf.unit.ownerName ?? '-'}`,
          );
        }
        doc.text(`Description: ${inf.description}`, {
          align: 'justify',
          indent: 20,
        });
        if (inf.formalDescription) {
          doc.text(`AI analysis: ${inf.formalDescription}`, {
            align: 'justify',
            indent: 20,
          });
        }
        if (inf.suggestedPenalty) {
          doc.text(`Suggested penalty: ${inf.suggestedPenalty}`, {
            indent: 20,
          });
        }
        doc.moveDown(0.5);
      }
    }
    return new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve());
      doc.on('error', reject);
      doc.end();
    });
  }
}
