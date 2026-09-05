#!/usr/bin/env node
import fs from 'node:fs';

const [whooingPath, jangoPath, outPath = 'reconcile_result.json'] = process.argv.slice(2);
if (!whooingPath || !jangoPath) {
  console.error('Usage: node tools/reconcile-csv.mjs <whooing.csv> <jango.csv> [out.json]');
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const whoRows = parseCSV(fs.readFileSync(whooingPath, 'utf8'));
const jRows = parseCSV(fs.readFileSync(jangoPath, 'utf8'));

const who = whoRows.slice(1).filter((r) => r[0]).map((r) => ({ date: r[0], dr: r[5], cr: r[7], amt: Number(String(r[2] || '0').replace(/,/g, '')) }));
const jHeader = jRows[0] || [];
const dIdx = jHeader.indexOf('날짜');
const drIdx = jHeader.indexOf('차변계정');
const crIdx = jHeader.indexOf('대변계정');
const aIdx = jHeader.indexOf('금액');
const jango = jRows.slice(1).filter((r) => r[dIdx]).map((r) => ({ date: r[dIdx], dr: r[drIdx], cr: r[crIdx], amt: Number(String(r[aIdx] || '0').replace(/,/g, '')) }));

function aggregate(rows) {
  const map = new Map();
  for (const t of rows) {
    map.set(t.dr, (map.get(t.dr) || 0) + t.amt);
    map.set(t.cr, (map.get(t.cr) || 0) - t.amt);
  }
  return map;
}

const aWho = aggregate(who);
const aJ = aggregate(jango);
const accounts = [...new Set([...aWho.keys(), ...aJ.keys()])];
const diffs = accounts
  .map((account) => {
    const whoValue = aWho.get(account) || 0;
    const jValue = aJ.get(account) || 0;
    return { account, whooingSigned: whoValue, jangoSigned: jValue, delta: jValue - whoValue };
  })
  .filter((x) => Math.abs(x.delta) > 0.5)
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

const result = {
  whooingCount: who.length,
  jangoCount: jango.length,
  diffAccountCount: diffs.length,
  topDiffs: diffs.slice(0, 30),
};

fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`Wrote ${outPath}`);
