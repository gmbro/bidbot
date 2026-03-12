/**
 * 마크다운 텍스트를 .docx 파일로 변환하여 다운로드
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TableRow, TableCell, Table, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

function parseMarkdownToDocx(markdown: string): Paragraph[] {
    const lines = markdown.split('\n');
    const paragraphs: Paragraph[] = [];
    let inTable = false;
    const tableRows: string[][] = [];

    const flushTable = () => {
        if (tableRows.length > 0) {
            try {
                const table = new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: tableRows.map((cells, rowIdx) =>
                        new TableRow({
                            children: cells.map(cell =>
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({
                                            text: cell.trim(),
                                            bold: rowIdx === 0,
                                            size: 20,
                                            font: 'Malgun Gothic',
                                        })],
                                    })],
                                    borders: {
                                        top: { style: BorderStyle.SINGLE, size: 1 },
                                        bottom: { style: BorderStyle.SINGLE, size: 1 },
                                        left: { style: BorderStyle.SINGLE, size: 1 },
                                        right: { style: BorderStyle.SINGLE, size: 1 },
                                    },
                                })
                            ),
                        })
                    ),
                });
                paragraphs.push(new Paragraph({ children: [] }));
                paragraphs.push(table as unknown as Paragraph);
                paragraphs.push(new Paragraph({ children: [] }));
            } catch {
                // table generation failed, add as text
                tableRows.forEach(row => {
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: row.join(' | '), font: 'Malgun Gothic', size: 20 })],
                    }));
                });
            }
        }
        tableRows.length = 0;
        inTable = false;
    };

    for (const line of lines) {
        const trimmed = line.trim();

        // 표 구분선 (---|---) 건너뛰기
        if (/^\|?\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?\s*$/.test(trimmed)) {
            continue;
        }

        // 표 행
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            inTable = true;
            const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
            tableRows.push(cells);
            continue;
        }

        if (inTable) flushTable();

        // 빈 줄
        if (!trimmed) {
            paragraphs.push(new Paragraph({ children: [] }));
            continue;
        }

        // 헤딩
        const h1Match = trimmed.match(/^#\s+(.+)/);
        const h2Match = trimmed.match(/^##\s+(.+)/);
        const h3Match = trimmed.match(/^###\s+(.+)/);
        const h4Match = trimmed.match(/^####\s+(.+)/);

        if (h1Match) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [new TextRun({ text: cleanText(h1Match[1]), bold: true, size: 32, font: 'Malgun Gothic' })],
                spacing: { before: 400, after: 200 },
            }));
        } else if (h2Match) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: cleanText(h2Match[1]), bold: true, size: 28, font: 'Malgun Gothic' })],
                spacing: { before: 300, after: 150 },
            }));
        } else if (h3Match) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: [new TextRun({ text: cleanText(h3Match[1]), bold: true, size: 24, font: 'Malgun Gothic' })],
                spacing: { before: 200, after: 100 },
            }));
        } else if (h4Match) {
            paragraphs.push(new Paragraph({
                children: [new TextRun({ text: cleanText(h4Match[1]), bold: true, size: 22, font: 'Malgun Gothic' })],
                spacing: { before: 150, after: 80 },
            }));
        }
        // 리스트
        else if (trimmed.match(/^[-*]\s+/)) {
            const content = trimmed.replace(/^[-*]\s+/, '');
            paragraphs.push(new Paragraph({
                children: parseInlineFormatting(content),
                indent: { left: 400 },
                bullet: { level: 0 },
                spacing: { after: 60 },
            }));
        }
        // 번호 리스트
        else if (trimmed.match(/^\d+\.\s+/)) {
            const content = trimmed.replace(/^\d+\.\s+/, '');
            paragraphs.push(new Paragraph({
                children: parseInlineFormatting(content),
                indent: { left: 400 },
                spacing: { after: 60 },
            }));
        }
        // 일반 텍스트
        else {
            paragraphs.push(new Paragraph({
                children: parseInlineFormatting(trimmed),
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 80, line: 360 },
            }));
        }
    }

    if (inTable) flushTable();
    return paragraphs;
}

function cleanText(text: string): string {
    return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
}

function parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            runs.push(new TextRun({
                text: cleanText(text.slice(lastIndex, match.index)),
                size: 20,
                font: 'Malgun Gothic',
            }));
        }
        runs.push(new TextRun({
            text: cleanText(match[1]),
            bold: true,
            size: 20,
            font: 'Malgun Gothic',
        }));
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        runs.push(new TextRun({
            text: cleanText(text.slice(lastIndex)),
            size: 20,
            font: 'Malgun Gothic',
        }));
    }

    return runs.length > 0 ? runs : [new TextRun({ text: cleanText(text), size: 20, font: 'Malgun Gothic' })];
}

export async function downloadAsDocx(markdown: string, filename: string) {
    const paragraphs = parseMarkdownToDocx(markdown);

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                },
            },
            children: paragraphs,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${filename}.docx`);
}
