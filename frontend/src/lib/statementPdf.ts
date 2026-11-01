export interface PdfStatementRow {
  date: string;
  type: string;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
  note?: string;
}

const ascii = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
const escapePdf = (value: string) => ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Creates a small dependency-free, multi-page PDF with standard Helvetica text. */
export function downloadStatementPdf(opts: { title: string; customer: string; walletNumber: string; from: string; to: string; rows: PdfStatementRow[] }) {
  const rowsPerPage = 27;
  const chunks: PdfStatementRow[][] = [];
  for (let i = 0; i < opts.rows.length; i += rowsPerPage) chunks.push(opts.rows.slice(i, i + rowsPerPage));
  if (!chunks.length) chunks.push([]);

  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  const firstPageId = 4;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  chunks.forEach((rows, index) => {
    const pageId = firstPageId + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const commands: string[] = [];
    const text = (x: number, y: number, size: number, value: string, bold = false) => {
      commands.push(`BT /${bold ? "F1" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
    };
    text(42, 800, 18, opts.title, true);
    text(42, 818, 9, "MayPay", true);
    text(42, 779, 10, `Customer: ${opts.customer}`);
    text(42, 764, 10, `Wallet: ${opts.walletNumber}`);
    text(42, 749, 10, `Period: ${opts.from} to ${opts.to}`);
    text(42, 727, 9, `Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`);
    commands.push("0.5 w 42 713 m 553 713 l S");
    text(42, 696, 8, "DATE / TIME");
    text(132, 696, 8, "TYPE");
    text(207, 696, 8, "REFERENCE");
    text(354, 696, 8, "DEBIT");
    text(414, 696, 8, "CREDIT");
    text(485, 696, 8, "BALANCE");
    commands.push("0.4 w 42 688 m 553 688 l S");
    let y = 672;
    for (const row of rows) {
      const dateTime = String(row.date ?? "").replace("T", " ");
      const datePart = dateTime.slice(0, 10);
      const timePart = dateTime.length > 10 ? dateTime.slice(11, 19) : "";
      text(42, y, 7, datePart);
      if (timePart) text(42, y - 8, 6.5, timePart);
      const type = String(row.type ?? "");
      text(132, y, 6.5, type.slice(0, 17));
      const ref = String(row.reference ?? "");
      text(207, y, 6.5, ref.slice(0, 24));
      const wrapped = ref.length > 24 || type.length > 17 || Boolean(timePart);
      if (ref.length > 24) text(207, y - 8, 6.5, ref.slice(24, 48));
      if (type.length > 17) text(132, y - 8, 6.5, type.slice(17, 34));
      text(354, y, 7, String(row.debit ?? "-").slice(0, 10));
      text(414, y, 7, String(row.credit ?? "-").slice(0, 10));
      text(485, y, 7, String(row.balance ?? "-").slice(0, 10));
      y -= wrapped ? 22 : 15;
    }
    if (rows.length === 0) text(42, y, 10, "No transactions were found in this date range.");
    commands.push("0.4 w 42 52 m 553 52 l S");
    text(42, 36, 8, `Transactions in statement: ${opts.rows.length}`);
    text(490, 36, 8, `Page ${index + 1} of ${chunks.length}`);
    const stream = commands.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  // Fill any holes, then write offsets for a valid PDF cross-reference table.
  for (let i = 1; i < objects.length; i++) if (!objects[i]) objects[i] = "<< >>";
  let pdf = "%PDF-1.4\n%MayPay statement\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = new TextEncoder().encode(pdf).length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wallet-statement-${opts.from}-to-${opts.to}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


/** Download a report in the same compact PDF format without requiring a server endpoint. */
export function downloadReportPdf(title: string, subtitle: string, headers: string[], rows: string[][], filename: string) {
  const safe = (v: string) => v.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const perPage = 42;
  const chunks: string[][][] = [];
  for (let i = 0; i < rows.length; i += perPage) chunks.push(rows.slice(i, i + perPage));
  if (!chunks.length) chunks.push([]);
  const objects: string[] = [];
  const pageIds: number[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  chunks.forEach((chunk, index) => {
    const pageId = 4 + index * 2, contentId = pageId + 1;
    pageIds.push(pageId);
    const cmds: string[] = [];
    const txt = (x:number,y:number,size:number,v:string,_bold=false) => cmds.push(`BT /F1 ${size} Tf 0 g ${x} ${y} Td (${safe(v)}) Tj ET`);
    txt(38, 805, 17, title, true); txt(38, 786, 9, "MayPay · Official wallet system report"); txt(38, 772, 8, `Downloaded: ${new Date().toLocaleString()}`); txt(38, 758, 9, subtitle);
    cmds.push("0.5 w 38 744 m 557 744 l S");
    const colWidth = 519 / Math.max(headers.length, 1);
    headers.forEach((h,i)=>txt(38+i*colWidth,727,7.5,h.slice(0,Math.max(6,Math.floor(colWidth/4))),true));
    cmds.push("0.4 w 38 719 m 557 719 l S");
    let y=703;
    chunk.forEach(row=>{row.forEach((v,i)=>txt(38+i*colWidth,y,7,String(v??"").slice(0,Math.max(6,Math.floor(colWidth/4)))));y-=15;});
    if (!chunk.length) txt(38,y,9,"No rows available.");
    cmds.push("0.4 w 38 48 m 557 48 l S");txt(38,32,8,`Rows: ${rows.length}`);txt(490,32,8,`Page ${index+1}/${chunks.length}`);
    const stream=cmds.join("\n");
    objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId]=`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  for(let i=1;i<objects.length;i++)if(!objects[i])objects[i]="<< >>";
  let pdf="%PDF-1.4\n%MayPay report\n";const offsets=[0];
  for(let i=1;i<objects.length;i++){offsets[i]=new TextEncoder().encode(pdf).length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=new TextEncoder().encode(pdf).length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url=URL.createObjectURL(new Blob([pdf],{type:"application/pdf"}));const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
