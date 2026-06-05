import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  closeOnOverlayClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth,
  closeOnOverlayClick = true 
}) => {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 9999, // Extremely high z-index to stay on top
            backdropFilter: 'blur(8px)',
            padding: '40px 20px',
            overflowY: 'auto'
          }} 
          onClick={closeOnOverlayClick ? onClose : undefined}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            style={{
              backgroundColor: 'var(--card-bg)',
              borderRadius: 'var(--radius-xl)',
              width: '100%',
              maxWidth: maxWidth || '650px',
              padding: '36px',
              boxShadow: '0 25px 50px -12px rgba(15, 118, 110, 0.16), 0 0 0 1px rgba(15, 118, 110, 0.05)',
              position: 'relative',
              marginTop: 'auto',
              marginBottom: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.6)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-headline)' }}>{title}</h2>
              <button 
                onClick={onClose} 
                className="btn-icon"
                style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', borderRadius: '12px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', padding: '4px' }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
