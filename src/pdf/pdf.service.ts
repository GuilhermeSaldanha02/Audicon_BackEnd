import { Injectable } from '@nestjs/common';
import { Infraction } from 'src/infractions/entities/infraction.entity';
import PDFDocument from 'pdfkit';
@Injectable()
export class PdfService {
    async gerarDocumentoInfracao(infraction: Infraction): Promise<Buffer> {
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
        doc.text(`Occurrence Date: ${new Date(infraction.occurrenceDate).toLocaleString('en-US')}`);
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
            .text(`The suggested penalty for this occurrence is: ${infraction.suggestedPenalty || 'Not defined'}.`);
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
}
