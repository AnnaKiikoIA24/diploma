import { useEffect, useRef, useMemo, useState } from "react";
import PropTypes from 'prop-types';
import { Toast } from 'primereact';
import PdfViewer from "./PdfViewer";
import EpubViewer from "./EpubViewer";
import { getReadingBook, startReading } from  '../../utils/reading.js'

BookReader.propTypes = {
  bookId: PropTypes.string, 
  dateStartRead: PropTypes.string, 
  fileName: PropTypes.string,
  toastRef: PropTypes.object,
  updateData: PropTypes.func,
  onClose: PropTypes.func
}

export default function BookReader({ bookId, dateStartRead, fileName, toastRef, updateData, onClose }) {
  
  const toast = useRef(null);   
  const [objectUrl, setObjectUrl] = useState(null);
  const [contentType, setContentType] = useState(null);

  const loadContent = async() => {
    document.body.style.cursor = "wait";
    try {
      const content =  await getReadingBook(fileName, toastRef);
      if (content) {
        setObjectUrl(content.objectUrl);
        setContentType(content.contentType);
        // Змінюємо дату/час початку читання на поточний, якщо книга раніше не була в процесі читання
        if (!dateStartRead)
          dateStartRead =  await startReading(bookId, toastRef);
          if (dateStartRead)
            updateData({ bookId, dateStartRead/*: (new Date()).toISOString()*/ })
      } 
      else onClose();
    } 
    finally {
      // повертаємо курсор у default
      document.body.style.cursor = "default";
    }      
  }

  useEffect(() => {
    loadContent();
    
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }, [])

  // Визначення типу документа
  const type = useMemo(() => {

    const ct = (contentType || "").toLowerCase();
    if (ct.includes("pdf")) return "pdf";
    if (ct.includes("epub")) return "epub";
    // Фолбек по розширенню
    if (fileName.endsWith(".pdf")) return "pdf";
    if (fileName.endsWith(".epub")) return "epub";
    return undefined;
  }, [contentType, fileName]);

  if (!objectUrl) return <div className="p-3" style={{ cursor: "wait"}}>Завантаження файлу…</div>;
  if (!type) return <div className="p-3">Не вдалося визначити тип файлу.</div>;

  return (
    <>
      <Toast ref={toast} />      
      {type === "pdf" ? 
      <PdfViewer url={objectUrl} docId={fileName} />
      : 
      <EpubViewer url={objectUrl} docId={fileName} />
      }
    </>
  );
}