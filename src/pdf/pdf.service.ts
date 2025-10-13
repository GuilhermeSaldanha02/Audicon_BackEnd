import { Injectable } from '@nestjs/common';
import { Infracao } from 'src/infracoes/entities/infracao.entity';
import PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  async gerarDocumentoInfracao(infracao: Infracao): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });

    // Pipe the PDF content to a buffer
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));

    // --- Construção do Documento ---

    // Cabeçalho (simples, pode adicionar um logo depois)
    doc.fontSize(20).text('Notificação de Infração', { align: 'center' });
    doc.moveDown();

    // Informações do Condomínio e Unidade
    doc.fontSize(12).text(`Condomínio: ${infracao.unidade.condominio.nome}`);
    doc.text(`Unidade: ${infracao.unidade.identificador}`);
    doc.text(`Proprietário: ${infracao.unidade.proprietario_nome}`);
    doc.moveDown();

    // Detalhes da Infração
    doc.fontSize(14).text('Detalhes da Ocorrência', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Data da Ocorrência: ${new Date(infracao.data_ocorrencia).toLocaleString('pt-BR')}`);
    doc.moveDown();
    doc.text('Descrição:', { continued: false });
    doc.text(infracao.descricao_formal || 'Descrição não disponível.', {
      align: 'justify',
      indent: 20,
    });
    doc.moveDown();

    // Penalidade Sugerida
    doc.fontSize(14).text('Ação Recomendada', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`A penalidade sugerida para esta ocorrência é: ${infracao.penalidade_sugerida || 'Não definida'}.`);
    doc.moveDown(3);

    // Rodapé
    doc.fontSize(10).text('Atenciosamente,', { align: 'center'});
    doc.fontSize(10).text('Administradora Audicon Condomínios', { align: 'center' });

    // --- Fim da Construção ---

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
      doc.end();
    });
  }
}
