import { useEffect, useRef, useState } from "react";
import { Button, InputNumber, InputText, Toolbar, Toast } from "primereact";
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { notify } from "../notify/notify";
import ePub from "epubjs";
import "./BookReader.css";

export default function EpubViewer({ url, docId }) {
  const toast = useRef(null);
  const viewerRef = useRef(null);

  const [book, setBook] = useState(null);
  const [rendition, setRendition] = useState(null);
  const [location, setLocation] = useState(null);
  const [zoom, setZoom] = useState(1.0);

  // Стани для пошуку і співпадінь  
  const [searchText, setSearchText] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Завантажуємо документ
  useEffect(() => {
    const b = ePub(url);
    setBook(b);
    const r = b.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
    });
    setRendition(r);

    r.display();

    r.on("relocated", (loc) => {
      setLocation(loc);
      localStorage.setItem(
        docId,
        JSON.stringify({ location: loc.start.cfi, zoom })
      );
    });

    return () => {
      r.destroy();
    };
  }, [url]);

  // Навігація
  const goToPage = (cfi) => {
    if (rendition) {
      rendition.display(cfi);
    }
  };

  // Масштаб
  const changeZoom = (z) => {
    setZoom(z);
    if (rendition) {
      rendition.themes.fontSize(`${z * 100}%`);
    }
  };

  // --------------- Пошук ---------------------------------
  const searchInDocument = async () => {
    if (!book || !searchText) return;
    const results = await book.search(searchText);
    setMatches(results);
    setCurrentMatchIndex(0);

    if (results.length > 0) {
      goToPage(results[0].cfi);
    } else {
      notify.warn(toast, "Результати пошуку", "Співпадінь не знайдено");
    }
  };

  // Встановлення сurrentMatchIndex, перехід на іншу сторінку (за необхідності)  
  const goToMatch = (index) => {
    if (index < 0 || index >= matches.length) return;
    setCurrentMatchIndex(index);
    goToPage(matches[index].cfi);
  };

  const toolBarContent = (
    <div className="flex flex-wrap justify-content-center align-items-center gap-2">
      {/* Навігація */}
      <Button rounded outlined icon="pi pi-angle-double-left" className="w-2rem h-2rem" 
        onClick={() => rendition.prev()}
        tooltip="На першу" tooltipOptions={{ position: 'top' }} />

      <Button rounded outlined icon="pi pi-angle-left" className="w-2rem h-2rem" 
        onClick={() => rendition.prev()}
        tooltip="Назад"  tooltipOptions={{ position: 'top' }} />
      
      <Button rounded outlined icon="pi pi-angle-right" className="w-2rem h-2rem" 
        onClick={() => rendition.next()}
        tooltip="Вперед" tooltipOptions={{ position: 'top' }} />
      
      <Button rounded outlined icon="pi pi-angle-double-right" className="w-2rem h-2rem" 
        onClick={() => rendition.next()}
        tooltip="На останню" tooltipOptions={{ position: 'top' }} />      

      {/* Масштаб */}
      <Button rounded outlined icon="pi pi-search-plus" className="w-2rem h-2rem" 
        onClick={() => changeZoom(zoom + 0.25)}
        tooltip="Збільшити" tooltipOptions={{ position: 'top' }} />    
      
      <Button rounded outlined icon="pi pi-search-minus" className="w-2rem h-2rem" 
        onClick={() => changeZoom(Math.max(zoom - 0.25, 0.25))}
        tooltip="Зменшити" tooltipOptions={{ position: 'top' }} />    
    
      <Button rounded outlined icon="pi pi-search" className="w-2rem h-2rem" 
        onClick={() => changeZoom(1)}
        tooltip="За замовчуванням" tooltipOptions={{ position: 'top' }} />    
      <span> Масштаб: {Math.round(zoom * 100)}% </span>

      {/* Пошук */}
      <IconField iconPosition="left">
          <InputIcon className="pi pi-search"> </InputIcon>
          <InputText placeholder="Пошук..." 
          value={searchText}
          onChange={(e) => { 
            setSearchText(e.target.value);
            setCurrentMatchIndex(0);
            setMatches([]);
          }}
          onKeyDown={(e) => { 
            if (e.key === "Enter") {
              searchInDocument();
            }
          }}
        />
      </IconField>   
      {/* Якщо знайдено співпадіння у пошуку */}        
      {searchText !== "" && matches.length > 0 && (
        <>
          <Button rounded text icon="pi pi-backward" className="w-2rem h-2rem"
            tooltip="Попереднє" tooltipOptions={{ position: 'top' }}
            onClick={() => goToMatch(currentMatchIndex - 1)} 
            disabled={currentMatchIndex <= 0} />
          <Button rounded text icon="pi pi-forward" className="w-2rem h-2rem" 
            tooltip="Наступне" tooltipOptions={{ position: 'top' }}
            onClick={() => goToMatch(currentMatchIndex + 1)} 
            disabled={currentMatchIndex >= matches.length - 1} />
          <span>{currentMatchIndex + 1} / {matches.length}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="viewer-container">
      <Toast ref={toast} />
      <Toolbar className="sticky-toolbar" center={toolBarContent} />
      <div ref={viewerRef} className="epub-viewer"></div>
    </div>
  );
}
