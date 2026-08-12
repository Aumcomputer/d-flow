import React from 'react'
import { X, ExternalLink } from 'lucide-react'
import api from '../services/api'

export default function FileViewerModal({ doc, isOpen, onClose }) {
  if (!isOpen || !doc) return null

  const getFileUrl = (path) => {
    return `${api.defaults.baseURL || '/api'}/documents/file/${path}`
  }

  const url = getFileUrl(doc.file_path)
  const isImage = doc.file_path.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i)
  const isPdf = doc.file_path.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-[95vw] h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 text-lg truncate pr-4">
              {doc.original_filename || doc.stored_filename}
            </h3>
            <a 
              href={url} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              เปิดในแท็บใหม่
            </a>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-100 w-full h-full flex flex-col relative">
          {isImage && (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              <img 
                src={url} 
                alt={doc.stored_filename} 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
          
          {isPdf && (
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={doc.stored_filename}
            />
          )}

          {!isImage && !isPdf && (
            <div className="text-slate-500 flex flex-col items-center justify-center h-full">
              <p>ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ได้</p>
              <a href={url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline mt-2">ดาวน์โหลดไฟล์</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
