import { useEffect, useRef, useState } from "react";
import {Button, InputNumber} from "primereact";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText, Toolbar, Toast } from "primereact";
import { notify } from "../notify/notify";
import './BookReader.css';

// Налаштування worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export default function PdfViewer({ url, docId }) {
  const toast = useRef(null);
  const canvasRefLeft = useRef(null);
  const canvasRefRight = useRef(null);

  const renderTaskLeftRef = useRef(null);
  const renderTaskRightRef = useRef(null);  

  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [twoPageMode, setTwoPageMode] = useState(false);
  
  // Стани для пошуку і співпадінь
  const [searchText, setSearchText] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Завантажуємо документ
  useEffect(() => {
    (async () => {
      const doc = await pdfjsLib.getDocument({ url }).promise;
      setPdf(doc);
      
      const settings = localStorage.getItem(docId);
      if (!settings) return;
      const jsonSettings = JSON.parse(settings);

      // Відновлення номеру сторінки
      const savedPage = Number(jsonSettings?.pageNumber ?? pageNumber);
      const startPage = savedPage >= 1 && savedPage <= doc.numPages ? savedPage : 1;
      setPageNumber(startPage);
      
      // Відновлення масштабу
      const savedZoom = Number(jsonSettings?.zoom ?? zoom);
      setZoom(savedZoom);
      
      // Відновлення 1/2 сторінки
      const savedTwoPageMode = Boolean(jsonSettings?.twoPageMode ?? twoPageMode);
      setTwoPageMode(savedTwoPageMode);   

      return () => { setPdf(null) }
    })();

  }, []);

  // Рендер сторінок
  useEffect(() => {
    if (!pdf) return;

    const renderPage = async (pageNum, canvasRef, renderTaskRef) => {

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (pageNum < 1 || pageNum > pdf.numPages) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const page = await pdf.getPage(pageNum);

      const viewport = page.getViewport({ scale: zoom, rotation: page.rotate });  
      canvas.height = viewport.height;
      canvas.width = viewport.width; 
      // скасовуємо попередній рендер, якщо він ще в процесі
      if (renderTaskRef.current) 
        renderTaskRef.current.cancel();

      // очищуємо перед рендером
      context.clearRect(0, 0, canvas.width, canvas.height);
      const task = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = task;

      try {
        await task.promise;
      } 
      catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Помилка рендера:", err);
        }
        // якщо скасування рендера — ігноруємо (просто, щоб зайве не виводилось в консоль)
      }
    };

    // Ліва сторінка
    renderPage(pageNumber, canvasRefLeft, renderTaskLeftRef);

    // Права сторінка (тільки якщо увімкнено режим 2 сторінки)
    if (twoPageMode) {
      renderPage(pageNumber + 1, canvasRefRight, renderTaskRightRef);
    }
  }, [pdf, pageNumber, zoom, twoPageMode]);

  // Скролл до поточного співпадіння (клас стилю highlight.current)
  useEffect(() => {
    const current = document.querySelector(".highlight.current");
    if (current) {
      current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentMatchIndex, zoom]);

  // Навігація
  const goToPage = (n) => {
    if (pdf && n >= 1 && n <= pdf.numPages) {
      setPageNumber(n);
      // Збереження прогресу читання
      localStorage.setItem(docId, 
        JSON.stringify({
          pageNumber: n, 
          zoom: zoom, 
          twoPageMode: twoPageMode})
      );
    }
  };

  // Масштаб
  const changeZoom = (z) => {
    setZoom(z);
    // Збереження масштабу
    localStorage.setItem(docId, 
      JSON.stringify({
        pageNumber: pageNumber, 
        zoom: z, 
        twoPageMode: twoPageMode})
      );
  };  

  // 1/2 сторінки
  const changeTwoPageMode = (t) => {
    setTwoPageMode(t);
    // Збереження режиму 1/2 сторінки
    localStorage.setItem(docId, 
      JSON.stringify({
        pageNumber: pageNumber, 
        zoom: zoom, 
        twoPageMode: t})
      );
  }; 

  //  -------------Пошук----------------------
  const searchInDocument = async () => {
    if (!pdf || !searchText) return;

    // курсор для процесу пошуку
    document.body.style.cursor = "wait";
    // Локальний масив з даними співпадінь
    const found = [];
    
    try {

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Розрахуємо координати для scale: 1, щоб при рендері їх можна було множити на поточний zoom
        const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
        const textContent = await page.getTextContent();

        textContent?.items.forEach(item => {

          if (item.str.toLowerCase().includes(searchText.toLowerCase())) {
            const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const x = transform[4];
            const y = transform[5] - item.height;       
            const width = item.width;
            const height = item.height;
            found.push({ pageNum: i, x, y, width, height });
          }
        });
      }

      setMatches(found);
      setCurrentMatchIndex(0);
    } 
    finally {
      // повертаємо курсор у default
      document.body.style.cursor = "default";
    }

    if (found.length > 0) 
      goToPage(found[0].pageNum);
    else 
      notify.warn(toast, "Результати пошуку", "Співпадінь не знайдено");
  };

  // Встановлення сurrentMatchIndex, перехід на іншу сторінку (за необхідності)
  const goToMatch = (index) => {
    if (index < 0 || index >= matches.length) return;
    setCurrentMatchIndex(index);
    goToPage(matches[index].pageNum);
  };
  
  // Підсвічування результатів пошуку
  const highlightSearch = (currPageNum) => 
    matches
    .filter(m => m.pageNum === currPageNum)
    .map((m, idx) => (
        <div key={idx}
          className={`highlight ${matches[currentMatchIndex] === m ? "current" : ""}`}
          style={{
            left: m.x * zoom,
            top: m.y * zoom,
            width: m.width * zoom,
            height: m.height * zoom
          }}
        />)
    )  

  const toolBarContent = (
    <div className="flex flex-wrap justify-content-center align-items-center gap-2">

      {/* Навігація */}
      <Button rounded outlined icon="pi pi-angle-double-left" className="w-2rem h-2rem" 
        disabled={pageNumber === 1}
        onClick={() => goToPage(1)} 
        tooltip="На першу" tooltipOptions={{ position: 'top' }}/>
      <Button rounded outlined icon="pi pi-angle-left" className="w-2rem h-2rem" 
        disabled={pageNumber === 1}
        onClick={() => goToPage(pageNumber - 1)} 
        tooltip="Назад" tooltipOptions={{ position: 'top' }} />
      <Button rounded outlined icon="pi pi-angle-right" className="w-2rem h-2rem" 
        disabled={pageNumber === pdf?.numPages}
        onClick={() => goToPage(pageNumber + 1)} 
        tooltip="Вперед" tooltipOptions={{ position: 'top' }} />
      <Button rounded outlined icon="pi pi-angle-double-right" className="w-2rem h-2rem" 
        disabled={pageNumber === pdf?.numPages}
        onClick={() => goToPage(pdf?.numPages)} 
        tooltip="На останню" tooltipOptions={{ position: 'top' }} />

      <InputNumber className="text-xs" inputStyle={{ width: '50px' }} useGrouping={false} value={pageNumber}  
        onBlur={(e) => goToPage(Number(e.value))} 
        onKeyDown={(e) => { if (e.key === "Enter") goToPage(Number(e.target.value)) }} />
      <span> / {pdf?.numPages}</span>

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
      <span> Масштаб: {Math.round(zoom * 100)}%</span>

      {pdf?.numPages > 1 &&
      <Button rounded outlined onClick={() => changeTwoPageMode(!twoPageMode)} 
        label={twoPageMode ? "1 сторінка" : "2 сторінки"} />}    
      
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
      <div className="content-area">
        <div className="flex justify-content-center gap-3 overflow-auto" >
          <div className="pdf-page-wrapper">
            <canvas ref={canvasRefLeft}></canvas>
            {highlightSearch(pageNumber)}   
          </div>

          {twoPageMode &&
          <>
          <div className="pdf-page-wrapper">
            <canvas ref={canvasRefRight}></canvas>
            {pageNumber !== pdf.numPages && highlightSearch(pageNumber + 1)}
          </div>          
          </>}
        </div>
      </div>
   
    </div>
  );
}