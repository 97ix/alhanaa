import { useEffect, useRef } from 'react';
import { Camera, X } from 'lucide-react';

declare global {
  interface Window {
    Html5Qrcode: any;
  }
}

interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const CameraScanner = ({ onScan, onClose }: CameraScannerProps) => {
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    // Check if library is loaded
    if (!window.Html5Qrcode) {
      alert("خطأ: لم يتم تحميل مكتبة قارئ الباركود. يرجى إعادة تشغيل التطبيق.");
      return;
    }

    // Check for camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("خطأ: متصفحك أو جهازك لا يدعم الوصول للكاميرا.");
      return;
    }

    let isMounted = true;
    const html5QrCode = new window.Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const config = { fps: 15, qrbox: { width: 280, height: 180 } };
    let lastScan: string = "";
    let lastTime: number = 0;

    html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
      (decodedText: string) => {
        if (!isMounted) return;
        const now = Date.now();
        if (decodedText !== lastScan || now - lastTime > 1500) {
            lastScan = decodedText;
            lastTime = now;
            onScan(decodedText);
        }
      },
      () => {}
    ).catch((err: any) => {
      if (!isMounted) return;
      console.error("Camera start error:", err);
      // alert("خطأ في تشغيل الكاميرا: " + err);
      onClose();
    });

    return () => {
      isMounted = false;
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch((err: any) => console.log(err));
      }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '500px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: 'white' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <Camera size={20} /> مسح الباركود بالكاميرا
          </h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
        
        <div id="reader" style={{ width: '100%', borderRadius: '24px', overflow: 'hidden', border: '4px solid var(--primary)' }}></div>
        
        <p style={{ color: 'white', textAlign: 'center', marginTop: '24px', opacity: 0.7, fontSize: '0.9rem' }}>
          قم بتوجيه الباركود نحو الكاميرا ليتم التعرف عليه تلقائياً
        </p>
      </div>
    </div>
  );
};
