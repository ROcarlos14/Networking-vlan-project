import React from 'react';

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string; // e.g., 'max-w-lg'
};

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, widthClass = 'max-w-xl' }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-60" onClick={onClose} />
      <div className={`relative w-full ${widthClass} mx-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-[85vh] flex flex-col`}> 
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <div className="text-white font-medium">{title}</div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">✕</button>
        </div>
        <div className="p-4 overflow-y-auto modal-scroll">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
