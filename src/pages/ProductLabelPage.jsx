import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Tag, Hash } from 'lucide-react';
import { jsPDF } from 'jspdf';
import bwipjs from 'bwip-js';
import { supabase } from '../lib/supabase/client.js';
import Barcode from '../components/Barcode.jsx';

function buildSerial(dateStr, seq) {
  const datePart = dateStr.replace(/-/g, '');
  return `${datePart}-${String(seq).padStart(3, '0')}`;
}

// jsPDF default font doesn't support Turkish chars — normalize before rendering
function normTr(str) {
  return (str ?? '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U');
}

export default function ProductLabelPage() {
  const { variantId } = useParams();
  const [searchParams] = useSearchParams();
  const [variant, setVariant] = useState(null);
  const [count, setCount] = useState(() => Number(searchParams.get('qty')) || 12);
  const [serialMode, setSerialMode] = useState(() => searchParams.get('serial') === 'true');
  const [startSeq, setStartSeq] = useState(1);
  const [serialDate, setSerialDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('product_variants')
        .select(
          '*, product_types(code,name), product_sizes(label,code), product_colors(label,code,hex)',
        )
        .eq('id', variantId)
        .single();
      if (active) setVariant(data);
    })();
    return () => {
      active = false;
    };
  }, [variantId]);

  const handlePrintPdf = async () => {
    if (!variant) return;
    // A4: 210x297mm. Etiket 70x30mm → 3 sütun x 9 sıra = 27 etiket/sayfa
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const labelW = 70;
    const labelH = 30;
    const cols = Math.floor(pageW / labelW);
    const rows = Math.floor(pageH / labelH);
    const perPage = cols * rows;
    const marginX = (pageW - cols * labelW) / 2;
    const marginY = (pageH - rows * labelH) / 2;

    // Pre-render barcode as PNG dataurl once
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text: variant.barcode,
      scale: 3,
      height: 14,
      includetext: false,
    });
    const barcodeImg = canvas.toDataURL('image/png');

    for (let i = 0; i < count; i++) {
      if (i > 0 && i % perPage === 0) pdf.addPage();
      const idx = i % perPage;
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = marginX + c * labelW;
      const y = marginY + r * labelH;

      pdf.setDrawColor(220);
      pdf.rect(x, y, labelW, labelH);
      pdf.setFontSize(9);
      pdf.text(normTr(variant.product_types?.name ?? ''), x + 3, y + 5);
      pdf.setFontSize(7);
      pdf.text(
        normTr(`${variant.product_colors?.label ?? ''} · ${variant.product_sizes?.label ?? ''}`),
        x + 3,
        y + 9,
      );

      if (serialMode) {
        pdf.addImage(barcodeImg, 'PNG', x + 3, y + 11, labelW - 6, 10);
        pdf.setFontSize(7);
        pdf.text(variant.sku, x + labelW / 2, y + 24, { align: 'center' });
        pdf.setFontSize(6.5);
        pdf.setTextColor(80, 80, 200);
        pdf.text(buildSerial(serialDate, startSeq + i), x + labelW / 2, y + 28, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
      } else {
        pdf.addImage(barcodeImg, 'PNG', x + 3, y + 11, labelW - 6, 12);
        pdf.setFontSize(8);
        pdf.text(variant.sku, x + labelW / 2, y + 27, { align: 'center' });
      }
    }

    pdf.save(`etiket-${variant.sku}-${count}.pdf`);
  };

  if (!variant) return <p className="p-6 text-sm text-slate-400">Yükleniyor...</p>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        to={`/products/${variant.product_type_id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> {variant.product_types?.name}
      </Link>
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Tag size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Barkod Etiketi</h1>
          <p className="text-sm text-slate-500 font-mono">{variant.sku}</p>
        </div>
      </header>

      <div className="card mb-4">
        <h2 className="mb-3 text-base font-semibold">Önizleme</h2>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-6">
          <div className="rounded bg-white p-4 shadow-sm" style={{ width: 280 }}>
            <p className="text-sm font-semibold text-slate-900">{variant.product_types?.name}</p>
            <p className="text-xs text-slate-500">
              {variant.product_colors?.label} · {variant.product_sizes?.label}
            </p>
            <Barcode value={variant.barcode} height={50} scale={2} displayValue={false} className="mt-2 w-full" />
            <p className="text-center text-xs font-mono mt-1">{variant.sku}</p>
            {serialMode && (
              <p className="text-center text-[11px] font-mono mt-0.5 text-indigo-600">
                {buildSerial(serialDate, startSeq)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-base font-semibold">PDF Yazdır</h2>
        <div className="grid grid-cols-2 items-end gap-4">
          <div>
            <label className="label">Etiket sayısı</label>
            <input
              type="number"
              min={1}
              max={1000}
              className="input"
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
            />
            <p className="mt-1 text-xs text-slate-500">A4 sayfaya 3×9 = 27 etiket sığar (70×30mm)</p>
          </div>
          <button type="button" className="btn-primary btn-lg" onClick={handlePrintPdf}>
            <Printer size={18} /> PDF İndir
          </button>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={serialMode}
                onChange={(e) => setSerialMode(e.target.checked)}
              />
              <div
                className={`h-5 w-9 rounded-full transition-colors ${serialMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
              />
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${serialMode ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Hash size={14} /> Benzersiz Seri Numarası
            </div>
          </label>
          <p className="ml-12 mt-1 text-xs text-slate-400">
            Her etikete ayrı seri kodu yazdırılır: <span className="font-mono">{variant.sku}-YYYYMMDD-001</span>
          </p>

          {serialMode && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tarih</label>
                <input
                  type="date"
                  className="input"
                  value={serialDate}
                  onChange={(e) => setSerialDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Başlangıç sırası</label>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  className="input"
                  value={startSeq}
                  onChange={(e) => setStartSeq(Number(e.target.value) || 1)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Örnek: {buildSerial(serialDate, startSeq)} … {buildSerial(serialDate, startSeq + count - 1)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
