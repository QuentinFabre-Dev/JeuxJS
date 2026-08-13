/**
 * Excel export of a review, tailored for how findings are actually processed:
 * a summary sheet for the reader, a working sheet for the reviewer (filterable,
 * with a status dropdown and an empty comment column), and a breakdown by type.
 *
 * ExcelJS is loaded on demand so it never weighs on the initial bundle.
 */

import { PRIORITIES, SKILLS } from '../data/constants.js';
import { REVIEW_STATES, statusLabel } from '../data/review.js';

const COLORS = {
  brand: 'FF1E3A8A',
  headerText: 'FFFFFFFF',
  high: 'FFFEE2E2',
  medium: 'FFFEF3C7',
  low: 'FFD1FAE5',
  accepted: 'FFD1FAE5',
  rejected: 'FFF1F5F9',
  pending: 'FFFFF7ED',
  zebra: 'FFF8FAFC',
};

const skillLabel = (finding) =>
  finding.skill === 'custom'
    ? (finding.customLabel ?? 'Custom')
    : (SKILLS.find((skill) => skill.id === finding.skill)?.label ?? finding.skill);

const styleHeaderRow = (row) => {
  row.font = { bold: true, color: { argb: COLORS.headerText }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 22;
};

const addSummarySheet = (workbook, { meta, findings, states, score }) => {
  const sheet = workbook.addWorksheet('Summary', {
    properties: { defaultRowHeight: 18 },
  });
  sheet.columns = [{ width: 28 }, { width: 62 }];

  const title = sheet.addRow(['Document quality review']);
  title.font = { bold: true, size: 16, color: { argb: COLORS.brand } };
  sheet.addRow([]);

  const countByState = (state) =>
    findings.filter((finding) => (states.get(finding.id) ?? REVIEW_STATES.PENDING) === state)
      .length;

  const rows = [
    ['Document', meta.fileName],
    ['Pages', meta.pageCount],
    ['Document type', meta.docTypeLabel],
    ['Service line', meta.serviceLineLabel],
    ['Detected language', meta.languageLabel ?? '—'],
    ['Analysed on', meta.date],
    ['Engine', meta.engine],
    ['Model', meta.model],
    [],
    ['Quality score', `${score} / 100`],
    ['Findings', findings.length],
    ['· open', countByState(REVIEW_STATES.PENDING)],
    ['· accepted', countByState(REVIEW_STATES.ACCEPTED)],
    ['· rejected (false positives)', countByState(REVIEW_STATES.REJECTED)],
    [],
    ['High priority', findings.filter((f) => f.priority === 'high').length],
    ['Medium priority', findings.filter((f) => f.priority === 'medium').length],
    ['Low priority', findings.filter((f) => f.priority === 'low').length],
  ];

  if (meta.customChecks?.length) {
    rows.push([], ['Custom checks', meta.customChecks.join(' · ')]);
  }

  rows.forEach((cells) => {
    const row = sheet.addRow(cells);
    row.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });

  return sheet;
};

const addFindingsSheet = (workbook, { findings, states }) => {
  const sheet = workbook.addWorksheet('Findings', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: '#', key: 'index', width: 5 },
    { header: 'Page', key: 'page', width: 7 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Confidence', key: 'confidence', width: 11 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Original', key: 'original', width: 52 },
    { header: 'Suggestion', key: 'suggestion', width: 52 },
    { header: 'Why', key: 'why', width: 40 },
    { header: 'Reviewer comment', key: 'comment', width: 30 },
  ];

  styleHeaderRow(sheet.getRow(1));

  findings.forEach((finding, index) => {
    const state = states.get(finding.id) ?? REVIEW_STATES.PENDING;
    const row = sheet.addRow({
      index: index + 1,
      page: finding.page,
      type: skillLabel(finding),
      priority: PRIORITIES[finding.priority]?.label ?? finding.priority,
      confidence: Math.round(finding.confidence * 100) / 100,
      status: statusLabel(state),
      original: finding.original,
      suggestion: finding.suggestion,
      why: finding.explanation,
      comment: '',
    });

    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell('confidence').numFmt = '0%';
    row.getCell('priority').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS[finding.priority] ?? COLORS.zebra },
    };
    row.getCell('status').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS[state] ?? COLORS.pending },
    };
    // Lets the reviewer keep triaging inside the spreadsheet.
    row.getCell('status').dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${Object.values(REVIEW_STATES).map(statusLabel).join(',')}"`],
    };
  });

  if (findings.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  return sheet;
};

const addBreakdownSheet = (workbook, { findings }) => {
  const sheet = workbook.addWorksheet('By type');
  sheet.columns = [
    { header: 'Type', key: 'type', width: 24 },
    { header: 'Findings', key: 'count', width: 10 },
    { header: 'High', key: 'high', width: 8 },
    { header: 'Medium', key: 'medium', width: 9 },
    { header: 'Low', key: 'low', width: 8 },
    { header: 'Avg. confidence', key: 'confidence', width: 15 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const groups = new Map();
  findings.forEach((finding) => {
    const label = skillLabel(finding);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(finding);
  });

  [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([label, group]) => {
      const row = sheet.addRow({
        type: label,
        count: group.length,
        high: group.filter((f) => f.priority === 'high').length,
        medium: group.filter((f) => f.priority === 'medium').length,
        low: group.filter((f) => f.priority === 'low').length,
        confidence:
          group.reduce((sum, f) => sum + f.confidence, 0) / group.length,
      });
      row.getCell('confidence').numFmt = '0%';
    });

  return sheet;
};

/** Builds the workbook and returns it as a Blob. */
export const buildWorkbookBlob = async ({ findings, states, meta, score }) => {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ryder';
  workbook.created = new Date();

  addSummarySheet(workbook, { meta, findings, states, score });
  addFindingsSheet(workbook, { findings, states });
  addBreakdownSheet(workbook, { findings });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

export const buildFileName = (documentName) => {
  const base = (documentName ?? 'document').replace(/\.[^.]+$/, '').slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-qa-${stamp}.xlsx`;
};

/** Builds the workbook and hands it to the browser as a download. */
export const exportToExcel = async ({ findings, states, meta, score }) => {
  const blob = await buildWorkbookBlob({ findings, states, meta, score });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFileName(meta.fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
