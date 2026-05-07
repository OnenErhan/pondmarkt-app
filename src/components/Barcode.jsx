import { useEffect, useRef } from 'react';
import bwipjs from 'bwip-js';

export default function Barcode({ value, height = 50, scale = 2, displayValue = true, className }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      bwipjs.toCanvas(ref.current, {
        bcid: 'code128',
        text: value,
        scale,
        height,
        includetext: displayValue,
        textxalign: 'center',
        textsize: 10,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Barcode render error', e);
    }
  }, [value, height, scale, displayValue]);

  return <canvas ref={ref} className={className} />;
}
